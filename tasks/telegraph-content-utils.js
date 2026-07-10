'use strict';

const { countWords } = require('../build/validate/blogPostContentQuality');
const { auditTelegraphPost, WORD_COUNT_MIN } = require('../build/validate/telegraphPostContentQuality');

/**
 * @param {string} html
 */
function validateTelegraphContent(html) {
  const audit = auditTelegraphPost({ content: html }, { strict: true, contentOnly: true });
  return {
    words: audit.metrics.wordCount,
    siteLinks: audit.metrics.siteLinks,
    blogLinks: audit.metrics.blogLinks,
    telegraphLinks: audit.metrics.telegraphLinks,
    inlineImages: audit.metrics.inlineImages,
    drmnMentions: audit.metrics.drmnMentions,
    errors: audit.errors,
  };
}

module.exports = {
  countWords,
  validateTelegraphContent,
  MIN_WORDS: WORD_COUNT_MIN,
};
