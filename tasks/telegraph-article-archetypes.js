'use strict';

const ARTICLE_ARCHETYPES = [
  {
    id: 'field-notes',
    label: 'Field notes',
    summary: 'Lead with a personal mini-experiment or A/B log, then unpack the mechanism.',
    sectionCount: '6–8',
    opening: 'Open with a concrete subjective result or surprising observation from a short home test — not a generic question.',
    structure: `- Mix dated or night-by-night observations with interpretation
- Put the experiment early (within the first third), not as a late "methods" section
- Use short sub-sections (<h4>) inside longer stretches if helpful
- Weave blog links into analysis paragraphs, not a dedicated "related reading" block`,
  },
  {
    id: 'deep-dive',
    label: 'Deep dive',
    summary: 'Mechanism-first explainer with long prose blocks and fewer bullet lists.',
    sectionCount: '5–7',
    opening: 'Open with a clear claim about how sound affects sleep or focus, supported by reasoning — not a statistic.',
    structure: `- One extended science section (2–4 paragraphs) before any checklist
- At most two bullet lists in the whole article
- Include a "where this breaks down" or limitations paragraph
- Images should illustrate concepts mid-article, not always after a list section`,
  },
  {
    id: 'comparison',
    label: 'Comparison guide',
    summary: 'Help the reader choose between sound types, frequencies, or setups.',
    sectionCount: '7–9',
    opening: 'Open by naming the decision ("pink vs brown noise", "headphones vs speaker", etc.) and who each option suits.',
    structure: `- Use comparison lists, but vary format: sometimes <ul>, sometimes paired <p> blocks, occasionally a short <ol> ranking
- Include a "when to switch" or "red flags" section instead of a generic mistakes list
- Mini-experiment can be a quick 3-night side-by-side, not a full protocol write-up
- You may cross-link a related Telegraph post when comparing techniques — only if it fits naturally`,
  },
  {
    id: 'myth-check',
    label: 'Myth check',
    summary: 'Debunk or refine common sleep-audio beliefs with evidence.',
    sectionCount: '6–8',
    opening: 'Open with a widely repeated claim the reader has probably heard — then qualify or correct it immediately.',
    structure: `- 3–4 myth/reality pairs; headings should state the myth or misconception in plain language
- Follow each myth with a short evidence paragraph in plain language
- End with a compact "what actually helps tonight" section
- Blockquote disclaimer after the most clinical claim, not at a fixed slot`,
  },
  {
    id: 'qa-explainer',
    label: 'Q&A explainer',
    summary: 'Question-shaped headings that read like a curious listener interviewing an expert.',
    sectionCount: '7–10',
    opening: 'Start with a single sharp question in prose (no "Q:" prefix), then answer it in the next paragraph before the first <h3>.',
    structure: `- Each <h3> is a natural question ("Why does a sharp tone feel harder to ignore at low volume?")
- Keep answers 1–3 paragraphs; vary length across sections
- Embed the mini-experiment as one answered question ("What happened when I tried X for five nights?")
- Scatter internal links inside answers, not grouped at the end`,
  },
  {
    id: 'night-protocol',
    label: 'Night protocol',
    summary: 'Action-first guide that front-loads a usable routine, then justifies it.',
    sectionCount: '6–8',
    opening: 'Open with a step-by-step evening routine the reader can try tonight.',
    structure: `- First <h3> is a practical protocol (<ol> or phased blocks like "An hour before bed", "Right before lights out")
- Science sections come after the reader already has steps to follow
- Describe volume as "quiet", "barely audible", or "background level" — not measured dB
- One image near the setup section, one near the troubleshooting section`,
  },
  {
    id: 'listener-profiles',
    label: 'Listener profiles',
    summary: 'Segment advice by bedroom context or sleeper type.',
    sectionCount: '6–9',
    opening: 'Open by acknowledging that the same sound works differently depending on room noise and sensitivity.',
    structure: `- 3–4 profile sections ("light sleeper + street noise", "partner in the room", "tinnitus at bedtime", etc.) — pick what fits the topic
- Each profile: 1 paragraph advice + 1 concrete setting described qualitatively (sound type, volume feel, duration in plain words)
- Optional short shared mini-experiment that tested one profile
- Avoid repeating the same list structure in every profile`,
  },
  {
    id: 'evening-timeline',
    label: 'Evening timeline',
    summary: 'Follow one evening chronologically from wind-down to sleep onset.',
    sectionCount: '5–7',
    opening: 'Open by anchoring an evening moment ("lights dimmed, phone on Do Not Disturb, speaker on the nightstand").',
    structure: `- Section headings follow time or phase ("Before you press play", "The first stretch after lying down", "If you are still awake later")
- Science is woven into each phase rather than isolated in one block
- Mini-experiment appears as what changed across several evenings using this timeline
- Closing CTA follows a short "tomorrow morning" reflection paragraph`,
  },
];

const ARCHETYPE_BY_ID = Object.fromEntries(
  ARTICLE_ARCHETYPES.map((archetype) => [archetype.id, archetype]),
);

const ARCHETYPE_IDS = ARTICLE_ARCHETYPES.map((archetype) => archetype.id);

const TEMPLATE_HEADING_PATTERNS = [
  /hook\s*\+\s*search intent/i,
  /mini[\u2011\u002d\s]?experiment\s*\/\s*field notes/i,
  /why it works\s*\(\s*science/i,
  /what to try tonight\s*\(\s*practical/i,
  /comparison:.*what to choose/i,
  /deeper dive:/i,
  /\[inline image/i,
  /^related reading$/i,
  /^closing cta/i,
];

function getArchetype(id) {
  return ARCHETYPE_BY_ID[id] || ARCHETYPE_BY_ID['field-notes'];
}

function getRecentArchetypeIds(existingPosts, limit = 4) {
  const ids = [];
  for (let index = existingPosts.length - 1; index >= 0 && ids.length < limit; index -= 1) {
    const id = existingPosts[index].articleArchetype || existingPosts[index].raw?.articleArchetype;
    if (id && ARCHETYPE_BY_ID[id] && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function formatArchetypeCatalog(recentIds = []) {
  const recentSet = new Set(recentIds);
  return ARTICLE_ARCHETYPES.map((archetype) => {
    const marker = recentSet.has(archetype.id) ? ' (used recently — prefer another)' : '';
    return `- ${archetype.id}${marker}: ${archetype.summary}`;
  }).join('\n');
}

function buildArchetypeStyleRules(archetypeId) {
  const archetype = getArchetype(archetypeId);

  return `Article archetype: ${archetype.label} (${archetype.id})
${archetype.summary}

Structure for this post (${archetype.sectionCount} <h3> sections):
${archetype.structure}

Opening style:
- ${archetype.opening}

Follow the planned sectionOutline headings — they should be specific to this topic, not generic template labels.`;
}

function findTemplateHeadings(html) {
  const headings = [...String(html).matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  return headings.filter((heading) =>
    TEMPLATE_HEADING_PATTERNS.some((pattern) => pattern.test(heading)),
  );
}

function hasImageCaptions(html) {
  return /<img\b[^>]*>\s*<p>\s*<em\b/i.test(String(html));
}

module.exports = {
  ARTICLE_ARCHETYPES,
  ARCHETYPE_IDS,
  TEMPLATE_HEADING_PATTERNS,
  buildArchetypeStyleRules,
  findTemplateHeadings,
  hasImageCaptions,
  formatArchetypeCatalog,
  getArchetype,
  getRecentArchetypeIds,
};
