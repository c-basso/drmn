'use strict';

const { SITE_URL, APP_STORE_URL } = require('../build/constants');

const SITE_LINK = SITE_URL.replace(/\/$/, '');
const BLOG_LINK = `${SITE_LINK}/blog/`;
const APP_LINK = APP_STORE_URL;

const SITE_CONTEXT = `DRMN (drmn.xyz) is an iOS app for sleep and focus sounds. Telegraph posts are part of an SEO experiment.
Readers and search engines reward depth, evidence, and unique angles — not thin listicles or sales copy.`;

function formatBlogLinkCatalog(blogPosts) {
  if (!blogPosts.length) return '(no blog posts yet)';
  return blogPosts
    .map((p) => `- ${SITE_LINK}/blog/${p.slug}/ — ${p.title}`)
    .join('\n');
}

function formatTelegraphLinkCatalog(existingPosts, excludeSlug) {
  const published = existingPosts.filter((p) => p.telegraphUrl && p.slug !== excludeSlug);
  if (!published.length) return '(none yet — skip cross-links)';
  return published
    .map((p) => `- ${p.telegraphUrl} — ${p.title}`)
    .join('\n');
}

function formatInlineImageCatalog(inlineImages) {
  if (!inlineImages?.length) return '(images will be provided)';
  return inlineImages
    .map((img, i) => `Image ${i + 1}: <img src="${img.url}" alt="${img.alt}">`)
    .join('\n');
}

const STYLE_RULES = `Writing style — VALUE FIRST:
- Expert, calm explainer tone — like a sleep-science writer sharing field notes, NOT a product landing page.
- ~900–1,300 words in the HTML body. Short posts feel thin; aim for real depth.
- American English. Second person ("you") where natural.
- Include a unique angle: a personal mini-experiment, a counter-intuitive takeaway, or a niche use case most articles skip.
- Use at least 5 specific numbers (dB levels, Hz ranges, minutes, temperatures, percentages). Hedge clinical claims ("research suggests", "in one study", "many listeners report").
- Mention "DRMN" or the app at most ONCE in the body before the final CTA paragraph — prefer "a sleep-sounds app" or "your audio player" elsewhere.
- Do NOT use hype words: "game-changer", "transform", "secret weapon", "must-have", "download now" (except the very last line).

Depth requirements (all mandatory):
1. <h3> section with a concrete mini-experiment or "What I tested" — describe a simple 3–7 night or 5-day protocol with variables (volume, sound type, timing). Report plausible subjective results without fabricating clinical trials.
2. <h3> section citing how the science works — frequencies, masking, or brainwave entrainment with numbers.
3. <h3> "What to try tonight" or practical checklist with an <ol> or <ul>.
4. One <blockquote> with a brief medical disclaimer.
5. Embed BOTH inline images (provided below) on their own line after relevant <h3> sections — add a short <p> caption in <em> after each image describing what the reader is seeing (e.g. frequency curve, sleep setup, waveform concept).

Internal linking (mandatory):
- Link to at least 2 articles on the main blog using absolute URLs: ${SITE_LINK}/blog/SLUG/
- If other Telegraph articles are listed below, cross-link at least 1 where contextually relevant using the full telegra.ph URL.
- Use natural anchor text — not "click here". Weave links into sentences.

HTML rules:
- Return ONLY valid HTML fragments — no markdown.
- Allowed tags: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <a>, <img>.
- Do NOT use <h1> or <h2>. Start with 2 intro <p> paragraphs.
- Section flow (8–10 <h3> sections):
  1. Hook + search intent
  2. Why it works (science with numbers)
  3. Mini-experiment / field notes
  4. Comparison or "what to choose" (<ul>)
  5. Common mistakes
  6. [INLINE IMAGE 1 + caption]
  7. Deeper dive or data table in prose
  8. [INLINE IMAGE 2 + caption]
  9. Related reading (<p> with blog + Telegraph links)
  10. Closing CTA — ONE short <p> only, with subtle app mention
- The LAST paragraph ONLY may include:
  - <a href="${SITE_LINK}">DRMN website</a> — NEVER a bare URL
  - <a href="${APP_LINK}">App Store</a> — NEVER a bare App Store URL
- No competing apps. No fabricated study citations with author names.`;

const JSON_METADATA_SCHEMA = `Respond with a single JSON object only — no markdown fences. Schema:
{
  "slug": "kebab-case-url-slug (3–6 words, lowercase, must START with a letter — e.g. cognitive-effects-40hz, not 40hz-cognitive-effects)",
  "title": "SEO headline with primary keyword, 45–70 characters",
  "description": "Meta summary, 140–160 characters",
  "excerpt": "1 sentence hook",
  "tags": ["4 to 6 lowercase SEO tags"],
  "uniqueAngle": "1 sentence — what makes this post different from existing coverage",
  "readingTimeMinutes": 8,
  "unsplashSearchQuery": "REQUIRED hero image. 4–6 words. Prefer specific scenes: waveform monitor, spectrogram screen, headphones on nightstand, sleep tracker graph — NOT generic cozy bedroom if overused.",
  "hero": { "alt": "Descriptive alt text for hero image" },
  "inlineImages": [
    {
      "unsplashSearchQuery": "4–6 words for a SUPPORTING visual — e.g. audio waveform display, frequency spectrum, sleep diary notebook, sound equalizer",
      "alt": "Alt text describing the educational visual",
      "placement": "which section this supports (e.g. after science section)"
    },
    {
      "unsplashSearchQuery": "different query from image 1 — e.g. dim bedroom speaker, noise meter reading, meditation timer",
      "alt": "Alt text",
      "placement": "which section"
    }
  ],
  "sectionOutline": ["8–10 section labels including experiment, images, and related reading"]
}`;

/**
 * @param {{ topic?: string, existingPosts: Array, blogPosts: Array, validationFeedback?: string }}
 */
function buildTelegraphPostMetadataPrompt({
  topic,
  existingPosts,
  blogPosts,
  validationFeedback,
}) {
  const existingList = existingPosts.length
    ? existingPosts.map((p) => `- ${p.slug}: ${p.title}`).join('\n')
    : '(none yet)';

  const blogList = blogPosts.length
    ? blogPosts.slice(0, 20).map((p) => `- ${p.slug}: ${p.title}`).join('\n')
    : '(none)';

  const topicInstruction = topic
    ? `Plan a deep Telegraph article about: ${topic}`
    : `Pick ONE fresh topic with a specific angle (not covered below). Prefer topics where you can describe a mini-experiment, compare sound types with data, or explain a mechanism with Hz/dB numbers.`;

  const feedbackBlock = validationFeedback
    ? `\nPREVIOUS DRAFT FAILED VALIDATION — fix these issues:\n${validationFeedback}\n`
    : '';

  return `You are an editorial planner for DRMN Telegraph posts.

${SITE_CONTEXT}
${feedbackBlock}
${topicInstruction}

Existing Telegraph posts (do NOT duplicate slug or angle):
${existingList}

Main blog (Telegraph posts should complement, not duplicate — link TO these where relevant):
${blogList}

Plan metadata only — no article HTML yet.
Every field required, especially inlineImages (2 items with distinct unsplashSearchQuery), uniqueAngle, and hero.alt.

${JSON_METADATA_SCHEMA}`;
}

/**
 * @param {object} metadata
 * @param {Array} existingPosts
 * @param {Array} blogPosts
 * @param {Array} inlineImages
 * @param {string} [validationFeedback]
 */
function buildTelegraphPostContentPrompt(
  metadata,
  existingPosts,
  blogPosts,
  inlineImages,
  validationFeedback,
) {
  const outline = (metadata.sectionOutline || [])
    .map((section, index) => `${index + 1}. ${section}`)
    .join('\n');

  const feedbackBlock = validationFeedback
    ? `\nFIX THESE VALIDATION ERRORS FROM THE PREVIOUS DRAFT:\n${validationFeedback}\n`
    : '';

  return `You are a depth-first science writer for DRMN Telegraph posts.

${SITE_CONTEXT}
${feedbackBlock}
Write the full article HTML for:

Title: ${metadata.title}
Slug: ${metadata.slug}
Unique angle: ${metadata.uniqueAngle || '(apply a fresh perspective)'}
Tags: ${(metadata.tags || []).join(', ')}

Planned sections:
${outline}

${STYLE_RULES}

Inline images — embed BOTH exactly as shown (full <img> tag on its own line):
${formatInlineImageCatalog(inlineImages)}

Blog articles to link (pick ≥2, absolute URLs):
${formatBlogLinkCatalog(blogPosts)}

Other Telegraph articles to cross-link (pick ≥1 if listed):
${formatTelegraphLinkCatalog(existingPosts, metadata.slug)}

Existing Telegraph posts (do not repeat their angles):
${existingPosts.map((p) => `- ${p.slug}: ${p.title}`).join('\n') || '(none)'}

Output ONLY raw HTML. Start with <p>, end with the single CTA <p> containing links to ${SITE_LINK} and ${APP_LINK}.`;
}

module.exports = {
  buildTelegraphPostMetadataPrompt,
  buildTelegraphPostContentPrompt,
  formatBlogLinkCatalog,
  formatTelegraphLinkCatalog,
  SITE_LINK,
  BLOG_LINK,
  APP_LINK,
};
