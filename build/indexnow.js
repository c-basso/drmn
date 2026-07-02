const path = require('path');
const { URL } = require('url');
const fs = require('fs');

const {
    INDEX_NOW_KEY,
    URLS,
    SITE_URL,
    INDEX_NOW_ENGINES,
    ADDITIONAL_URLS
} = require('./constants');

const INDEXNOW_STATUS = {
    200: { ok: true, label: 'OK — URLs submitted successfully' },
    202: { ok: true, label: 'Accepted — URLs received, will be crawled' },
    400: { ok: false, label: 'Bad request — invalid payload format' },
    403: { ok: false, label: 'Forbidden — key not valid for this host' },
    422: { ok: false, label: 'Unprocessable — URLs do not match host or key file missing' },
    429: { ok: false, label: 'Too many requests — rate limited, try later' }
};

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

function describeStatus(status) {
    const known = INDEXNOW_STATUS[status];
    if (known) {
        return known;
    }
    if (status >= 200 && status < 300) {
        return { ok: true, label: `HTTP ${status} — success` };
    }
    return { ok: false, label: `HTTP ${status} — unexpected response` };
}

async function indexNow(engine, data) {
    const endpoint = `https://${engine}/indexnow`;

    console.log(`🌐 ${engine}`);
    console.log(`   POST ${endpoint}`);
    console.log(`   URLs in batch: ${data.urlList.length}`);

    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.log('   ❌ FAILED — network error');
        console.log(`   ${error.message}`);
        console.log();
        return { engine, ok: false, status: null, body: error.message };
    }

    const body = (await response.text()).trim();
    const { ok, label } = describeStatus(response.status);

    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   ${ok ? '✅' : '❌'} ${label}`);
    if (body) {
        console.log(`   Response body: ${body}`);
    } else {
        console.log('   Response body: (empty)');
    }
    console.log();

    return { engine, ok, status: response.status, body };
}

function initKeyFile() {
    const keyPath = path.resolve(__dirname, '..', `${INDEX_NOW_KEY}.txt`);
    fs.writeFileSync(keyPath, INDEX_NOW_KEY);
    console.log('✅ Key file ready');
    console.log(`   https://${new URL(SITE_URL).hostname}/${INDEX_NOW_KEY}.txt`);
    console.log();
}

(async () => {
    console.log('🚀 IndexNow submit');
    console.log();

    initKeyFile();

    const urlList = Array.from(new Set(getIndexableUrls().concat(ADDITIONAL_URLS)));
    const data = {
        host: new URL(SITE_URL).hostname,
        key: INDEX_NOW_KEY,
        urlList
    };

    console.log(`📦 Host: ${data.host}`);
    console.log(`   Key: ${data.key}`);
    console.log(`   Total URLs: ${urlList.length}`);
    console.log();
    console.log('-'.repeat(50));
    console.log();

    const results = [];
    for (const engine of INDEX_NOW_ENGINES) {
        results.push(await indexNow(engine, data));
    }

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    console.log('-'.repeat(50));
    console.log('📊 Summary');
    console.log(`   ✅ Succeeded: ${succeeded.length}/${results.length}`);
    if (succeeded.length) {
        succeeded.forEach((r) => console.log(`      • ${r.engine} (${r.status})`));
    }
    if (failed.length) {
        console.log(`   ❌ Failed: ${failed.length}/${results.length}`);
        failed.forEach((r) => {
            const statusLabel = r.status != null ? r.status : 'network error';
            console.log(`      • ${r.engine} (${statusLabel})`);
        });
        process.exitCode = 1;
    } else {
        console.log('   All engines accepted the submission.');
    }
    console.log();
})();
