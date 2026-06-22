'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { fetchBackgroundPhoto } = require('./unsplash-photos');
const { deriveUnsplashSearchQuery } = require('./generate-blog-post');

const ROOT_DIR = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT_DIR, 'build', 'blog', 'posts');
const IMAGES_DIR = path.join(ROOT_DIR, 'build', 'blog', 'images');

function heroSource(hero) {
  if (hero?.source) {
    return hero.source;
  }
  if (hero?.src) {
    return hero.src.replace(/\.webp$/i, '.jpg');
  }
  return null;
}

function md5(filePath) {
  return crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
}

function loadPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const post = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, name), 'utf8'));
      const source = heroSource(post.hero);
      const jpgPath = source ? path.join(IMAGES_DIR, source) : null;
      return {
        post,
        source,
        hash: jpgPath && fs.existsSync(jpgPath) ? md5(jpgPath) : null,
      };
    });
}

function writePost(post) {
  const filePath = path.join(POSTS_DIR, `${post.slug}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(post, null, 2)}\n`, 'utf8');
  console.log(`[blog] updated ${path.relative(ROOT_DIR, filePath)}`);
}

async function main() {
  const entries = loadPosts();
  const byHash = new Map();

  for (const entry of entries) {
    if (!entry.hash) {
      continue;
    }
    if (!byHash.has(entry.hash)) {
      byHash.set(entry.hash, []);
    }
    byHash.get(entry.hash).push(entry);
  }

  const duplicateGroups = [...byHash.values()].filter((group) => group.length > 1);
  if (!duplicateGroups.length) {
    console.log('✅ No duplicate blog hero images found');
    return;
  }

  const excludeIds = entries
    .map((entry) => entry.post.hero?.unsplashId)
    .filter(Boolean);

  for (const group of duplicateGroups) {
    const slugs = group.map((entry) => entry.post.slug).join(', ');
    console.log(`\n[blog] duplicate group: ${slugs}`);

    const keeper = group
      .slice()
      .sort((a, b) => a.post.datePublished.localeCompare(b.post.datePublished))[0];
    const toRefresh = group.filter((entry) => entry.post.slug !== keeper.post.slug);

    console.log(`[blog] keeping ${keeper.post.slug}, refreshing ${toRefresh.length} post(s)`);

    if (keeper.post.hero?.unsplashId) {
      excludeIds.push(keeper.post.hero.unsplashId);
    }

    let refreshIndex = 0;
    for (const entry of toRefresh) {
      const post = entry.post;
      const query = deriveUnsplashSearchQuery(post);
      const imagePath = path.join(IMAGES_DIR, entry.source);

      console.log(`[unsplash] ${post.slug}: "${query}"`);
      let photo = await fetchBackgroundPhoto(query, imagePath, {
        excludeIds,
        index: refreshIndex,
      });

      if (keeper.hash && md5(imagePath) === keeper.hash) {
        excludeIds.push(photo.id);
        refreshIndex += 1;
        photo = await fetchBackgroundPhoto(query, imagePath, {
          excludeIds,
          index: refreshIndex,
        });
      }

      excludeIds.push(photo.id);
      refreshIndex += 1;

      post.hero.unsplashId = photo.id;
      if (!post.hero.source && entry.source) {
        post.hero.source = entry.source;
      }
      post.dateModified = new Date().toISOString().slice(0, 10);
      writePost(post);
      console.log(`[unsplash] saved id=${photo.id}, hash=${md5(imagePath)}`);
    }
  }

  console.log('\n[build] running npm run build…');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

main().catch((error) => {
  console.error(`\n❌ ${error.message || error}`);
  process.exit(1);
});
