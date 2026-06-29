'use strict';

const { findTemplateHeadings, hasImageCaptions } = require('./telegraph-article-archetypes');
const { SITE_LINK } = require('./telegraph-post-prompt');

const MIN_WORDS = 750;
const MIN_SITE_LINKS = 1;
const MIN_INLINE_IMAGES = 2;
const SITE_LINK_PATTERN = /href=["']https:\/\/drmn\.xyz(?:\/[^"']*)?["']/gi;
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
 */
function validateTelegraphContent(html) {
  const words = countWords(html);
  const siteLinks = countPattern(html, SITE_LINK_PATTERN);
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
  if (siteLinks < MIN_SITE_LINKS) {
    errors.push(`need ≥${MIN_SITE_LINKS} link to ${SITE_LINK} (found ${siteLinks})`);
  }
  if (inlineImages < MIN_INLINE_IMAGES) {
    errors.push(`need ≥${MIN_INLINE_IMAGES} inline <img> tags (found ${inlineImages})`);
  }
  if (drmnMentions > MAX_DRMN_MENTIONS) {
    errors.push(`too promotional (${drmnMentions} "DRMN" mentions, max ${MAX_DRMN_MENTIONS})`);
  }

  const templateHeadings = findTemplateHeadings(html);
  if (templateHeadings.length) {
    errors.push(
      `section headings look like the old template (${templateHeadings.slice(0, 2).join('; ')}) — use natural topic-specific <h3> titles`,
    );
  }

  if (hasImageCaptions(html)) {
    errors.push('remove captions under images — do not describe photo contents you have not seen');
  }

  return {
    words,
    siteLinks,
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
