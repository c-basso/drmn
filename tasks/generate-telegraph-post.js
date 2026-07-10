'use strict';

require('../load-env');

const fs = require('fs');
const path = require('path');

const {
  buildTelegraphPostMetadataPrompt,
  buildTelegraphPostContentPrompt,
  buildTelegraphPostMetadataRepairPrompt,
  buildTelegraphPostContentRepairPrompt,
} = require('./telegraph-post-prompt');
const { chatCompletion, DEFAULT_MODEL } = require('./openrouter-client');
const { fetchBackgroundPhoto } = require('./unsplash-photos');
const { deriveUnsplashSearchQuery, getUsedUnsplashIds } = require('./generate-blog-post');
const { ARCHETYPE_IDS, getArchetype } = require('./telegraph-article-archetypes');
const { auditTelegraphPost } = require('../build/validate/telegraphPostContentQuality');
const { titlesTooSimilar } = require('../build/validate/blogPostContentQuality');
const { htmlToTelegraphNodes } = require('../build/telegraph/html-to-nodes');
const { publishPage } = require('../build/telegraph/telegraph-client');
const { updateTelegraphHub } = require('../build/telegraph/update-hub');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'build', 'telegraph', 'posts');
const IMAGES_DIR = path.join(ROOT_DIR, 'build', 'telegraph', 'images');
const BLOG_POSTS_DIR = path.join(ROOT_DIR, 'build', 'blog', 'posts');
const AUTHOR = 'Vladimir Ivakhnenko';
const SLUG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_VALIDATION_ATTEMPTS = 4;

function normalizeSlug(slug) {
  let cleaned = String(slug)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (/^[0-9]/.test(cleaned)) {
    const moved = cleaned.match(/^([0-9][a-z0-9]*?)-(.+)$/);
    if (moved) {
      cleaned = `${moved[2]}-${moved[1]}`;
    } else {
      cleaned = `sound-${cleaned}`;
    }
  }

  return cleaned;
}

function parseArgs(argv) {
  const args = { topic: '', dryRun: false, publishOnly: false, slug: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--publish-only') {
      args.publishOnly = true;
    } else if (arg === '--topic' && argv[i + 1]) {
      args.topic = argv[++i].trim();
    } else if (arg === '--slug' && argv[i + 1]) {
      args.slug = argv[++i].trim();
    } else if (!arg.startsWith('-') && !args.topic) {
      args.topic = arg.trim();
    }
  }
  return args;
}

function loadJsonPosts(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const post = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      return {
        slug: post.slug,
        title: post.title,
        articleArchetype: post.articleArchetype || null,
        unsplashId: post.hero?.unsplashId || null,
        telegraphUrl: post.telegraph?.url || null,
        filePath: path.join(dir, name),
        raw: post,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function parseJsonFromContent(text) {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through */
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('Could not parse JSON from model response');
}

function stripHtmlFences(text) {
  let html = String(text).trim();
  const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenced) {
    html = fenced[1].trim();
  }
  return html;
}

function isValidArticleHtml(content) {
  const html = String(content).trim();
  if (!html.startsWith('<')) return false;
  if (/^user safety:/i.test(html)) return false;
  return /<(p|h3|h4|ul|ol|blockquote)\b/i.test(html);
}

function normalizeMetadata(metadata) {
  const normalized = { ...metadata };

  if (normalized.slug) {
    const rawSlug = String(normalized.slug);
    const cleanedSlug = normalizeSlug(rawSlug);
    if (cleanedSlug !== rawSlug) {
      console.warn(`[telegraph] slug normalized: "${rawSlug}" → "${cleanedSlug}"`);
    }
    normalized.slug = cleanedSlug;
  }

  const unsplashRaw =
    normalized.unsplashSearchQuery ||
    normalized.unsplash_search_query ||
    normalized.imageSearchQuery;

  if (unsplashRaw && String(unsplashRaw).trim()) {
    normalized.unsplashSearchQuery = String(unsplashRaw).trim();
  } else {
    normalized.unsplashSearchQuery = deriveUnsplashSearchQuery(normalized);
    console.warn(
      `[telegraph] unsplashSearchQuery missing — using fallback: "${normalized.unsplashSearchQuery}"`,
    );
  }

  if (!normalized.hero || typeof normalized.hero !== 'object') {
    normalized.hero = {};
  }

  const heroAlt =
    normalized.hero.alt ||
    normalized.heroAlt ||
    normalized.imageAlt;

  if (heroAlt && String(heroAlt).trim()) {
    normalized.hero.alt = String(heroAlt).trim();
  } else if (normalized.title) {
    normalized.hero.alt = `${normalized.title} — calm ambient scene`;
  }

  if (!Array.isArray(normalized.tags)) {
    normalized.tags = typeof normalized.tags === 'string'
      ? normalized.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  }

  if (!Array.isArray(normalized.inlineImages)) {
    normalized.inlineImages = [];
  }
  normalized.inlineImages = normalized.inlineImages
    .map((item, index) => ({
      unsplashSearchQuery: String(
        item?.unsplashSearchQuery || item?.query || deriveUnsplashSearchQuery(normalized),
      ).trim(),
      alt: String(item?.alt || `${normalized.title} — illustration ${index + 1}`).trim(),
      placement: item?.placement || '',
    }))
    .filter((item) => item.unsplashSearchQuery && item.alt);

  while (normalized.inlineImages.length < 2) {
    const index = normalized.inlineImages.length;
    normalized.inlineImages.push({
      unsplashSearchQuery: index === 0
        ? 'audio waveform frequency spectrum'
        : 'sleep tracker graph night',
      alt: `${normalized.title} — supporting visual ${index + 1}`,
      placement: '',
    });
    console.warn(`[telegraph] inlineImages[${index}] missing — using fallback query`);
  }

  const archetypeId = String(normalized.articleArchetype || '').trim();
  if (!ARCHETYPE_IDS.includes(archetypeId)) {
    const fallbackId = ARCHETYPE_IDS[normalized.slug.length % ARCHETYPE_IDS.length];
    normalized.articleArchetype = fallbackId;
    console.warn(
      `[telegraph] articleArchetype missing or invalid — using fallback: "${fallbackId}"`,
    );
  }

  return normalized;
}

function imageFetchKey(metadata) {
  return JSON.stringify({
    slug: metadata.slug,
    hero: metadata.unsplashSearchQuery,
    inline: (metadata.inlineImages || []).map((item) => item.unsplashSearchQuery),
  });
}

function collectValidationIssues(generated, existingPosts, blogPosts) {
  const errors = [];
  const metadataIssues = [];
  const contentIssues = [];

  const add = (message, kind) => {
    errors.push(message);
    if (kind === 'metadata') {
      metadataIssues.push(message);
    } else {
      contentIssues.push(message);
    }
  };

  const existingSlugs = new Set(existingPosts.map((post) => post.slug));
  const required = ['slug', 'title', 'description', 'excerpt', 'content'];
  for (const field of required) {
    if (!generated[field] || !String(generated[field]).trim()) {
      add(`Generated post is missing required field "${field}"`, field === 'content' ? 'content' : 'metadata');
    }
  }

  if (generated.slug && !SLUG_RE.test(generated.slug)) {
    add(`Invalid slug "${generated.slug}" — use kebab-case starting with a letter`, 'metadata');
  }

  if (generated.slug && existingSlugs.has(generated.slug)) {
    add(`Slug "${generated.slug}" already exists — choose a different slug`, 'metadata');
  }

  const comparablePosts = [...existingPosts, ...blogPosts];
  const similar = comparablePosts.find((post) => titlesTooSimilar(generated.title, post.title));
  if (similar) {
    add(
      `Title "${generated.title}" is too similar to existing post "${similar.slug}" (${similar.title})`,
      'metadata',
    );
  }

  if (!generated.hero?.alt?.trim()) {
    add('Generated post is missing hero.alt', 'metadata');
  }

  if (!Array.isArray(generated.tags) || generated.tags.length < 3) {
    add('Generated post must include at least 3 tags', 'metadata');
  }

  if (!generated.uniqueAngle?.trim()) {
    add('Generated post is missing uniqueAngle', 'metadata');
  }

  if (!generated.articleArchetype || !ARCHETYPE_IDS.includes(generated.articleArchetype)) {
    add('Generated post must include a valid articleArchetype', 'metadata');
  }

  if (generated.content && !isValidArticleHtml(generated.content)) {
    add(
      'Generated content is not valid HTML — model may have returned a safety stub or non-HTML text',
      'content',
    );
  }

  const audit = auditTelegraphPost(generated, {
    strict: true,
    otherPosts: existingPosts,
    blogPosts,
  });
  if (!audit.ok) {
    for (const issue of [...audit.critical, ...audit.quality, ...audit.errors]) {
      if (errors.includes(issue)) {
        continue;
      }
      const kind = /^(title|description|excerpt|hero|slug|tags|uniqueAngle|articleArchetype|missing meta description)/i.test(issue)
        ? 'metadata'
        : 'content';
      add(issue, kind);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    metadataIssues,
    contentIssues,
    audit,
  };
}

function validateGeneratedPost(generated, existingPosts, blogPosts) {
  const issues = collectValidationIssues(generated, existingPosts, blogPosts);
  if (!issues.ok) {
    throw new Error(`Generated post failed validation: ${issues.errors.join('; ')}`);
  }
  return issues.audit.metrics;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPostRecord(generated, imageBaseName, photo, inlinePhotos = []) {
  const today = todayIsoDate();
  const hero = {
    src: `${imageBaseName}.jpg`,
    alt: generated.hero.alt.trim(),
  };
  if (photo?.id) {
    hero.unsplashId = photo.id;
  }
  if (photo?.url) {
    hero.url = photo.url;
  }

  const inlineImages = inlinePhotos.map((item, index) => ({
    src: `${imageBaseName}-inline-${index + 1}.jpg`,
    alt: item.alt,
    url: item.url,
    unsplashId: item.unsplashId || undefined,
    placement: item.placement || undefined,
  }));

  return {
    slug: generated.slug,
    title: generated.title.trim(),
    description: generated.description.trim(),
    excerpt: generated.excerpt.trim(),
    uniqueAngle: generated.uniqueAngle?.trim() || undefined,
    articleArchetype: generated.articleArchetype || undefined,
    dateCreated: today,
    dateModified: today,
    author: AUTHOR,
    tags: generated.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean),
    readingTimeMinutes: Number(generated.readingTimeMinutes) || 8,
    hero,
    inlineImages,
    content: generated.content.trim(),
    telegraph: generated.telegraph || null,
  };
}

async function fetchInlineImages(metadata, slug, excludeIds) {
  const usedIds = new Set(excludeIds);
  const results = [];

  for (let i = 0; i < metadata.inlineImages.length; i += 1) {
    const item = metadata.inlineImages[i];
    const imagePath = path.join(IMAGES_DIR, `${slug}-inline-${i + 1}.jpg`);
    console.log(`[unsplash] inline ${i + 1} query: "${item.unsplashSearchQuery}"`);
    const photo = await fetchBackgroundPhoto(item.unsplashSearchQuery, imagePath, {
      excludeIds: [...usedIds],
    });
    if (photo.id) usedIds.add(photo.id);
    results.push({
      alt: item.alt,
      placement: item.placement,
      url: photo.url,
      unsplashId: photo.id,
      user: photo.user,
    });
    console.log(`[unsplash] inline ${i + 1} by ${photo.user} (id=${photo.id})`);
  }

  return results;
}

async function fetchImagesForDraft(metadata, existingPosts, blogPosts) {
  const imageBaseName = metadata.slug;
  const excludeIds = [
    ...getUsedUnsplashIds(existingPosts),
    ...getUsedUnsplashIds(blogPosts),
  ];

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const heroPath = path.join(IMAGES_DIR, `${imageBaseName}.jpg`);
  const heroQuery = metadata.unsplashSearchQuery || deriveUnsplashSearchQuery(metadata);
  console.log(`[unsplash] hero query: "${heroQuery}"`);
  const heroPhoto = await fetchBackgroundPhoto(heroQuery, heroPath, { excludeIds });
  console.log(`[unsplash] hero by ${heroPhoto.user} (id=${heroPhoto.id})`);

  const inlinePhotos = await fetchInlineImages(
    metadata,
    imageBaseName,
    [...excludeIds, heroPhoto.id],
  );

  return { heroPhoto, inlinePhotos, imageKey: imageFetchKey(metadata) };
}

async function generatePostMetadata(topic, existingPosts, blogPosts, validationFeedback = '') {
  const metadataPrompt = buildTelegraphPostMetadataPrompt({
    topic,
    existingPosts,
    blogPosts,
    validationFeedback,
  });

  const metadataResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a precise editorial assistant. Output only valid JSON matching the requested schema.',
      },
      { role: 'user', content: metadataPrompt },
    ],
    temperature: 0.7,
  });

  return normalizeMetadata(parseJsonFromContent(metadataResult.content));
}

async function generatePostContent(
  metadata,
  existingPosts,
  blogPosts,
  inlinePhotos,
  validationFeedback = '',
) {
  const contentPrompt = buildTelegraphPostContentPrompt(
    metadata,
    existingPosts,
    blogPosts,
    inlinePhotos,
    validationFeedback,
  );
  const contentResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write in-depth HTML articles for DRMN Telegraph. Value-first, experiential and evidence-informed, minimal promotion. Avoid invented precise statistics. Stock photos are unseen — never caption or describe their contents. Output only HTML fragments.',
      },
      { role: 'user', content: contentPrompt },
    ],
    temperature: 0.82,
  });

  return stripHtmlFences(contentResult.content);
}

async function repairPostMetadata(metadata, issues, existingPosts, blogPosts) {
  const repairPrompt = buildTelegraphPostMetadataRepairPrompt(
    metadata,
    issues,
    existingPosts,
    blogPosts,
  );

  console.log('[openrouter] repairing metadata…');
  const metadataResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You fix Telegraph post metadata JSON. Output only valid JSON matching the requested schema.',
      },
      { role: 'user', content: repairPrompt },
    ],
    temperature: 0.4,
  });

  return normalizeMetadata(parseJsonFromContent(metadataResult.content));
}

async function repairPostContent(
  metadata,
  content,
  issues,
  existingPosts,
  blogPosts,
  inlinePhotos,
) {
  const repairPrompt = buildTelegraphPostContentRepairPrompt(
    metadata,
    content,
    issues,
    existingPosts,
    blogPosts,
    inlinePhotos,
  );

  console.log('[openrouter] repairing article HTML…');
  const contentResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You fix HTML article bodies for DRMN Telegraph. Output only corrected HTML fragments — no JSON, no markdown.',
      },
      { role: 'user', content: repairPrompt },
    ],
    temperature: 0.5,
  });

  return stripHtmlFences(contentResult.content);
}

function mergeDraft(metadata, content, heroPhoto, inlinePhotos) {
  const { sectionOutline: _outline, inlineImages: _inline, ...meta } = metadata;
  return {
    ...meta,
    content,
    _heroPhoto: heroPhoto,
    _inlinePhotos: inlinePhotos,
  };
}

async function generatePostDraft(topic, existingPosts, blogPosts, validationFeedback = '') {
  console.log(`[openrouter] model=${DEFAULT_MODEL}`);
  if (topic) {
    console.log(`[openrouter] topic: ${topic}`);
  } else {
    console.log('[openrouter] topic: (auto)');
  }

  console.log('[openrouter] step 1/3: metadata');
  const metadata = await generatePostMetadata(
    topic,
    existingPosts,
    blogPosts,
    validationFeedback,
  );
  const archetype = getArchetype(metadata.articleArchetype);
  console.log(`[telegraph] archetype: ${archetype.id} (${archetype.label})`);
  if (metadata.uniqueAngle) {
    console.log(`[telegraph] angle: ${metadata.uniqueAngle}`);
  }

  console.log('[openrouter] step 2/3: fetch images');
  const { heroPhoto, inlinePhotos } = await fetchImagesForDraft(
    metadata,
    existingPosts,
    blogPosts,
  );

  console.log('[openrouter] step 3/3: article HTML');
  const content = await generatePostContent(
    metadata,
    existingPosts,
    blogPosts,
    inlinePhotos,
    validationFeedback,
  );

  console.log('[openrouter] draft ready');
  return mergeDraft(metadata, content, heroPhoto, inlinePhotos);
}

async function generatePostDraftWithRetry(topic, existingPosts, blogPosts) {
  let metadata = await generatePostMetadata(topic, existingPosts, blogPosts);
  let { heroPhoto, inlinePhotos, imageKey } = await fetchImagesForDraft(
    metadata,
    existingPosts,
    blogPosts,
  );
  let content = await generatePostContent(
    metadata,
    existingPosts,
    blogPosts,
    inlinePhotos,
  );
  let draft = mergeDraft(metadata, content, heroPhoto, inlinePhotos);
  let lastIssues = collectValidationIssues(draft, existingPosts, blogPosts);

  for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt += 1) {
    if (lastIssues.ok) {
      if (attempt > 1) {
        console.log(`[telegraph] validation passed after ${attempt} attempt(s)`);
      }
      return { draft, quality: lastIssues.audit.metrics };
    }

    console.warn(
      `[telegraph] validation attempt ${attempt}/${MAX_VALIDATION_ATTEMPTS} — ${lastIssues.errors.length} issue(s)`,
    );
    lastIssues.errors.forEach((issue) => console.warn(`  - ${issue}`));

    if (attempt === MAX_VALIDATION_ATTEMPTS) {
      break;
    }

    const previousSlug = metadata.slug;
    const previousTitle = metadata.title;
    const previousImageKey = imageKey;

    if (lastIssues.metadataIssues.length > 0) {
      metadata = await repairPostMetadata(
        metadata,
        lastIssues.metadataIssues,
        existingPosts,
        blogPosts,
      );
    }

    const metadataChanged = metadata.slug !== previousSlug || metadata.title !== previousTitle;
    if (imageFetchKey(metadata) !== previousImageKey) {
      ({ heroPhoto, inlinePhotos, imageKey } = await fetchImagesForDraft(
        metadata,
        existingPosts,
        blogPosts,
      ));
    }

    if (lastIssues.contentIssues.length > 0 || metadataChanged) {
      const repairIssues = [
        ...lastIssues.contentIssues,
        ...(metadataChanged
          ? [`Metadata changed — align the article with slug "${metadata.slug}" and title "${metadata.title}"`]
          : []),
      ];
      content = await repairPostContent(
        metadata,
        content,
        repairIssues,
        existingPosts,
        blogPosts,
        inlinePhotos,
      );
    }

    draft = mergeDraft(metadata, content, heroPhoto, inlinePhotos);
    lastIssues = collectValidationIssues(draft, existingPosts, blogPosts);
  }

  throw new Error(
    `Generated post failed validation after ${MAX_VALIDATION_ATTEMPTS} attempts: ${lastIssues.errors.join('; ')}`,
  );
}

function writePostJson(post) {
  const filePath = path.join(POSTS_DIR, `${post.slug}.json`);
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`[telegraph] wrote ${path.relative(ROOT_DIR, filePath)}`);
  return filePath;
}

async function publishPostToTelegraph(post) {
  if (!post.hero?.url) {
    throw new Error('Post is missing hero.url — required for Telegraph image');
  }

  const nodes = htmlToTelegraphNodes(post.content, {
    heroImageUrl: post.hero.url,
    heroAlt: post.hero.alt,
  });

  const page = await publishPage({
    title: post.title,
    content: nodes,
    path: post.telegraph?.path || undefined,
  });

  return {
    path: page.path,
    url: page.url,
    publishedAt: new Date().toISOString(),
  };
}

async function publishExistingPost(postEntry) {
  const post = { ...postEntry.raw };
  console.log(`[telegraph] publishing "${post.slug}"…`);
  const telegraph = await publishPostToTelegraph(post);
  const updated = {
    ...post,
    dateModified: todayIsoDate(),
    telegraph,
  };
  writePostJson(updated);
  return updated;
}

async function main() {
  const { topic, dryRun, publishOnly, slug } = parseArgs(process.argv);
  const existingPosts = loadJsonPosts(POSTS_DIR);
  const blogPosts = loadJsonPosts(BLOG_POSTS_DIR);

  if (publishOnly) {
    const target = slug
      ? existingPosts.find((p) => p.slug === slug)
      : existingPosts.find((p) => !p.telegraphUrl);

    if (!target) {
      throw new Error(slug
        ? `No Telegraph post found with slug "${slug}"`
        : 'No unpublished Telegraph post found');
    }

    const updated = await publishExistingPost(target);
    const hub = await updateTelegraphHub();
    console.log('\n✅ Published to Telegraph');
    console.log(`   URL: ${updated.telegraph.url}`);
    console.log(`   Hub: ${hub.telegraph.url}`);
    return;
  }

  console.log(`[telegraph] existing posts: ${existingPosts.length}`);
  console.log(`[telegraph] blog posts (for dedup): ${blogPosts.length}`);

  const { draft: generated, quality } = await generatePostDraftWithRetry(
    topic,
    existingPosts,
    blogPosts,
  );
  validateGeneratedPost(generated, existingPosts, blogPosts);

  console.log('\n--- Draft summary ---');
  console.log(`slug:  ${generated.slug}`);
  console.log(`title: ${generated.title}`);
  console.log(`archetype: ${generated.articleArchetype || '(unknown)'}`);
  console.log(`tags:  ${generated.tags.join(', ')}`);
  console.log(`words: ${quality.words}`);
  console.log(`links: ${quality.siteLinks} site, ${quality.blogLinks} blog, ${quality.telegraphLinks} telegraph`);
  console.log(`images: 1 hero + ${quality.inlineImages} inline`);
  console.log('---------------------\n');

  if (dryRun) {
    console.log('[dry-run] skipping file write and Telegraph publish');
    return;
  }

  const post = buildPostRecord(
    generated,
    generated.slug,
    generated._heroPhoto,
    generated._inlinePhotos,
  );
  writePostJson(post);

  console.log('[telegraph] publishing…');
  const telegraph = await publishPostToTelegraph(post);
  const published = {
    ...post,
    telegraph,
    dateModified: todayIsoDate(),
  };
  writePostJson(published);

  const hub = await updateTelegraphHub();

  console.log('\n✅ Telegraph post ready');
  console.log(`   JSON:  build/telegraph/posts/${published.slug}.json`);
  console.log(`   URL:   ${published.telegraph.url}`);
  console.log(`   Hub:   ${hub.telegraph.url}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n❌ ${err.message || err}`);
    process.exit(1);
  });
}

module.exports = {
  loadJsonPosts,
  publishPostToTelegraph,
  normalizeSlug,
  collectValidationIssues,
  validateGeneratedPost,
  generatePostDraftWithRetry,
};
