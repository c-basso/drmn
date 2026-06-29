'use strict';

const { SITE_URL, APP_STORE_URL } = require('../build/constants');
const {
  ARCHETYPE_IDS,
  buildArchetypeStyleRules,
  formatArchetypeCatalog,
  getArchetype,
  getRecentArchetypeIds,
} = require('./telegraph-article-archetypes');

const SITE_LINK = SITE_URL.replace(/\/$/, '');
const BLOG_LINK = `${SITE_LINK}/blog/`;
const APP_LINK = APP_STORE_URL;

const SITE_CONTEXT = `DRMN (drmn.xyz) is an iOS app for sleep and focus sounds. Telegraph posts are part of an SEO experiment.
Readers and search engines reward depth, evidence, and unique angles — not thin listicles or sales copy.
Each post should read like a distinct article — not the same template with swapped keywords.`;

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
  const lines = inlineImages
    .map((img, i) => `Image ${i + 1}: <img src="${img.url}" alt="${img.alt}">`)
    .join('\n');
  return `Stock photos — you have NOT seen them. Embed each tag exactly; use the alt as given. Do NOT add captions or prose describing what is in the photo.\n${lines}`;
}

function buildStyleRules(metadata) {
  const archetypeRules = buildArchetypeStyleRules(metadata.articleArchetype);

  return `Writing style — VALUE FIRST:
- Expert, calm explainer tone — like a sleep-science writer, NOT a product landing page.
- ~900–1,300 words in the HTML body. Short posts feel thin; aim for real depth.
- American English. Second person ("you") where natural.
- Include a unique angle: a personal mini-experiment, a counter-intuitive takeaway, or a niche use case most articles skip.
- Prefer qualitative, experiential language ("noticeably calmer", "low volume", "a few nights", "gentler pulsing") over precise measurements. Do NOT invent exact statistics, percentages, dB levels, Hz values, or lab-style figures.
- Hedge clinical claims ("research suggests", "in one study", "many listeners report") without citing made-up numbers.
- Mention "DRMN" or the app at most ONCE in the body before the final CTA paragraph — prefer "a sleep-sounds app" or "your audio player" elsewhere.
- Do NOT use hype words: "game-changer", "transform", "secret weapon", "must-have", "download now" (except the very last line).

${archetypeRules}

Content pillars — include ALL somewhere in the article, but order and shape follow the archetype above:
- Concrete mini-experiment, listener scenario, or A/B log (a few nights or several evenings with volume, sound type, timing described in plain language). Subjective impressions only — no fabricated clinical trials or fake metrics.
- Science/mechanism section explaining frequencies, masking, or entrainment in accessible prose — concepts over numbers.
- Practical guidance: at least one <ul> or <ol>, unless the archetype explicitly limits lists (then embed steps in prose).
- One <blockquote> with a brief medical disclaimer.
- BOTH inline images on their own line near relevant sections — use the provided <img> tags exactly.
- Do NOT add captions under images. You have not seen these Unsplash photos — never write <p><em>…</em></p> (or similar) claiming what the photo shows (waveforms, spectrograms, bedside setups, etc.).
- Keep <img alt="…"> generic and mood-based; do not describe specific visible details in alt text or surrounding prose.
- At least one link to ${SITE_LINK} somewhere in the body (homepage or blog) — woven naturally, no standalone "Related reading" heading.

Heading rules — IMPORTANT:
- <h3> titles must be specific, natural, and topic-driven (e.g. "Why the slower pulse felt easier to ignore", "If your partner hears every tick").
- NEVER use template labels like "Hook + Search Intent", "Mini-Experiment / Field Notes", "Why It Works (Science With Numbers)", "Related Reading", or "[INLINE IMAGE …]".
- Vary heading length and rhythm across sections. Some posts may use <h4> subheads inside a section.

Internal linking:
- Include at least one absolute link to ${SITE_LINK} in the article body (homepage or a blog article — ${SITE_LINK}/blog/SLUG/ when relevant).
- Blog links are optional extras — use only where they fit naturally.
- Cross-links to other Telegraph articles are optional — add one only if it fits naturally.
- Use natural anchor text — not "click here". Weave links into sentences.

HTML rules:
- Return ONLY valid HTML fragments — no markdown.
- Allowed tags: <p>, <h3>, <h4>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <a>, <img>.
- Do NOT use <h1> or <h2>. Start with 1–3 intro <p> paragraphs (count varies by archetype).
- End with ONE short CTA <p> only. The LAST paragraph ONLY may include:
  - <a href="${SITE_LINK}">DRMN website</a> — NEVER a bare URL
  - <a href="${APP_LINK}">App Store</a> — NEVER a bare App Store URL
- No competing apps. No fabricated study citations with author names.`;
}

function buildJsonMetadataSchema(recentArchetypeIds) {
  return `Respond with a single JSON object only — no markdown fences. Schema:
{
  "slug": "kebab-case-url-slug (3–6 words, lowercase, must START with a letter — e.g. cognitive-effects-40hz, not 40hz-cognitive-effects)",
  "title": "SEO headline with primary keyword, 45–70 characters — no fake percentages or precise measurements in the title",
  "description": "Meta summary, 140–160 characters",
  "excerpt": "1 sentence hook",
  "tags": ["4 to 6 lowercase SEO tags"],
  "uniqueAngle": "1 sentence — what makes this post different from existing coverage",
  "articleArchetype": "one of: ${ARCHETYPE_IDS.join(' | ')} — pick the best fit for the topic; avoid recently used archetypes when another works equally well",
  "readingTimeMinutes": 8,
  "unsplashSearchQuery": "REQUIRED hero image. 4–6 words. Prefer specific scenes: waveform monitor, spectrogram screen, headphones on nightstand, sleep tracker graph — NOT generic cozy bedroom if overused.",
  "hero": { "alt": "Brief accessibility alt — topic mood only; do not describe specific objects or scene details" },
  "inlineImages": [
    {
      "unsplashSearchQuery": "4–6 words for a SUPPORTING visual — e.g. audio waveform display, frequency spectrum, sleep diary notebook, sound equalizer",
      "alt": "Generic alt for accessibility — mood or topic, not a claim about what the photo contains",
      "placement": "which section this supports — match the planned outline, not a fixed slot"
    },
    {
      "unsplashSearchQuery": "different query from image 1 — e.g. dim bedroom speaker, noise meter reading, meditation timer",
      "alt": "Generic alt — mood or topic only",
      "placement": "which section — should differ from image 1 placement"
    }
  ],
  "sectionOutline": ["5–10 specific reader-facing section headings tailored to articleArchetype — natural titles only, never template labels"]
}

Available article archetypes (vary structure across the Telegraph series):
${formatArchetypeCatalog(recentArchetypeIds)}`;
}

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

  const recentArchetypeIds = getRecentArchetypeIds(existingPosts);

  const topicInstruction = topic
    ? `Plan a deep Telegraph article about: ${topic}`
    : `Pick ONE fresh topic with a specific angle (not covered below). Prefer topics where you can describe a mini-experiment, compare sound types, or explain a mechanism in plain language.`;

  const feedbackBlock = validationFeedback
    ? `\nPREVIOUS DRAFT FAILED VALIDATION — fix these issues:\n${validationFeedback}\n`
    : '';

  const archetypeHint = recentArchetypeIds.length
    ? `\nRecently used archetypes (prefer a different one unless the topic strongly demands it): ${recentArchetypeIds.join(', ')}\n`
    : '';

  return `You are an editorial planner for DRMN Telegraph posts.

${SITE_CONTEXT}
${feedbackBlock}
${topicInstruction}
${archetypeHint}
Existing Telegraph posts (do NOT duplicate slug or angle):
${existingList}

Main blog (Telegraph posts should complement, not duplicate — link TO these where relevant):
${blogList}

Plan metadata only — no article HTML yet.
Every field required, especially articleArchetype, inlineImages (2 items with distinct unsplashSearchQuery), uniqueAngle, and hero.alt.
sectionOutline headings must match the chosen articleArchetype and sound like real magazine section titles.

${buildJsonMetadataSchema(recentArchetypeIds)}`;
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

  const archetype = getArchetype(metadata.articleArchetype);

  const feedbackBlock = validationFeedback
    ? `\nFIX THESE VALIDATION ERRORS FROM THE PREVIOUS DRAFT:\n${validationFeedback}\n`
    : '';

  return `You are a depth-first science writer for DRMN Telegraph posts.

${SITE_CONTEXT}
${feedbackBlock}
Write the full article HTML for:

Title: ${metadata.title}
Slug: ${metadata.slug}
Article archetype: ${archetype.label} (${archetype.id})
Unique angle: ${metadata.uniqueAngle || '(apply a fresh perspective)'}
Tags: ${(metadata.tags || []).join(', ')}

Planned sections (follow this order and these exact headings):
${outline || '(derive headings from the archetype — still use natural titles only)'}

${buildStyleRules(metadata)}

Inline images — embed BOTH exactly as shown (full <img> tag on its own line). No captions afterward:
${formatInlineImageCatalog(inlineImages)}

Blog articles you may link when relevant (optional):
${formatBlogLinkCatalog(blogPosts)}

Other Telegraph articles (optional cross-links — use only if relevant):
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
