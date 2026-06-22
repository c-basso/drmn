'use strict';

require('../load-env');

const fs = require('fs/promises');
const path = require('path');
const { createApi } = require('unsplash-js');

const UNSPLASH_API = 'https://api.unsplash.com';
const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);

/** Verified CDN fallbacks when the Unsplash API is unavailable (503, etc.). */
const CURATED_FALLBACK_PHOTOS = [
  {
    id: '1505693416388-ac5ce068fe85',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
    tags: ['bedroom', 'night', 'sleep', 'cozy', 'ambient', 'circadian', 'morning', 'curtains'],
  },
  {
    id: '1586023492125-27b2c045efd7',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1600&q=80',
    tags: ['bedroom', 'lamp', 'night', 'sleep', 'calm', 'pink', 'noise'],
  },
  {
    id: '1615529328331-f8917597711f',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=1600&q=80',
    tags: ['headphones', 'pillow', 'bedroom', 'volume', 'quiet', 'decibel', 'audio'],
  },
  {
    id: '1540518614846-7eded433c457',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1600&q=80',
    tags: ['desk', 'focus', 'workspace', 'work', 'study', 'office', 'productivity'],
  },
  {
    id: '1573496359142-b8d87734a5a2',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1600&q=80',
    tags: ['rain', 'window', 'night', 'storm', 'focus', 'calm'],
  },
  {
    id: '1497366216548-37526070297c',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
    tags: ['office', 'workspace', 'minimal', 'focus', 'desk', 'sound', 'masking'],
  },
  {
    id: '1518609878373-06d740f60d8b',
    user: 'Unsplash',
    url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1600&q=80',
    tags: ['nature', 'forest', 'morning', 'frequency', 'wave', 'calm'],
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableUnsplashError(error) {
  const message = String(error?.message || error);
  return RETRYABLE_HTTP_STATUSES.has(error?.status)
    || /\bHTTP (429|502|503|504)\b/.test(message)
    || /experiencing errors/i.test(message);
}

async function retryWithBackoff(label, fn, { retries = 2, baseMs = 1500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableUnsplashError(error) || attempt === retries) {
        throw error;
      }
      const waitMs = baseMs * (2 ** attempt);
      console.warn(`[unsplash] ${label} failed (${error.message}) — retry ${attempt + 1}/${retries} in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError;
}

function stripEnvValue(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    s = s.slice(1, -1);
  }
  return s;
}

function getAccessKey() {
  const accessKey = stripEnvValue(process.env.UNSPLASH_ACCESS_KEY);
  if (!accessKey) {
    throw new Error('Set UNSPLASH_ACCESS_KEY in .env — https://unsplash.com/oauth/applications');
  }
  if (accessKey.length < 20) {
    throw new Error('UNSPLASH_ACCESS_KEY looks invalid (too short)');
  }
  return accessKey;
}

async function unsplashFetch(url, options = {}) {
  let target = url;
  let init = options;

  if (url && typeof url === 'object' && typeof url.url === 'string') {
    target = url.url;
    init = {
      method: url.method,
      headers: url.headers,
      body: url.body,
      signal: url.signal,
      ...options,
    };
  }

  const targetUrl = typeof target === 'string' ? target : String(target);
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  try {
    return await fetch(targetUrl, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
  } catch (err) {
    const cause = err.cause?.message || err.cause || '';
    throw new Error(
      `Unsplash fetch failed: ${err.message}${cause ? ` — ${cause}` : ''}`,
    );
  }
}

function getUnsplashClient(accessKey) {
  return createApi({
    accessKey,
    fetch: (url, options) => unsplashFetch(url, options),
  });
}

function mapPhoto(photo) {
  return {
    id: photo.id,
    url: photo.urls?.regular || photo.urls?.small,
    user: photo.user?.name || 'unknown',
    downloadLocation: photo.links?.download_location,
  };
}

async function searchPhotosDirect(query, accessKey, perPage, orientation, page = 1) {
  const url = new URL(`${UNSPLASH_API}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('order_by', 'relevant');
  if (orientation) {
    url.searchParams.set('orientation', orientation);
  }

  const res = await unsplashFetch(url.href, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unsplash API: invalid JSON (${res.status})`);
  }

  if (!res.ok) {
    const msg = json?.errors?.join?.(', ') || json?.error || text || res.statusText;
    const error = new Error(`Unsplash API HTTP ${res.status}: ${msg}`);
    error.status = res.status;
    throw error;
  }

  return (json.results || []).map(mapPhoto).filter((p) => p.url);
}

/**
 * @returns {Promise<Array<{ id: string, url: string, user: string, downloadLocation?: string }>>}
 */
async function searchPhotos(query, options = {}) {
  const perPage = options.perPage ?? 10;
  const orientation = options.orientation ?? 'landscape';
  const page = options.page ?? 1;
  const accessKey = getAccessKey();

  console.log(`[unsplash] search: "${query}" (orientation=${orientation}, page=${page})`);

  const queryParams = {
    query,
    per_page: perPage,
    order_by: 'relevant',
    page,
  };
  if (orientation) {
    queryParams.orientation = orientation;
  }

  try {
    const unsplash = getUnsplashClient(accessKey);
    const { data, error } = await unsplash.GET('/search/photos', {
      params: { query: queryParams },
    });

    if (error) {
      const apiError = new Error(`Unsplash: ${JSON.stringify(error)}`);
      if (Array.isArray(error.errors) && /experiencing errors/i.test(error.errors.join(' '))) {
        apiError.status = 503;
      }
      throw apiError;
    }
    if (!data?.results?.length) {
      return [];
    }

    return data.results.map(mapPhoto).filter((p) => p.url);
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn(`[unsplash] SDK request failed (${msg}), retry via REST API…`);
    return retryWithBackoff(`search "${query}"`, () =>
      searchPhotosDirect(query, accessKey, perPage, orientation, page),
    );
  }
}

async function triggerDownload(accessKey, downloadLocation) {
  if (!downloadLocation) return;
  try {
    await unsplashFetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
  } catch {
    /* optional */
  }
}

async function downloadPhotoToFile(photo, destPath) {
  const accessKey = getAccessKey();
  await triggerDownload(accessKey, photo.downloadLocation);

  const res = await retryWithBackoff(`download ${photo.id}`, () => unsplashFetch(photo.url));
  if (!res.ok) {
    const error = new Error(`Download photo: HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buf);
  console.log(`[unsplash] saved: ${destPath}`);
  return destPath;
}

function scoreCuratedPhoto(photo, query) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return terms.reduce((score, term) => (
    photo.tags.some((tag) => tag.includes(term) || term.includes(tag)) ? score + 1 : score
  ), 0);
}

function pickCuratedFallbackPhoto(query, options = {}) {
  const excludeIds = new Set(options.excludeIds || []);
  const candidates = CURATED_FALLBACK_PHOTOS
    .filter((photo) => !excludeIds.has(photo.id))
    .map((photo) => ({ photo, score: scoreCuratedPhoto(photo, query) }))
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    throw new Error(`No curated fallback photos left for "${query}"`);
  }

  const bestScore = candidates[0].score;
  const tied = candidates.filter((entry) => entry.score === bestScore);
  return tied[options.preferredIndex % tied.length]?.photo || candidates[0].photo;
}

async function fetchCuratedFallbackPhoto(query, destPath, options = {}) {
  const photo = pickCuratedFallbackPhoto(query, options);
  console.warn(`[unsplash] API unavailable — using curated fallback id=${photo.id}`);
  await downloadPhotoToFile(photo, destPath);
  return { ...photo, localPath: destPath, fallback: true };
}

async function fetchBackgroundPhotoFromApi(query, destPath, options = {}) {
  const excludeIds = new Set(options.excludeIds || []);
  const orientation = options.orientation ?? 'landscape';
  const perPage = options.perPage ?? 30;
  const maxPages = options.maxPages ?? 3;
  const preferredIndex = Number(options.index) || 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const photos = await searchPhotos(query, { perPage, orientation, page });
    if (!photos.length) {
      break;
    }

    const unused = photos.filter((photo) => !excludeIds.has(photo.id));
    if (unused.length) {
      const pick = unused[preferredIndex] ?? unused[0];
      await downloadPhotoToFile(pick, destPath);
      return { ...pick, localPath: destPath };
    }
  }

  const fallback = await searchPhotos(query, { perPage: 10, orientation, page: 1 });
  if (!fallback.length) {
    throw new Error(`Unsplash: no results for "${query}" (orientation=${orientation})`);
  }

  const pick = fallback[preferredIndex] ?? fallback[fallback.length - 1];
  console.warn(
    `[unsplash] all results on pages 1-${maxPages} already used for "${query}" — reusing id=${pick.id}`,
  );
  await downloadPhotoToFile(pick, destPath);
  return { ...pick, localPath: destPath };
}

/** Photo for query; skips IDs in `options.excludeIds` and walks search pages when needed. */
async function fetchBackgroundPhoto(query, destPath, options = {}) {
  try {
    return await fetchBackgroundPhotoFromApi(query, destPath, options);
  } catch (error) {
    if (!isRetryableUnsplashError(error) && !/no results for/i.test(String(error.message))) {
      throw error;
    }
    return fetchCuratedFallbackPhoto(query, destPath, options);
  }
}

module.exports = {
  searchPhotos,
  downloadPhotoToFile,
  fetchBackgroundPhoto,
  fetchCuratedFallbackPhoto,
  getAccessKey,
};
