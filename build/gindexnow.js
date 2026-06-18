const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const key = require('../service_account.json');
const { URLS, ADDITIONAL_URLS } = require('./constants');

const BATCH_SIZE = 100;
const INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing';
const BATCH_URL = 'https://indexing.googleapis.com/batch';

function getIndexableUrls() {
    const urlsPath = path.resolve(__dirname, '..', 'urls.txt');
    if (fs.existsSync(urlsPath)) {
        return fs.readFileSync(urlsPath, 'utf8')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }
    return URLS.map(({ url }) => url);
}

function chunk(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function buildBatchBody(urls) {
    const boundary = `batch_${crypto.randomUUID().replace(/-/g, '')}`;
    const parts = urls.map((url, index) => {
        const payload = JSON.stringify({ url, type: 'URL_UPDATED' });
        const httpRequest = [
            'POST /v3/urlNotifications:publish HTTP/1.1',
            'Content-Type: application/json',
            `Content-Length: ${Buffer.byteLength(payload)}`,
            '',
            payload,
        ].join('\r\n');

        return [
            `--${boundary}`,
            'Content-Type: application/http',
            'Content-Transfer-Encoding: binary',
            `Content-ID: <${index + 1}>`,
            '',
            httpRequest,
        ].join('\r\n');
    });

    return {
        boundary,
        body: `${parts.join('\r\n')}\r\n--${boundary}--\r\n`,
    };
}

async function submitBatch(urls, accessToken) {
    const { boundary, body } = buildBatchBody(urls);
    const response = await fetch(BATCH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/mixed; boundary=${boundary}`,
        },
        body,
    });

    return {
        ok: response.ok,
        status: response.status,
        body: await response.text(),
    };
}

function parseBatchResponse(rawBody) {
    const results = [];
    const partPattern = /HTTP\/1\.1 (\d+) ([^\r\n]+)[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--batch_|\r\n--[^\r\n]+--\s*$)/g;

    for (const match of rawBody.matchAll(partPattern)) {
        const [, statusCode, statusText, payload] = match;
        const trimmed = payload.trim();

        if (trimmed.startsWith('{')) {
            try {
                const json = JSON.parse(trimmed);
                results.push({
                    statusCode: Number(statusCode),
                    statusText,
                    url: json.urlNotificationMetadata?.url,
                    error: json.error?.message,
                });
                continue;
            } catch {
                // fall through
            }
        }

        results.push({ statusCode: Number(statusCode), statusText, error: trimmed || undefined });
    }

    return results;
}

function logBatchResults(results) {
    const ok = results.filter((item) => item.statusCode >= 200 && item.statusCode < 300);
    const failed = results.filter((item) => item.statusCode < 200 || item.statusCode >= 300);

    console.log(`   ✓ ${ok.length} accepted, ✗ ${failed.length} failed`);

    const errorsByMessage = new Map();
    for (const item of failed) {
        const key = `${item.statusCode} ${item.statusText}|${item.error || ''}`;
        errorsByMessage.set(key, (errorsByMessage.get(key) || 0) + 1);
    }

    for (const [key, count] of errorsByMessage) {
        const [status, message] = key.split('|');
        const suffix = count > 1 ? ` (×${count})` : '';
        console.error(`   ✗ HTTP ${status}${suffix}`);
        if (message) {
            console.error(`     ${message}`);
        }
    }
}

async function main() {
    console.log('🚀 Starting Google Indexing API batch submit...');

    const urls = Array.from(new Set([...getIndexableUrls(), ...ADDITIONAL_URLS]));
    console.log(`📋 ${urls.length} URL(s) to notify`);

    const client = new google.auth.JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: [INDEXING_SCOPE],
    });

    await client.authorize();
    const accessToken = client.credentials.access_token;

    const batches = chunk(urls, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log();
        console.log(`📦 Batch ${i + 1}/${batches.length} (${batch.length} URL(s))`);
        batch.forEach((url) => console.log(`   • ${url}`));

        const { ok, status, body } = await submitBatch(batch, accessToken);
        const results = parseBatchResponse(body);
        const hasFailures = results.some((item) => item.statusCode < 200 || item.statusCode >= 300);

        if (ok && !hasFailures) {
            console.log(`✅ Batch ${i + 1} accepted (HTTP ${status})`);
        } else {
            console.error(`❌ Batch ${i + 1} had failures (HTTP ${status})`);
            process.exitCode = 1;
        }

        logBatchResults(results);
        console.log('-'.repeat(30));
    }
}

main().catch((error) => {
    console.error('❌ Google Indexing API submit failed.');
    console.error(error);
    process.exitCode = 1;
});
