'use strict';

const cheerio = require('cheerio');

const BLOCK_TAGS = new Set(['p', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'pre', 'figure', 'hr']);
const INLINE_TAGS = new Set(['a', 'strong', 'b', 'em', 'i', 'u', 's', 'code']);
const VOID_TAGS = new Set(['br', 'img', 'hr']);

const TAG_MAP = {
  h1: 'h3',
  h2: 'h3',
  h5: 'h4',
  h6: 'h4',
  b: 'strong',
  i: 'em',
};

function normalizeTag(tag) {
  const lower = String(tag || '').toLowerCase();
  return TAG_MAP[lower] || lower;
}

function isAllowedTag(tag) {
  const normalized = normalizeTag(tag);
  return BLOCK_TAGS.has(normalized) || INLINE_TAGS.has(normalized) || VOID_TAGS.has(normalized);
}

function collapseWhitespace(text) {
  return String(text).replace(/\s+/g, ' ');
}

function isBlankText(text) {
  return !collapseWhitespace(text).trim();
}

function isInlineElement(child) {
  return Boolean(child && typeof child === 'object' && INLINE_TAGS.has(child.tag));
}

function trimInlineEdges(children) {
  if (!Array.isArray(children) || !children.length) {
    return children;
  }

  const result = [...children];
  if (typeof result[0] === 'string') {
    result[0] = result[0].replace(/^\s+/, '');
  }
  const last = result.length - 1;
  if (typeof result[last] === 'string') {
    result[last] = result[last].replace(/\s+$/, '');
  }
  return result;
}

function ensureInlineSpacing(children) {
  if (!Array.isArray(children) || children.length < 2) {
    return children;
  }

  const result = [];
  for (const child of children) {
    const prev = result[result.length - 1];

    if (isInlineElement(child) && typeof prev === 'string' && prev && !/\s$/.test(prev)) {
      result[result.length - 1] = `${prev} `;
    }

    if (typeof child === 'string' && isInlineElement(prev) && child && !/^\s/.test(child)) {
      if (/^[,.;:!?%)]/.test(child)) {
        result.push(child);
        continue;
      }
      result.push(` ${child}`);
      continue;
    }

    if (isInlineElement(child) && isInlineElement(prev)) {
      result.push(' ');
    }

    result.push(child);
  }

  return trimInlineEdges(result);
}

function cleanChildren(children, parentTag) {
  const cleaned = [];
  for (const child of children) {
    if (typeof child === 'string') {
      if (isBlankText(child)) continue;
      if (parentTag === 'ul' || parentTag === 'ol') continue;
      cleaned.push(collapseWhitespace(child));
      continue;
    }
    if (child && typeof child === 'object' && child.tag) {
      const finalized = finalizeNode(child);
      if (finalized) cleaned.push(finalized);
    }
  }

  if (parentTag === 'p' || parentTag === 'li' || parentTag === 'blockquote') {
    return ensureInlineSpacing(cleaned);
  }

  return cleaned;
}

function finalizeNode(node) {
  if (!node || typeof node !== 'object' || !node.tag) {
    return node;
  }

  if (node.tag === 'blockquote' && Array.isArray(node.children) && node.children.length === 1) {
    const only = node.children[0];
    if (only?.tag === 'p' && Array.isArray(only.children)) {
      return { tag: 'blockquote', children: cleanChildren(only.children, 'blockquote') };
    }
  }

  if (Array.isArray(node.children)) {
    node.children = cleanChildren(node.children, node.tag);
  }

  if (node.tag === 'ul' || node.tag === 'ol') {
    node.children = (node.children || []).filter((child) => child?.tag === 'li');
  }

  if (node.tag === 'li' && !node.children?.length) {
    return null;
  }

  return node;
}

/**
 * @param {cheerio.CheerioAPI} $
 * @param {import('cheerio').Element} el
 * @returns {string | object | false | null}
 */
function domToNode($, el) {
  if (el.type === 'text') {
    const text = el.data || '';
    return text.length ? text : null;
  }

  if (el.type !== 'tag') {
    return null;
  }

  const tag = normalizeTag(el.tagName);
  if (!isAllowedTag(el.tagName) && !isAllowedTag(tag)) {
    return flattenChildren($, el);
  }

  if (VOID_TAGS.has(tag)) {
    const node = { tag };
    const attrs = {};
    if (tag === 'a' && el.attribs?.href) {
      attrs.href = el.attribs.href;
    }
    if (tag === 'img' && el.attribs?.src) {
      attrs.src = el.attribs.src;
    }
    if (Object.keys(attrs).length) {
      node.attrs = attrs;
    }
    return node;
  }

  const children = [];
  for (const child of el.children || []) {
    const converted = domToNode($, child);
    if (converted === false) {
      continue;
    }
    if (Array.isArray(converted)) {
      children.push(...converted);
    } else if (converted !== null && converted !== undefined && converted !== '') {
      children.push(converted);
    }
  }

  const node = { tag };
  if (tag === 'a' && el.attribs?.href) {
    node.attrs = { href: el.attribs.href };
  }

  if (children.length) {
    node.children = cleanChildren(children, tag);
  } else if (BLOCK_TAGS.has(tag) && tag !== 'ul' && tag !== 'ol') {
    node.children = [''];
  }

  const finalized = finalizeNode(node);
  if (!finalized) {
    return null;
  }
  return finalized;
}

/**
 * @param {cheerio.CheerioAPI} $
 * @param {import('cheerio').Element} el
 * @returns {Array<string | object>}
 */
function flattenChildren($, el) {
  const out = [];
  for (const child of el.children || []) {
    const converted = domToNode($, child);
    if (converted === false) continue;
    if (Array.isArray(converted)) {
      out.push(...converted);
    } else if (converted !== null && converted !== undefined && converted !== '') {
      out.push(converted);
    }
  }
  return out;
}

/**
 * @param {string} html
 * @returns {string}
 */
function ensureClickableLinks(html) {
  let out = String(html);
  const hasSiteLink = /<a\b[^>]*href=["']https:\/\/drmn\.xyz\/?["']/i.test(out);
  const hasAppLink = /<a\b[^>]*href=["']https:\/\/apps\.apple\.com\/app\/id6746480683["']/i.test(out);

  if (!hasSiteLink) {
    out = out.replace(
      /https:\/\/drmn\.xyz\/?/gi,
      '<a href="https://drmn.xyz">DRMN website</a>',
    );
  }
  if (!hasAppLink) {
    out = out.replace(
      /https:\/\/apps\.apple\.com\/app\/id6746480683/gi,
      '<a href="https://apps.apple.com/app/id6746480683">App Store</a>',
    );
  }
  return out;
}

/**
 * @param {string} html
 * @param {{ heroImageUrl?: string, heroAlt?: string }} [options]
 * @returns {Array<string | object>}
 */
function htmlToTelegraphNodes(html, options = {}) {
  const wrapped = `<body>${ensureClickableLinks(String(html).trim())}</body>`;
  const $ = cheerio.load(wrapped, { xml: false });
  const nodes = [];

  if (options.heroImageUrl) {
    nodes.push({
      tag: 'img',
      attrs: { src: options.heroImageUrl },
    });
    if (options.heroAlt) {
      nodes.push({
        tag: 'p',
        children: [{ tag: 'em', children: [options.heroAlt] }],
      });
    }
  }

  $('body').children().each((_, el) => {
    const converted = domToNode($, el);
    if (converted === false) return;
    if (Array.isArray(converted)) {
      nodes.push(...converted);
    } else if (converted) {
      nodes.push(converted);
    }
  });

  return nodes;
}

module.exports = {
  ensureClickableLinks,
  htmlToTelegraphNodes,
};
