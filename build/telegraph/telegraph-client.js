'use strict';

require('../../load-env');

const { SITE_URL, AUTHOR_URL } = require('../constants');

const TELEGRAPH_API = 'https://api.telegra.ph';
const DEFAULT_AUTHOR = 'Vladimir Ivakhnenko';

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

async function telegraphRequest(method, params = {}, pathSegment = '') {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      body.set(key, typeof value === 'string' ? value : String(value));
    }
  }

  const url = pathSegment
    ? `${TELEGRAPH_API}/${method}/${pathSegment}`
    : `${TELEGRAPH_API}/${method}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || `Telegraph API error (${method})`);
  }
  return data.result;
}

async function createAccount({ shortName, authorName, authorUrl }) {
  return telegraphRequest('createAccount', {
    short_name: shortName || 'DRMN',
    author_name: authorName || DEFAULT_AUTHOR,
    author_url: authorUrl || AUTHOR_URL,
  });
}

async function getAccessToken() {
  const existing = stripEnvValue(process.env.TELEGRAPH_ACCESS_TOKEN);
  if (existing) {
    return existing;
  }

  console.warn('[telegraph] TELEGRAPH_ACCESS_TOKEN not set — creating a new account…');
  const account = await createAccount({
    shortName: stripEnvValue(process.env.TELEGRAPH_SHORT_NAME) || 'DRMN',
    authorName: stripEnvValue(process.env.TELEGRAPH_AUTHOR_NAME) || DEFAULT_AUTHOR,
    authorUrl: stripEnvValue(process.env.TELEGRAPH_AUTHOR_URL) || SITE_URL.replace(/\/$/, ''),
  });

  console.warn(`[telegraph] Save this token in .env:\nTELEGRAPH_ACCESS_TOKEN=${account.access_token}`);
  return account.access_token;
}

/**
 * @param {{ title: string, content: Array, authorName?: string, authorUrl?: string, path?: string }}
 */
async function publishPage({ title, content, authorName, authorUrl, path: pagePath }) {
  const accessToken = await getAccessToken();
  const contentJson = JSON.stringify(content);
  const sizeKb = Buffer.byteLength(contentJson, 'utf8') / 1024;
  if (sizeKb > 64) {
    throw new Error(`Telegraph content is ${sizeKb.toFixed(1)} KB — limit is 64 KB`);
  }

  const params = {
    access_token: accessToken,
    title,
    author_name: authorName || stripEnvValue(process.env.TELEGRAPH_AUTHOR_NAME) || DEFAULT_AUTHOR,
    author_url: authorUrl || stripEnvValue(process.env.TELEGRAPH_AUTHOR_URL) || SITE_URL.replace(/\/$/, ''),
    content: contentJson,
    return_content: 'true',
  };

  if (pagePath) {
    return telegraphRequest('editPage', params, pagePath);
  }
  return telegraphRequest('createPage', params);
}

module.exports = {
  createAccount,
  getAccessToken,
  publishPage,
};
