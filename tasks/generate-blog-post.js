'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  buildBlogPostMetadataPrompt,
  buildBlogPostContentPrompt,
} = require('./blog-post-prompt');
const { chatCompletion, DEFAULT_MODEL } = require('./openrouter-client');
const { fetchBackgroundPhoto } = require('./unsplash-photos');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'build', 'blog', 'posts');
const IMAGES_DIR = path.join(ROOT_DIR, 'build', 'blog', 'images');
const AUTHOR = 'Vladimir Ivakhnenko';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseArgs(argv) {
  const args = { topic: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--topic' && argv[i + 1]) {
      args.topic = argv[++i].trim();
    } else if (!arg.startsWith('-') && !args.topic) {
      args.topic = arg.trim();
    }
  }
  return args;
}

function loadExistingPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const post = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, name), 'utf8'));
      return { slug: post.slug, title: post.title };
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
  if (!html.startsWith('<')) {
    return false;
  }
  if (/^user safety:/i.test(html)) {
    return false;
  }
  return /<(p|h2|h3|ul|ol|blockquote)\b/i.test(html);
}

function deriveUnsplashSearchQuery(metadata) {
  const topic = [
    metadata.title,
    ...(metadata.tags || []),
    metadata.slug?.replace(/-/g, ' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let scene = 'cozy bedroom night';
  if (/focus|work|study|desk|productiv/.test(topic)) {
    scene = 'minimal desk workspace';
  } else if (/rain|storm|drizzle/.test(topic)) {
    scene = 'rain window night';
  } else if (/ocean|wave|beach/.test(topic)) {
    scene = 'ocean waves calm';
  } else if (/brown|pink|white.?noise|static/.test(topic)) {
    scene = 'dark bedroom ambient';
  } else if (/baby|infant|nursery/.test(topic)) {
    scene = 'soft nursery light';
  } else if (/forest|nature|bird|wind/.test(topic)) {
    scene = 'misty forest morning';
  } else if (/anxiety|stress|calm|meditat/.test(topic)) {
    scene = 'peaceful dim room';
  }

  const keywords = (metadata.tags || [])
    .slice(0, 2)
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .join(' ');

  return `${keywords || metadata.slug?.replace(/-/g, ' ') || 'sleep sounds'} ${scene}`
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMetadata(metadata) {
  const normalized = { ...metadata };

  const unsplashRaw =
    normalized.unsplashSearchQuery ||
    normalized.unsplash_search_query ||
    normalized.imageSearchQuery ||
    normalized.image_search_query ||
    normalized.hero?.unsplashSearchQuery ||
    normalized.hero?.searchQuery;

  if (unsplashRaw && String(unsplashRaw).trim()) {
    normalized.unsplashSearchQuery = String(unsplashRaw).trim();
  } else {
    normalized.unsplashSearchQuery = deriveUnsplashSearchQuery(normalized);
    console.warn(
      `[blog] unsplashSearchQuery missing from model — using fallback: "${normalized.unsplashSearchQuery}"`,
    );
  }

  if (!normalized.hero || typeof normalized.hero !== 'object') {
    normalized.hero = {};
  }

  const heroAlt =
    normalized.hero.alt ||
    normalized.heroAlt ||
    normalized.hero_alt ||
    normalized.imageAlt ||
    normalized.image_alt;

  if (heroAlt && String(heroAlt).trim()) {
    normalized.hero.alt = String(heroAlt).trim();
  } else if (normalized.title) {
    normalized.hero.alt = `${normalized.title} — calm ambient scene`;
    console.warn('[blog] hero.alt missing from model — using title-based fallback');
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
    throw new Error(`Slug "${generated.slug}" already exists — re-run or pass a different topic`);
  }

  if (!generated.hero?.alt?.trim()) {
    throw new Error('Generated post is missing hero.alt');
  }

  if (!Array.isArray(generated.tags) || generated.tags.length < 3) {
    throw new Error('Generated post must include at least 3 tags');
  }

  if (/<h1[\s>]/i.test(generated.content)) {
    throw new Error('Content must not contain <h1> tags');
  }

  if (!isValidArticleHtml(generated.content)) {
    throw new Error(
      'Generated content is not valid HTML — model may have returned a safety stub or non-HTML text',
    );
  }
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPostRecord(generated, imageBaseName) {
  const today = todayIsoDate();
  return {
    slug: generated.slug,
    title: generated.title.trim(),
    description: generated.description.trim(),
    excerpt: generated.excerpt.trim(),
    datePublished: today,
    dateModified: today,
    author: AUTHOR,
    tags: generated.tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean),
    readingTimeMinutes: Number(generated.readingTimeMinutes) || 7,
    hero: {
      src: `${imageBaseName}.webp`,
      source: `${imageBaseName}.jpg`,
      alt: generated.hero.alt.trim(),
    },
    content: generated.content.trim(),
  };
}

async function generatePostDraft(topic, existingPosts) {
  const metadataPrompt = buildBlogPostMetadataPrompt({ topic, existingPosts });

  console.log(`[openrouter] model=${DEFAULT_MODEL}`);
  if (topic) {
    console.log(`[openrouter] topic: ${topic}`);
  } else {
    console.log('[openrouter] topic: (auto — model will choose)');
  }

  console.log('[openrouter] step 1/2: metadata');
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

  const metadata = normalizeMetadata(parseJsonFromContent(metadataResult.content));

  console.log('[openrouter] step 2/2: article HTML');
  const contentPrompt = buildBlogPostContentPrompt(metadata, existingPosts);
  const contentResult = await chatCompletion({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You write clean HTML article bodies for the DRMN blog. Output only HTML fragments — no JSON, no markdown.',
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

async function fetchHeroImage(generated, imagePath) {
  const query = String(generated.unsplashSearchQuery).trim();
  console.log(`[unsplash] query: "${query}"`);
  const photo = await fetchBackgroundPhoto(query, imagePath);
  console.log(`[unsplash] photo by ${photo.user} (id=${photo.id})`);
  return photo;
}

function writePostJson(post) {
  const filePath = path.join(POSTS_DIR, `${post.slug}.json`);
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`[blog] wrote ${path.relative(ROOT_DIR, filePath)}`);
  return filePath;
}

function runBuild() {
  console.log('[build] running npm run build…');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

async function main() {
  const { topic, dryRun } = parseArgs(process.argv);
  const existingPosts = loadExistingPosts();
  const existingSlugs = new Set(existingPosts.map((p) => p.slug));

  console.log(`[blog] existing posts: ${existingPosts.length}`);

  const generated = await generatePostDraft(topic, existingPosts);
  validateGeneratedPost(generated, existingSlugs);

  if (!generated.unsplashSearchQuery?.trim()) {
    generated.unsplashSearchQuery = deriveUnsplashSearchQuery(generated);
  }

  const imageBaseName = generated.slug;
  const imagePath = path.join(IMAGES_DIR, `${imageBaseName}.jpg`);
  const post = buildPostRecord(generated, imageBaseName);

  console.log('\n--- Draft summary ---');
  console.log(`slug:  ${post.slug}`);
  console.log(`title: ${post.title}`);
  console.log(`tags:  ${post.tags.join(', ')}`);
  console.log(`image: ${post.hero.source} → ${post.hero.src} (optimized on build)`);
  console.log('---------------------\n');

  if (dryRun) {
    console.log('[dry-run] skipping Unsplash download, file write, and build');
    return;
  }

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  await fetchHeroImage(generated, imagePath);
  writePostJson(post);
  runBuild();

  console.log('\n✅ Blog post ready');
  console.log(`   Page:  /blog/${post.slug}/`);
  console.log(`   Local: blog/${post.slug}/index.html`);
  console.log('   Deploy: npm run deploy');
}

main().catch((err) => {
  console.error(`\n❌ ${err.message || err}`);
  process.exit(1);
});
