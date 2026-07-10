'use strict';

const { SITE_URL, APP_STORE_URL } = require('../constants');
const {
  findTemplateHeadings,
  hasImageCaptions,
  ARCHETYPE_IDS,
} = require('../../tasks/telegraph-article-archetypes');
const {
  stripHtml,
  countWords,
  titlesTooSimilar,
} = require('./blogPostContentQuality');

const SITE_LINK = SITE_URL.replace(/\/$/, '');
const ALLOWED_CONTENT_TAGS = new Set([
  'p', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'a', 'img',
]);

const STANDARD_HTML_ATTRS = new Set([
  'href', 'rel', 'target', 'class', 'id', 'title', 'aria-label', 'src', 'alt',
]);

const FOREIGN_SCRIPT_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0590-\u05ff\u0600-\u06ff\u0400-\u04ff]/;
const AI_PHRASE_RE = /\b(unpack|delve into|in today's|it's worth noting|at its core|in conclusion|to sum up|surprisingly nuanced|game.?changer|dive deep|let's explore|in the realm of|pave the way|a myriad of|paramount|holistic approach|seamless experience|robust solution|cutting.?edge|groundbreaking)\b/i;
const GARBAGE_TOKEN_RE = /\b(enfranchised|investimento|raconteur|theactivator|vs\.?kreis|white\/platform)\b/i;

const EM_DASH = '\u2014';
const TITLE_MIN = 45;
const TITLE_MAX = 70;
const DESCRIPTION_MIN = 140;
const DESCRIPTION_MAX = 160;
const WORD_COUNT_MIN = 750;
const WORD_COUNT_TARGET_MAX = 1500;
const EM_DASH_MAX_PER_1K_WORDS = 5;
const MIN_SITE_LINKS = 1;
const MIN_INLINE_IMAGES = 2;
const MAX_DRMN_MENTIONS = 3;
const SITE_LINK_PATTERN = new RegExp(`href=["']${SITE_LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^"']*)?["']`, 'gi');

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
    if (tag === 'img') {
      continue;
    }
    const attrs = match[2].replace(/="[^"]*"/g, '=""').replace(/='[^']*'/g, "=''");
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

function countPattern(html, pattern) {
  return (String(html).match(pattern) || []).length;
}

function hasMedicalDisclaimer(html) {
  return /<blockquote>[\s\S]*(?:not a substitute|isn['']t a substitute|substitute for (?:medical|clinical)|professional medical|clinical care|medical evaluation|healthcare provider|consult a healthcare)/i.test(html);
}

function hasClosingCta(html) {
  const paragraphs = [...String(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (!paragraphs.length) {
    return false;
  }
  const last = paragraphs[paragraphs.length - 1][1];
  return (
    new RegExp(`href=["']${SITE_LINK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/)?["']`, 'i').test(last)
    && new RegExp(`href=["']${APP_STORE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(last)
  );
}

/**
 * @param {object} post
 * @param {object} [options]
 * @param {boolean} [options.strict]
 * @param {Array<{ slug: string, title: string }>} [options.otherPosts]
 * @param {Array<{ slug: string, title: string }>} [options.blogPosts]
 */
function auditTelegraphPost(post, options = {}) {
  const { strict = false, otherPosts = [], blogPosts = [], contentOnly = false } = options;
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
  failCritical(!/<h2[\s>]/i.test(content), 'content must use <h3>/<h4> only, not <h2>');

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
  if (wordCount > WORD_COUNT_TARGET_MAX) {
    warnings.push(`content long: ${wordCount} words (target ≤ ${WORD_COUNT_TARGET_MAX})`);
  }

  if (AI_PHRASE_RE.test(plain)) {
    quality.push('AI-style phrasing detected (unpack, delve, in conclusion, etc.)');
  }

  const emDashCount = (content.match(new RegExp(EM_DASH, 'g')) || []).length;
  const emDashRate = wordCount > 0 ? (emDashCount / wordCount) * 1000 : 0;
  if (emDashRate > EM_DASH_MAX_PER_1K_WORDS) {
    quality.push(`too many em dashes: ${emDashCount} (${emDashRate.toFixed(1)} per 1k words, max ${EM_DASH_MAX_PER_1K_WORDS})`);
  }

  const siteLinks = countPattern(content, SITE_LINK_PATTERN);
  failQuality(siteLinks >= MIN_SITE_LINKS, `need ≥${MIN_SITE_LINKS} link to ${SITE_LINK} (found ${siteLinks})`);

  const inlineImages = countPattern(content, /<img\b/gi);
  failQuality(inlineImages >= MIN_INLINE_IMAGES, `need ≥${MIN_INLINE_IMAGES} inline <img> tags (found ${inlineImages})`);

  const drmnMentions = countPattern(plain, /\bDRMN\b/gi);
  if (drmnMentions > MAX_DRMN_MENTIONS) {
    quality.push(`too promotional (${drmnMentions} "DRMN" mentions, max ${MAX_DRMN_MENTIONS})`);
  }

  const templateHeadings = findTemplateHeadings(content);
  if (templateHeadings.length) {
    quality.push(
      `section headings look like the old template (${templateHeadings.slice(0, 2).join('; ')}) — use natural topic-specific <h3> titles`,
    );
  }

  if (hasImageCaptions(content)) {
    quality.push('remove captions under images — do not describe photo contents you have not seen');
  }

  failQuality(hasMedicalDisclaimer(content), 'missing medical disclaimer <blockquote>');
  failQuality(hasClosingCta(content), `final <p> must include links to ${SITE_LINK} and the App Store`);

  if (!contentOnly) {
    if (post.title) {
      const titleLen = post.title.trim().length;
      if (titleLen < TITLE_MIN || titleLen > TITLE_MAX) {
        quality.push(`title length ${titleLen} (target ${TITLE_MIN}–${TITLE_MAX})`);
      }
    }

    if (post.description) {
      const len = post.description.trim().length;
      if (len < DESCRIPTION_MIN || len > DESCRIPTION_MAX) {
        quality.push(`meta description length ${len} (target ${DESCRIPTION_MIN}–${DESCRIPTION_MAX})`);
      }
    } else if (strict) {
      quality.push('missing meta description');
    }

    if (!post.uniqueAngle?.trim()) {
      quality.push('missing uniqueAngle — describe what makes this post distinct');
    }

    if (post.articleArchetype && !ARCHETYPE_IDS.includes(post.articleArchetype)) {
      quality.push(`invalid articleArchetype "${post.articleArchetype}"`);
    }

    if (!post.hero?.alt?.trim()) {
      critical.push('missing hero.alt');
    }

    const allComparablePosts = [...otherPosts, ...blogPosts];
    const similar = allComparablePosts.filter(
      (other) => other.slug !== post.slug && titlesTooSimilar(post.title, other.title),
    );
    for (const match of similar) {
      warnings.push(`title may cannibalize existing post "${match.slug}" (${match.title})`);
    }
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
      siteLinks,
      blogLinks: countPattern(content, /href=["']https:\/\/drmn\.xyz\/blog\/[^"']+/gi),
      telegraphLinks: countPattern(content, /href=["']https:\/\/telegra\.ph\/[^"']+/gi),
      inlineImages,
      drmnMentions,
    },
  };
}

function validateTelegraphPostContent(post, options = {}) {
  return auditTelegraphPost(post, options);
}

module.exports = {
  ALLOWED_CONTENT_TAGS,
  TITLE_MIN,
  TITLE_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  WORD_COUNT_MIN,
  auditTelegraphPost,
  validateTelegraphPostContent,
};
