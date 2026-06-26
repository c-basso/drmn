'use strict';

const fs = require('fs');
const path = require('path');

const { SITE_URL, APP_STORE_URL, DEFAULT_OG_LOGO } = require('../constants');
const { htmlToTelegraphNodes } = require('./html-to-nodes');
const { publishPage } = require('./telegraph-client');

const ROOT_DIR = path.join(__dirname, '..', '..');
const POSTS_DIR = path.join(__dirname, 'posts');
const HUB_JSON_PATH = path.join(__dirname, 'hub.json');

const SITE_LINK = SITE_URL.replace(/\/$/, '');
const BLOG_LINK = `${SITE_LINK}/blog/`;
const HUB_TITLE = 'DRMN on Telegraph: Sleep & Focus Audio Articles';
const HUB_DESCRIPTION =
  'Index of DRMN articles on Telegraph — short guides about sleep sounds, focus audio, and ambient noise.';
const HUB_HERO_ALT = 'DRMN — sleep and focus sounds';

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(text, max = 140) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function loadHubRecord() {
  if (!fs.existsSync(HUB_JSON_PATH)) {
    return {
      slug: 'telegraph-hub',
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      dateCreated: todayIsoDate(),
      dateModified: todayIsoDate(),
      hero: {
        url: DEFAULT_OG_LOGO,
        alt: HUB_HERO_ALT,
      },
      content: '',
      telegraph: null,
    };
  }
  return JSON.parse(fs.readFileSync(HUB_JSON_PATH, 'utf8'));
}

function writeHubRecord(hub) {
  fs.mkdirSync(path.dirname(HUB_JSON_PATH), { recursive: true });
  fs.writeFileSync(HUB_JSON_PATH, `${JSON.stringify(hub, null, 2)}\n`, 'utf8');
}

function loadPublishedPosts() {
  if (!fs.existsSync(POSTS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, name), 'utf8')))
    .filter((post) => post.telegraph?.url)
    .sort((a, b) => {
      const aTime = a.telegraph?.publishedAt || a.dateCreated || '';
      const bTime = b.telegraph?.publishedAt || b.dateCreated || '';
      return bTime.localeCompare(aTime);
    });
}

function buildHubHtml(posts) {
  const count = posts.length;
  const intro = count
    ? `<p>This page lists <strong>${count}</strong> DRMN articles on <a href="https://telegra.ph/">Telegraph</a> — short SEO guides about sleep sounds, focus audio, white noise, and ambient noise. Part of an open content experiment linking back to <a href="${SITE_LINK}">drmn.xyz</a>.</p>`
    : `<p>DRMN articles on <a href="https://telegra.ph/">Telegraph</a> will appear here as they are published. Visit <a href="${SITE_LINK}">drmn.xyz</a> for the main site.</p>`;

  const items = posts
    .map((post) => {
      const summary = truncate(post.excerpt || post.description);
      const title = escapeHtml(post.title);
      const url = post.telegraph.url;
      return `<li><a href="${url}">${title}</a>${summary ? ` — ${escapeHtml(summary)}` : ''}</li>`;
    })
    .join('\n');

  const articlesBlock = count
    ? `<h3>Articles</h3>\n<ul>\n${items}\n</ul>`
    : '';

  return `${intro}
${articlesBlock}
<h3>DRMN</h3>
<p>Try sleep and focus sounds on iPhone: <a href="${APP_STORE_URL}">App Store</a> · <a href="${SITE_LINK}">Website</a> · <a href="${BLOG_LINK}">Blog</a></p>`;
}

async function updateTelegraphHub() {
  const posts = loadPublishedPosts();
  const hub = loadHubRecord();
  const content = buildHubHtml(posts);

  const nodes = htmlToTelegraphNodes(content, {
    heroImageUrl: hub.hero?.url || DEFAULT_OG_LOGO,
    heroAlt: hub.hero?.alt || HUB_HERO_ALT,
  });

  console.log(`[telegraph:hub] updating index (${posts.length} article(s))…`);

  const page = await publishPage({
    title: hub.title || HUB_TITLE,
    content: nodes,
    path: hub.telegraph?.path || undefined,
  });

  const updated = {
    ...hub,
    title: hub.title || HUB_TITLE,
    description: HUB_DESCRIPTION,
    content,
    dateModified: todayIsoDate(),
    telegraph: {
      path: page.path,
      url: page.url,
      publishedAt: new Date().toISOString(),
    },
  };

  if (!updated.dateCreated) {
    updated.dateCreated = todayIsoDate();
  }

  writeHubRecord(updated);
  console.log(`[telegraph:hub] ${hub.telegraph?.path ? 'updated' : 'created'}: ${page.url}`);
  return updated;
}

module.exports = {
  buildHubHtml,
  loadPublishedPosts,
  updateTelegraphHub,
  HUB_JSON_PATH,
};
