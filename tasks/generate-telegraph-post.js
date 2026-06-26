'use strict';

require('../load-env');

const fs = require('fs');
const path = require('path');

const {
  buildTelegraphPostMetadataPrompt,
  buildTelegraphPostContentPrompt,
} = require('./telegraph-post-prompt');
const { chatCompletion, DEFAULT_MODEL } = require('./openrouter-client');
const { fetchBackgroundPhoto } = require('./unsplash-photos');
const { deriveUnsplashSearchQuery, getUsedUnsplashIds } = require('./generate-blog-post');
const { htmlToTelegraphNodes } = require('../build/telegraph/html-to-nodes');
const { publishPage } = require('../build/telegraph/telegraph-client');
const { updateTelegraphHub } = require('../build/telegraph/update-hub');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'build', 'telegraph', 'posts');
const IMAGES_DIR = path.join(ROOT_DIR, 'build', 'telegraph', 'images');
const BLOG_POSTS_DIR = path.join(ROOT_DIR, 'build', 'blog', 'posts');
const AUTHOR = 'Vladimir Ivakhnenko';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

  return normalized;
}

function validateGeneratedPost(generated, existingSlugs) {
  const required = ['slug', 'title', 'description', 'excerpt', 'content'];
  for (const field of required) {
    if (!generated[field] || !String(generated[field]).trim()) {
      throw new Error(`Generated post is missing required field "${field}"`);
    }
  }

  if (!SLUG_RE.test(generated.slug)) {
    throw new Error(`Invalid slug "${generated.slug}" — use kebab-case`);
  }

  if (existingSlugs.has(generated.slug)) {
    throw new Error(`Slug "${generated.slug}" already exists`);
  }

  if (!generated.hero?.alt?.trim()) {
    throw new Error('Generated post is missing hero.alt');
  }

  if (!Array.isArray(generated.tags) || generated.tags.length < 3) {
    throw new Error('Generated post must include at least 3 tags');
  }

  if (/<h1[\s>]/i.test(generated.content) || /<h2[\s>]/i.test(generated.content)) {
    throw new Error('Content must use <h3>/<h4> only, not <h1> or <h2>');
  }

  if (!isValidArticleHtml(generated.content)) {
    throw new Error('Generated content is not valid HTML');
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPostRecord(generated, imageBaseName, photo) {
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

  return {
    slug: generated.slug,
    title: generated.title.trim(),
    description: generated.description.trim(),
    excerpt: generated.excerpt.trim(),
    dateCreated: today,
    dateModified: today,
    author: AUTHOR,
    tags: generated.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean),
    hero,
    content: generated.content.trim(),
    telegraph: generated.telegraph || null,
  };
}

async function generatePostDraft(topic, existingPosts, blogPosts) {
  const metadataPrompt = buildTelegraphPostMetadataPrompt({
    topic,
    existingPosts,
    blogPosts,
  });

  console.log(`[openrouter] model=${DEFAULT_MODEL}`);
  if (topic) {
    console.log(`[openrouter] topic: ${topic}`);
  } else {
    console.log('[openrouter] topic: (auto)');
  }

  console.log('[openrouter] step 1/2: metadata');
  const metadataResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a precise SEO assistant. Output only valid JSON matching the requested schema.',
      },
      { role: 'user', content: metadataPrompt },
    ],
    temperature: 0.7,
  });

  const metadata = normalizeMetadata(parseJsonFromContent(metadataResult.content));

  console.log('[openrouter] step 2/2: article HTML');
  const contentPrompt = buildTelegraphPostContentPrompt(metadata, existingPosts);
  const contentResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You write clean HTML for DRMN Telegraph SEO posts. Output only HTML fragments.',
      },
      { role: 'user', content: contentPrompt },
    ],
    temperature: 0.75,
  });

  console.log(`[openrouter] done (model=${contentResult.model})`);
  const { sectionOutline: _outline, ...meta } = metadata;
  return {
    ...meta,
    content: stripHtmlFences(contentResult.content),
  };
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
  const existingSlugs = new Set(existingPosts.map((p) => p.slug));

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

  const generated = await generatePostDraft(topic, existingPosts, blogPosts);
  validateGeneratedPost(generated, existingSlugs);

  const imageBaseName = generated.slug;
  const imagePath = path.join(IMAGES_DIR, `${imageBaseName}.jpg`);
  const excludeIds = [
    ...getUsedUnsplashIds(existingPosts),
    ...getUsedUnsplashIds(blogPosts),
  ];

  console.log('\n--- Draft summary ---');
  console.log(`slug:  ${generated.slug}`);
  console.log(`title: ${generated.title}`);
  console.log(`tags:  ${generated.tags.join(', ')}`);
  console.log('---------------------\n');

  if (dryRun) {
    console.log('[dry-run] skipping Unsplash, file write, and Telegraph publish');
    return;
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const query = generated.unsplashSearchQuery || deriveUnsplashSearchQuery(generated);
  console.log(`[unsplash] query: "${query}"`);
  const photo = await fetchBackgroundPhoto(query, imagePath, { excludeIds });
  console.log(`[unsplash] photo by ${photo.user} (id=${photo.id})`);

  const post = buildPostRecord(generated, imageBaseName, {
    ...photo,
    url: photo.url,
  });
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
};
