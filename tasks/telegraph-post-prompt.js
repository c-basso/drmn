'use strict';

const { SITE_URL, APP_STORE_URL } = require('../build/constants');

const SITE_LINK = SITE_URL.replace(/\/$/, '');
const APP_LINK = APP_STORE_URL;

const SITE_CONTEXT = `DRMN is an iOS app that helps users fall asleep faster and stay focused with sleep and focus sounds (white noise, rain, brown noise, nature loops).
Telegraph posts are short SEO articles for Telegram Instant View and search — practical, readable, with a clear link back to ${SITE_LINK} at the end.`;

const STYLE_RULES = `Writing style:
- Clear, helpful SEO article — not a sales pitch, but ends with a natural CTA to visit the site.
- Second person ("you") where natural; short paragraphs; concrete tips.
- ~500–900 words in the HTML body (shorter than the main blog — optimized for Telegraph reading).
- American English spelling.
- Target a specific search intent (e.g. "brown noise for sleep", "rain sounds focus").

HTML content rules:
- Return ONLY valid HTML fragments — no markdown.
- Allowed tags: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <a>.
- Do NOT use <h1> or <h2>. Start with 1–2 intro <p> paragraphs, then <h3> sections.
- Typical structure:
  1. Hook intro (1–2 short paragraphs with primary keyword)
  2. Why it works (<h3>)
  3. Practical tips or what to try (<h3> with <ul>)
  4. Common mistakes (<h3>)
  5. One <blockquote> with a brief medical disclaimer
  6. Final <h3> "Try it tonight" or similar — closing <p> with links to ${SITE_LINK} and the iOS app (${APP_LINK})
- The LAST paragraph MUST include:
  - An <a href="${SITE_LINK}">DRMN website</a> link — NEVER paste a bare URL like ${SITE_LINK}
  - An <a href="${APP_LINK}">App Store</a> link — NEVER paste a bare App Store URL
- Do NOT link to competing apps. No external study URLs unless essential.
- Do NOT duplicate angles from existing Telegraph or blog posts listed below.`;

const JSON_METADATA_SCHEMA = `Respond with a single JSON object only — no markdown fences, no commentary. Schema:
{
  "slug": "kebab-case-url-slug (3–6 words, lowercase, hyphens only)",
  "title": "SEO headline with primary keyword, 40–65 characters",
  "description": "Meta-style summary, 120–155 characters",
  "excerpt": "1 sentence hook for internal records",
  "tags": ["3 to 5 lowercase SEO tags"],
  "unsplashSearchQuery": "REQUIRED. 3–6 specific English words for a horizontal hero on Unsplash. Vary scenes — not generic bedroom shots if similar posts exist.",
  "hero": {
    "alt": "Descriptive accessible alt text (no 'image of' prefix)"
  },
  "sectionOutline": [
    "Short label for each planned h3 section in order (5–7 sections including closing CTA)"
  ]
}`;

/**
 * @param {{ topic?: string, existingPosts: Array<{ slug: string, title: string }>, blogPosts: Array<{ slug: string, title: string }> }}
 */
function buildTelegraphPostMetadataPrompt({ topic, existingPosts, blogPosts }) {
  const existingList = existingPosts.length
    ? existingPosts.map((p) => `- ${p.slug}: ${p.title}`).join('\n')
    : '(none yet)';

  const blogList = blogPosts.length
    ? blogPosts.slice(0, 20).map((p) => `- ${p.slug}: ${p.title}`).join('\n')
    : '(none)';

  const topicInstruction = topic
    ? `Write a new Telegraph SEO article about: ${topic}`
    : `Pick ONE fresh SEO topic about sleep sounds, focus audio, white/pink/brown noise, nature sounds, or sound masking. Angle should differ from existing Telegraph posts and not simply repeat a blog article.`;

  return `You are an SEO content planner for DRMN Telegraph posts.

${SITE_CONTEXT}

${topicInstruction}

Existing Telegraph posts (do NOT duplicate slug or angle):
${existingList}

Main blog articles (avoid duplicating these angles — Telegraph posts should be shorter, distinct takes):
${blogList}

Plan metadata only — do NOT write article body HTML yet.

Every field in the schema is required — especially "unsplashSearchQuery" and "hero.alt".

${JSON_METADATA_SCHEMA}`;
}

/**
 * @param {object} metadata
 * @param {Array<{ slug: string, title: string }>} existingPosts
 */
function buildTelegraphPostContentPrompt(metadata, existingPosts) {
  const outline = (metadata.sectionOutline || [])
    .map((section, index) => `${index + 1}. ${section}`)
    .join('\n');

  return `You are an SEO writer for DRMN Telegraph posts.

${SITE_CONTEXT}

Write the full article HTML body for this planned post:

Title: ${metadata.title}
Slug: ${metadata.slug}
Tags: ${(metadata.tags || []).join(', ')}

Planned sections:
${outline}

${STYLE_RULES}

Existing Telegraph posts (do not repeat):
${existingPosts.map((p) => `- ${p.slug}: ${p.title}`).join('\n') || '(none)'}

Output ONLY raw HTML — no JSON, no markdown fences, no preamble. Start with <p> and end with </p> that includes links to ${SITE_LINK} and ${APP_LINK}.`;
}

module.exports = {
  buildTelegraphPostMetadataPrompt,
  buildTelegraphPostContentPrompt,
  SITE_LINK,
  APP_LINK,
};
