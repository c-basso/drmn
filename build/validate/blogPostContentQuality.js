'use strict';

const ALLOWED_CONTENT_TAGS = new Set([
    'p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

const STANDARD_HTML_ATTRS = new Set([
    'href', 'rel', 'target', 'class', 'id', 'title', 'datetime', 'aria-label', 'aria-current'
]);

/** Non-Latin scripts that should not appear in English blog body copy */
const FOREIGN_SCRIPT_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0590-\u05ff\u0600-\u06ff\u0400-\u04ff]/;

const AI_PHRASE_RE = /\b(unpack|delve into|in today's|it's worth noting|at its core|in conclusion|to sum up|surprisingly nuanced|game.?changer|dive deep|let's explore|in the realm of|pave the way|a myriad of|paramount|holistic approach|seamless experience|robust solution|cutting.?edge|groundbreaking)\b/i;

const GARBAGE_TOKEN_RE = /\b(enfranchised|investimento|raconteur|theactivator|vs\.?kreis|white\/platform)\b/i;

const EM_DASH = '\u2014';
const BLOG_TITLE_HARD_MAX = 73;
const DESCRIPTION_MIN = 150;
const DESCRIPTION_MAX = 160;
const WORD_COUNT_MIN = 750;
const WORD_COUNT_MAX = 2200;
const EM_DASH_MAX_PER_1K_WORDS = 5;
const PRIMARY_KEYWORD_MAX_DENSITY = 0.035;
const INTERNAL_LINK_MIN = 2;

function stripHtml(value) {
    return String(value)
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function countWords(text) {
    return stripHtml(text).split(/\s+/).filter(Boolean).length;
}

function normalizeCompareText(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function titlesTooSimilar(a, b) {
    const left = normalizeCompareText(a);
    const right = normalizeCompareText(b);
    if (!left || !right || left === right) {
        return left === right;
    }
    const leftWords = new Set(left.split(' ').filter((word) => word.length > 3));
    const rightWords = right.split(' ').filter((word) => word.length > 3);
    if (rightWords.length === 0) {
        return false;
    }
    const shared = rightWords.filter((word) => leftWords.has(word)).length;
    return shared >= 4 && shared / rightWords.length >= 0.75;
}

function extractTagNames(html) {
    const tags = [];
    const re = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    let match;
    while ((match = re.exec(html)) !== null) {
        tags.push(match[1].toLowerCase());
    }
    return tags;
}

function findDisallowedTags(html) {
    const disallowed = new Set();
    for (const tag of extractTagNames(html)) {
        if (!ALLOWED_CONTENT_TAGS.has(tag)) {
            disallowed.add(tag);
        }
    }
    return [...disallowed];
}

function findSuspiciousAttributes(html) {
    const issues = [];
    const tagRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
    let match;
    while ((match = tagRe.exec(html)) !== null) {
        const tag = match[1].toLowerCase();
        const attrs = match[2];
        const attrRe = /\b([a-z][a-z0-9-]*)=/gi;
        let attrMatch;
        while ((attrMatch = attrRe.exec(attrs)) !== null) {
            const name = attrMatch[1].toLowerCase();
            if (!STANDARD_HTML_ATTRS.has(name)) {
                issues.push(`<${tag}> has non-standard attribute "${name}"`);
            }
        }
    }
    return issues;
}

function findMalformedListMarkup(html) {
    const issues = [];
    if (/<li[^>]*>[\s\S]*?<\/li\s+[^>]*>/i.test(html)) {
        issues.push('malformed <li> closing (text or attributes after </li>)');
    }
    if (/<ul[^>]*>[^<]*[A-Za-z]{3,}/i.test(html.replace(/<li[\s\S]*?<\/li>/gi, ''))) {
        issues.push('<ul> contains loose text outside <li> elements');
    }
    if (/<\/li\s+[^>]+>/i.test(html)) {
        issues.push('broken </li> tag with extra attributes');
    }
    return issues;
}

function findInternalLinkIssues(html) {
    const issues = [];
    const warnings = [];
    const links = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi)];
    const internal = links.filter((m) => m[1].startsWith('/blog/'));

    if (internal.length < INTERNAL_LINK_MIN) {
        warnings.push(`fewer than ${INTERNAL_LINK_MIN} internal blog links (found ${internal.length})`);
    }

    for (const match of internal) {
        const href = match[1];
        if (!/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(href)) {
            issues.push(`internal link must use /blog/slug/ format with trailing slash: ${href}`);
        }
    }

    return { issues, warnings };
}

function guessPrimaryKeyword(post) {
    const fromSlug = post.slug?.replace(/-/g, ' ').trim();
    const title = stripHtml(post.title || '').toLowerCase();
    if (fromSlug && title.includes(fromSlug)) {
        return fromSlug;
    }
    const titleWords = title.split(/\s+/).filter((w) => w.length > 3);
    return titleWords.slice(0, 3).join(' ') || fromSlug || '';
}

function keywordDensity(text, keyword) {
    if (!keyword) {
        return 0;
    }
    const words = stripHtml(text).toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return 0;
    }
    const normalizedKeyword = keyword.toLowerCase();
    let count = 0;
    for (let i = 0; i < words.length; i += 1) {
        const phrase = words.slice(i, i + normalizedKeyword.split(' ').length).join(' ');
        if (phrase === normalizedKeyword) {
            count += 1;
        }
    }
    return count / words.length;
}

function hasMedicalDisclaimer(html) {
    return /<blockquote>[\s\S]*(?:not a substitute|professional medical|clinical care|medical evaluation|healthcare provider)/i.test(html);
}

function hasKeyTakeaways(html) {
    return /<h2[^>]*>[^<]*key takeaway/i.test(html);
}

/**
 * @param {object} post
 * @param {object} [options]
 * @param {boolean} [options.strict] - treat recommendations as errors (new post generation)
 * @param {Array<{ slug: string, title: string }>} [options.otherPosts]
 */
function auditBlogPost(post, options = {}) {
    const { strict = false, otherPosts = [] } = options;
    const critical = [];
    const quality = [];
    const warnings = [];
    const content = String(post.content || '');
    const plain = stripHtml(content);
    const wordCount = countWords(content);

    const failCritical = (condition, message) => {
        if (!condition) {
            critical.push(message);
        }
    };
    const failQuality = (condition, message) => {
        if (!condition) {
            quality.push(message);
        }
    };

    failCritical(content.trim().length > 0, 'content is empty');
    failCritical(!/<h1[\s>]/i.test(content), 'content must not contain <h1>');

    const disallowed = findDisallowedTags(content);
    if (disallowed.length > 0) {
        critical.push(`disallowed HTML tags: ${disallowed.join(', ')}`);
    }

    for (const issue of findSuspiciousAttributes(content)) {
        critical.push(issue);
    }
    for (const issue of findMalformedListMarkup(content)) {
        critical.push(issue);
    }

    if (FOREIGN_SCRIPT_RE.test(plain)) {
        critical.push('non-English script characters detected in body text (CJK, Hebrew, Arabic, Cyrillic, etc.)');
    }
    if (GARBAGE_TOKEN_RE.test(plain)) {
        critical.push('garbled or hallucinated tokens detected in body text');
    }

    failQuality(wordCount >= WORD_COUNT_MIN, `content too short: ${wordCount} words (min ${WORD_COUNT_MIN})`);
    if (wordCount > WORD_COUNT_MAX) {
        warnings.push(`content long: ${wordCount} words (target ≤ ${WORD_COUNT_MAX})`);
    }

    if (AI_PHRASE_RE.test(plain)) {
        quality.push('AI-style phrasing detected (unpack, delve, in conclusion, etc.)');
    }

    const emDashCount = (content.match(new RegExp(EM_DASH, 'g')) || []).length;
    const emDashRate = wordCount > 0 ? (emDashCount / wordCount) * 1000 : 0;
    if (emDashRate > EM_DASH_MAX_PER_1K_WORDS) {
        quality.push(`too many em dashes: ${emDashCount} (${emDashRate.toFixed(1)} per 1k words, max ${EM_DASH_MAX_PER_1K_WORDS})`);
    }

    const primaryKeyword = guessPrimaryKeyword(post);
    const density = keywordDensity(content, primaryKeyword);
    if (primaryKeyword && density > PRIMARY_KEYWORD_MAX_DENSITY) {
        quality.push(`possible keyword stuffing: "${primaryKeyword}" density ${(density * 100).toFixed(1)}% (max ${(PRIMARY_KEYWORD_MAX_DENSITY * 100).toFixed(1)}%)`);
    }

    failQuality(hasMedicalDisclaimer(content), 'missing medical disclaimer <blockquote>');
    failQuality(hasKeyTakeaways(content), 'missing "Key takeaways" <h2> section');

    const faqItems = Array.isArray(post.faq) ? post.faq.filter((f) => f?.question && f?.answer) : [];
    failQuality(faqItems.length >= 4, `FAQ section weak: ${faqItems.length} items (target 4–6 for GEO)`);

    const linkCheck = findInternalLinkIssues(content);
    critical.push(...linkCheck.issues);
    warnings.push(...linkCheck.warnings);

    if (post.title && post.title.length > BLOG_TITLE_HARD_MAX) {
        quality.push(`title too long: ${post.title.length} chars (max ${BLOG_TITLE_HARD_MAX} before " | DRMN Blog")`);
    }

    if (post.description) {
        const len = post.description.trim().length;
        if (len < DESCRIPTION_MIN || len > DESCRIPTION_MAX) {
            quality.push(`meta description length ${len} (target ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`);
        }
    } else {
        critical.push('missing meta description');
    }

    if (post.excerpt && post.description && normalizeCompareText(post.excerpt) === normalizeCompareText(post.description)) {
        warnings.push('excerpt duplicates meta description');
    }

    if (!post.hero?.alt?.trim()) {
        critical.push('missing hero.alt');
    }

    const similar = otherPosts.filter((other) => other.slug !== post.slug && titlesTooSimilar(post.title, other.title));
    for (const match of similar) {
        warnings.push(`title may cannibalize existing post "${match.slug}" (${match.title})`);
    }

    const unhedgedStats = [...plain.matchAll(/\b(?:increase|decrease|reduce|boost|improve)[sd]? by \d{1,3}\s*%/gi)];
    if (unhedgedStats.length > 2) {
        warnings.push(`multiple unhedged percentage claims (${unhedgedStats.length}) — cite sources or soften language`);
    }

    const errors = [...critical, ...(strict ? quality : [])];
    const allWarnings = strict ? warnings : [...quality, ...warnings];
    const score = Math.max(0, 100 - critical.length * 20 - quality.length * 8 - warnings.length * 3);

    return {
        ok: critical.length === 0 && (strict ? quality.length === 0 : true),
        critical,
        quality,
        errors,
        warnings: allWarnings,
        score,
        metrics: {
            wordCount,
            emDashCount,
            faqCount: faqItems.length,
            internalLinkCount: (content.match(/href=["']\/blog\//g) || []).length,
            primaryKeyword,
            keywordDensity: density
        }
    };
}

function validateBlogPostContent(post, options = {}) {
    return auditBlogPost(post, options);
}

function parsePostSlugFromUrl(input) {
    const value = String(input).trim();
    if (!value) {
        return null;
    }
    const slugOnly = value.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (slugOnly) {
        return slugOnly[0];
    }
    try {
        const url = new URL(value.includes('://') ? value : `https://drmn.xyz${value.startsWith('/') ? value : `/${value}`}`);
        const match = url.pathname.match(/\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
        return match ? match[1] : null;
    } catch {
        const pathMatch = value.match(/\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?/);
        return pathMatch ? pathMatch[1] : null;
    }
}

module.exports = {
    ALLOWED_CONTENT_TAGS,
    BLOG_TITLE_HARD_MAX,
    DESCRIPTION_MIN,
    DESCRIPTION_MAX,
    WORD_COUNT_MIN,
    auditBlogPost,
    validateBlogPostContent,
    stripHtml,
    countWords,
    titlesTooSimilar,
    parsePostSlugFromUrl,
    guessPrimaryKeyword
};
