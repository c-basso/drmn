'use strict';

const SITE_CONTEXT = `DRMN is an iOS app that helps users fall asleep faster and stay focused by listening to sleep and focus sounds (white noise, rain, brown noise, nature loops, etc.).
The blog promotes the app indirectly — practical science-backed guides, not sales copy.`;

const STYLE_RULES = `Writing style (match existing DRMN blog posts):
- Expert, calm, practical tone — like a good sleep-science explainer, not marketing hype.
- Second person ("you") where natural; short paragraphs (2–4 sentences); concrete numbers when useful (e.g. 40–50 dB).
- ~1,200–1,800 words in the HTML body (roughly 7–9 minute read).
- Use em dashes sparingly (max ~1 per 300 words). Prefer commas or periods.
- American English spelling.
- Sound human: avoid AI tells (unpack, delve, in conclusion, surprisingly, game-changer, in today's, at its core).
- Never insert non-English characters, gibberish tokens, or hallucinated words.
- Do not invent precise statistics (e.g. "15% more deep sleep") without hedging ("some studies suggest", "evidence is mixed").
- Vary vocabulary — do not repeat the primary keyword in every paragraph (density under ~3.5%).

SEO rules:
- One clear search intent per post; title + description + H2s must align.
- Meta description: 150–160 characters, includes primary keyword, no hype.
- Title ≤73 characters (blog adds " | DRMN Blog").
- Differentiate from existing posts — no cannibalization of the same angle.
- Include 2–4 internal links: href="/blog/slug/" with trailing slash.
- Include <h2>Key takeaways</h2> with 4–5 bullets.

GEO rules (AI search / citations):
- First paragraph must define the topic in 1–2 clear sentences (entity clarity).
- Add quotable, standalone facts — specific numbers where honest, otherwise qualitative.
- FAQ is required (see JSON schema) — questions phrased how users ask ChatGPT/Perplexity.
- Use lists and tables for comparisons where helpful.
- Neutral, factual tone — not sales copy.

HTML content rules:
- Return ONLY valid HTML fragments for the "content" field — no markdown.
- Allowed tags: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote>, <a>, and for comparisons <table>, <thead>, <tbody>, <tr>, <th>, <td>.
- Do NOT use <h1>. Start with 1–2 intro <p> paragraphs, then <h2> sections.
- Do NOT add custom HTML attributes (no gru=, id=, class= on body tags).
- Every <ul>/<ol> must contain only proper <li> children — no loose text in lists.
- Typical structure:
  1. Hook intro with clear definition (2 short paragraphs)
  2. Why it works (science/psychology, with <h2>)
  3. Comparisons or "what to choose" (<h2>, often with <ul> or <table>)
  4. What to avoid (<h2>)
  5. Practical setup: volume, timing, devices (<h2>)
  6. One <blockquote> with a medical disclaimer (sleep/focus audio supports habits; not a substitute for clinical care)
  7. Simple routine / checklist (<h2> with <ol> or <ul>)
  8. Brief links to related DRMN blog articles (<p> with <a href="/blog/SLUG/">)
  9. "Key takeaways" (<h2> + <ul> with 4–5 bullets)
  10. Closing <p> — calm summary, optional soft mention of phone app / sound machine / speaker
- Internal links MUST use relative paths: href="/blog/slug-here/" (trailing slash).
- Do NOT link to external URLs unless absolutely necessary for a cited study; prefer no external links.
- Do NOT mention competing apps by name.`;

const JSON_METADATA_SCHEMA = `Respond with a single JSON object only — no markdown fences, no commentary. Schema:
{
  "slug": "kebab-case-url-slug (3–6 words, lowercase, hyphens only)",
  "title": "Human-readable headline (Title: Subtitle pattern). Must NOT be the slug, NOT '... Guide' alone, ≤73 characters (blog adds ' | DRMN Blog'; hard max 85 total)",
  "description": "Meta description, 150–160 characters, includes primary keyword",
  "excerpt": "1–2 sentences for the blog index card — engaging, specific, not duplicate of description",
  "tags": ["4 to 6 lowercase SEO tags"],
  "readingTimeMinutes": 7,
  "unsplashSearchQuery": "REQUIRED. 3–6 specific English words for a unique horizontal landscape hero on Unsplash. Vary the scene — do NOT reuse generic queries like \"cozy bedroom night\" if similar posts already exist. Examples: \"rain window bedroom night\", \"headphones pillow soft light\", \"desk lamp focus workspace\"",
  "hero": {
    "alt": "Descriptive accessible alt text for the hero image (no 'image of' prefix)"
  },
  "sectionOutline": [
    "Short label for each planned h2 section in order (8–10 sections including Key takeaways)"
  ],
  "faq": [
    {
      "question": "Natural-language question users ask AI search (include primary keyword)",
      "answer": "Direct 2–4 sentence answer — quotable, factual, no hype"
    }
  ]
}`;

/**
 * @param {{
 *   topic?: string,
 *   keywordTopic?: object,
 *   existingPosts: Array<{ slug: string, title: string }>,
 *   formatTopicForPrompt?: (topic: object) => string,
 * }}
 */
function buildBlogPostMetadataPrompt({
  topic,
  keywordTopic,
  existingPosts,
  formatTopicForPrompt,
}) {
  const existingList = existingPosts.length
    ? existingPosts.map((p) => `- ${p.slug}: ${p.title}`).join('\n')
    : '(none yet)';

  let topicInstruction;
  if (topic) {
    topicInstruction = `Write a new blog article about: ${topic}`;
    if (keywordTopic && formatTopicForPrompt) {
      topicInstruction += `\n\n${formatTopicForPrompt(keywordTopic)}`;
    }
  } else if (keywordTopic) {
    topicInstruction = `Write a new blog article for this planned editorial topic:\n${keywordTopic.topicPrompt || keywordTopic.primaryKeyword}`;
    if (formatTopicForPrompt) {
      topicInstruction += `\n\n${formatTopicForPrompt(keywordTopic)}`;
    }
  } else {
    topicInstruction =
      'Pick ONE fresh article topic for the DRMN blog about sleep sounds, focus audio, white/pink/brown noise, nature sounds, sound masking, or sleep hygiene. Do NOT duplicate any existing slug or angle.';
  }

  const primaryKeywordRule = keywordTopic?.primaryKeyword
    ? `\n- Primary keyword "${keywordTopic.primaryKeyword}" must appear in title, description, first paragraph, and at least one FAQ question.`
  : '';

  return `You are an editorial planner for the DRMN blog.

${SITE_CONTEXT}

${topicInstruction}

Existing articles (do NOT duplicate slug or heavily overlap topic):
${existingList}

Plan metadata only — do NOT write article body HTML yet.

Every field in the schema is required — especially "unsplashSearchQuery", "hero.alt", and "faq" (4–6 items).${primaryKeywordRule}

${JSON_METADATA_SCHEMA}`;
}

/**
 * @param {object} metadata
 * @param {Array<{ slug: string, title: string }>} existingPosts
 * @param {object} [keywordTopic]
 */
function buildBlogPostContentPrompt(metadata, existingPosts, keywordTopic) {
  const existingList = existingPosts
    .map((p) => `- /blog/${p.slug}/ — ${p.title}`)
    .join('\n');

  const outline = (metadata.sectionOutline || [])
    .map((section, index) => `${index + 1}. ${section}`)
    .join('\n');

  return `You are an editorial writer for the DRMN blog.

${SITE_CONTEXT}

Write the full article HTML body for this planned post:

Title: ${metadata.title}
Slug: ${metadata.slug}
Tags: ${(metadata.tags || []).join(', ')}
${keywordTopic?.primaryKeyword ? `Primary keyword: ${keywordTopic.primaryKeyword}` : ''}
${keywordTopic?.secondaryKeywords?.length ? `Secondary keywords: ${keywordTopic.secondaryKeywords.join(', ')}` : ''}

Planned sections:
${outline}

Planned FAQ (${(metadata.faq || []).length} items — also rendered as FAQPage schema):
${(metadata.faq || []).map((f) => `- Q: ${f.question}`).join('\n') || '(none)'}

${STYLE_RULES}

Existing posts you may link to (use relative href="/blog/SLUG/"):
${existingList}

Output ONLY raw HTML — no JSON, no markdown fences, no preamble or closing remarks outside the HTML. Start with <p> and end with </p>.`;
}

module.exports = {
  buildBlogPostPrompt: buildBlogPostMetadataPrompt,
  buildBlogPostMetadataPrompt,
  buildBlogPostContentPrompt,
  SITE_CONTEXT,
  STYLE_RULES,
};
