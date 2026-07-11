const LOOP_PLACEHOLDER_ROOTS = new Set([
    'item',
    'feature',
    'section',
    'lang',
    'sound',
    'stat',
    'faq',
    'row',
    'header',
    'post',
    'page',
    'tag',
    'related',
    'loc',
    'alt',
    'guide'
]);

function getValue(obj, keyPath) {
    return keyPath.split('.').reduce((value, key) => {
        if (value && typeof value === 'object' && key in value) {
            return value[key];
        }
        return undefined;
    }, obj);
}

function getValueFromContext(context, keyPath) {
    const direct = getValue(context, keyPath);
    if (direct !== undefined) {
        return direct;
    }
    if (!keyPath.includes('.')) {
        return undefined;
    }
    const parts = keyPath.split('.');
    const first = parts[0];
    if (first in context) {
        const firstValue = context[first];
        if (firstValue && typeof firstValue === 'object' && firstValue !== null) {
            const rest = parts.slice(1).join('.');
            return rest ? getValue(firstValue, rest) : firstValue;
        }
    }
    return undefined;
}

function warnForTemplateIssue(lang, message) {
    console.warn(`Warning [${lang}]: ${message}`);
}

function shouldWarnMissingVar(pathExpression) {
    if (pathExpression.startsWith('seo.structured_data.')) {
        return false;
    }
    const root = pathExpression.split('.')[0];
    return !LOOP_PLACEHOLDER_ROOTS.has(root);
}

function cleanupJsonArtifacts(content) {
    return content
        .replace(/,\s*\n[\s\n]*\]/g, '\n            ]')
        .replace(/,\s*\]/g, ']');
}

function applyFilters(value, filters, rawKey, lang) {
    let output = value;
    for (const filter of filters) {
        if (filter === 'json') {
            output = JSON.stringify(output);
        } else if (filter === 'xml') {
            output = String(output)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        } else {
            warnForTemplateIssue(lang, `Unknown filter "${filter}" in ${rawKey}`);
        }
    }
    return output;
}

function replaceVariables(template, context, lang) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const rawKey = key.trim();
        if (
            rawKey.startsWith('#each') ||
            rawKey === '/each' ||
            rawKey.startsWith('#if') ||
            rawKey === '/if'
        ) {
            return '';
        }

        const [pathExpression, ...filters] = rawKey
            .split('|')
            .map((part) => part.trim())
            .filter(Boolean);

        const value = getValueFromContext(context, pathExpression);
        if (value === undefined) {
            if (shouldWarnMissingVar(pathExpression)) {
                warnForTemplateIssue(lang, `Variable ${pathExpression} not found in data`);
            }
            return match;
        }

        return applyFilters(value, filters, rawKey, lang);
    });
}

function processIfBlocks(template, context) {
    const ifPattern = /\{\{#if\s+([^\s}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    let result = template;
    let previous;

    do {
        previous = result;
        result = result.replace(ifPattern, (fullMatch, pathExpression, blockContent) => {
            if (/\{\{#if\s+/.test(blockContent)) {
                return fullMatch;
            }
            const path = pathExpression.trim();
            const root = path.split('.')[0];
            // Conditions on loop variables must wait until the surrounding
            // {{#each}} puts the variable in scope; evaluating them against the
            // root context would silently strip the block.
            if (LOOP_PLACEHOLDER_ROOTS.has(root) && !(root in context)) {
                return fullMatch;
            }
            const value = getValueFromContext(context, path);
            const isTruthy = value !== undefined && value !== null && value !== false && value !== '';
            return isTruthy ? blockContent : '';
        });
    } while (result !== previous);

    return result;
}

/**
 * Find the first {{#each ...}} block, pairing its {{/each}} with nesting
 * awareness (a lazy regex would pair an outer open tag with an inner close
 * tag and corrupt nested loops).
 */
function findEachBlock(template, fromIndex = 0) {
    const openPattern = /\{\{#each\s+([^\s]+)\s+as\s+\|([^|]+)\|\}\}/g;
    openPattern.lastIndex = fromIndex;
    const open = openPattern.exec(template);
    if (!open) {
        return null;
    }

    const tokenPattern = /\{\{#each\s[^}]*\}\}|\{\{\/each\}\}/g;
    tokenPattern.lastIndex = open.index + open[0].length;
    let depth = 1;
    let token;
    while ((token = tokenPattern.exec(template)) !== null) {
        depth += token[0].startsWith('{{#each') ? 1 : -1;
        if (depth === 0) {
            return {
                start: open.index,
                end: token.index + token[0].length,
                arrayPath: open[1].trim(),
                variableName: open[2].trim(),
                block: template.slice(open.index + open[0].length, token.index)
            };
        }
    }
    return null;
}

function processEachBlocks(template, context, lang) {
    let result = template;
    let found = findEachBlock(result);

    while (found) {
        const { start, end, arrayPath, variableName, block } = found;
        const array = getValueFromContext(context, arrayPath);

        let rendered = '';
        if (!Array.isArray(array)) {
            if (array != null) {
                warnForTemplateIssue(lang, `${arrayPath} is not an array (got ${typeof array})`);
            } else if (!arrayPath.includes('.')) {
                warnForTemplateIssue(lang, `${arrayPath} is not an array or not found`);
            }
        } else {
            rendered = cleanupJsonArtifacts(
                array.map((item) => {
                    const mergedContext = { ...context, [variableName]: item };
                    let nested = processEachBlocks(block, mergedContext, lang);
                    nested = processIfBlocks(nested, mergedContext);
                    return replaceVariables(nested, mergedContext, lang);
                }).join('')
            );
        }

        result = result.slice(0, start) + rendered + result.slice(end);
        found = findEachBlock(result, start + rendered.length);
    }

    return result;
}

function renderTemplate(template, data, lang = 'en') {
    const withIf = processIfBlocks(template, data);
    const withEach = processEachBlocks(withIf, data, lang);
    return cleanupJsonArtifacts(replaceVariables(withEach, data, lang));
}

module.exports = {
    renderTemplate,
    stripHtml(value) {
        if (typeof value !== 'string') {
            return value;
        }
        return value
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
};
