'use strict';

const { SITE_LINK } = require('./telegraph-post-prompt');

const MIN_WORDS = 750;
const MIN_BLOG_LINKS = 2;
const MIN_INLINE_IMAGES = 2;
const MAX_DRMN_MENTIONS = 3;

function countWords(html) {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean).length;
}

function countPattern(html, pattern) {
  return (String(html).match(pattern) || []).length;
}

/**
 * @param {string} html
 * @param {{ publishedTelegraphCount?: number }} [options]
 */
function validateTelegraphContent(html, options = {}) {
  const words = countWords(html);
  const blogLinks = countPattern(html, /href=["']https:\/\/drmn\.xyz\/blog\/[^"']+/gi);
  const telegraphLinks = countPattern(html, /href=["']https:\/\/telegra\.ph\/[^"']+/gi);
  const inlineImages = countPattern(html, /<img\b/gi);
  const drmnMentions = countPattern(
    html.replace(/<[^>]+>/g, ' '),
    /\bDRMN\b/gi,
  );

  const errors = [];
  if (words < MIN_WORDS) {
    errors.push(`too short (${words} words, need ≥${MIN_WORDS})`);
  }
  if (blogLinks < MIN_BLOG_LINKS) {
    errors.push(`need ≥${MIN_BLOG_LINKS} blog links to ${SITE_LINK}/blog/... (found ${blogLinks})`);
  }
  if ((options.publishedTelegraphCount || 0) >= 2 && telegraphLinks < 1) {
    errors.push('need ≥1 cross-link to another Telegraph article');
  }
  if (inlineImages < MIN_INLINE_IMAGES) {
    errors.push(`need ≥${MIN_INLINE_IMAGES} inline <img> tags (found ${inlineImages})`);
  }
  if (drmnMentions > MAX_DRMN_MENTIONS) {
    errors.push(`too promotional (${drmnMentions} "DRMN" mentions, max ${MAX_DRMN_MENTIONS})`);
  }

  return {
    words,
    blogLinks,
    telegraphLinks,
    inlineImages,
    drmnMentions,
    errors,
  };
}

module.exports = {
  countWords,
  validateTelegraphContent,
  MIN_WORDS,
};
