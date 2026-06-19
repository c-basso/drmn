const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
    BLOG_INDEX_JSON_LD_TYPES,
    BLOG_POST_JSON_LD_TYPES
} = require('../constants');
const { getBlogBuildManifest } = require('../blog/build-blog');
const { extractDocumentTitle } = require('./seoValidator');
const { extractMetaTags } = require('./opengraphValidator');
const {
    extractJsonLdBlocks,
    parseJsonLdBlock,
    expandJsonLdBlock,
    normalizeJsonLdTypes
} = require('./jsonLdValidator');


const UNSAFE_XML_AMP = /&(?!amp;|lt;|gt;|quot;|apos;|#x?[0-9a-fA-F]+;)/;

function hasUnreplacedTemplateVars(html) {
    return /\{\{[^}]+\}\}/.test(html);
}

function extractLinkRel(html, rel) {
    const re = new RegExp(`<link\\s[^>]*rel=["']${rel}["'][^>]*>`, 'i');
    const match = html.match(re);
    if (!match) {
        return null;
    }
    const hrefMatch = match[0].match(/\bhref=["']([^"']+)["']/i);
    return hrefMatch ? hrefMatch[1] : null;
}

const BLOG_TITLE_HARD_MAX = 85;
const BLOG_TITLE_WARN_MAX = 70;

function validateBlogSeo(html, pageMeta) {
    const errors = [];
    const warnings = [];
    const { file } = pageMeta;

    const title = extractDocumentTitle(html);
    if (title === null) {
        errors.push('missing <title> element');
    } else if (!title.length) {
        errors.push('<title> is empty');
    } else if (title.length < 25) {
        errors.push(`<title> too short: ${title.length} characters`);
    } else if (title.length > BLOG_TITLE_HARD_MAX) {
        errors.push(`<title> too long: ${title.length} characters (max ${BLOG_TITLE_HARD_MAX} for blog)`);
    } else if (title.length > BLOG_TITLE_WARN_MAX) {
        warnings.push(`<title> length ${title.length} exceeds typical SERP display (~${BLOG_TITLE_WARN_MAX} chars)`);
    }

    const metaTags = extractMetaTags(html);
    const description = metaTags.description;
    if (description === undefined) {
        errors.push('missing <meta name="description">');
    } else if (!String(description).trim().length) {
        errors.push('<meta name="description"> has empty content');
    } else {
        const len = String(description).trim().length;
        if (len < 50) {
            errors.push(`meta description too short: ${len} characters`);
        } else if (len > 165) {
            errors.push(`meta description too long: ${len} characters`);
        } else if (len < 150 || len > 160) {
            warnings.push(`meta description length ${len} is outside optimal range 150–160`);
        }
    }

    return { ok: errors.length === 0, errors, warnings, meta: { file, ...pageMeta } };
}

function validateBlogHtmlPage(html, pageMeta) {
    const errors = [];
    const warnings = [];
    const { file, kind } = pageMeta;

    if (hasUnreplacedTemplateVars(html)) {
        errors.push('unreplaced template variables ({{...}}) found in HTML');
    }

    const seo = validateBlogSeo(html, pageMeta);
    if (!seo.ok) {
        errors.push(...seo.errors);
    }
    warnings.push(...seo.warnings);

    const canonical = extractLinkRel(html, 'canonical');
    if (!canonical) {
        errors.push('missing <link rel="canonical">');
    } else if (pageMeta.url && canonical !== pageMeta.url) {
        errors.push(`canonical mismatch: expected ${pageMeta.url}, got ${canonical}`);
    }

    if (kind === 'index' || kind === 'pagination') {
        const rss = extractLinkRel(html, 'alternate');
        if (!rss || !/feed\.xml$/i.test(rss)) {
            errors.push('missing RSS alternate link (<link rel="alternate" type="application/rss+xml">)');
        }
    }

    const expectedTypes = kind === 'post' ? BLOG_POST_JSON_LD_TYPES : BLOG_INDEX_JSON_LD_TYPES;
    const blocks = extractJsonLdBlocks(html);
    if (blocks.length === 0) {
        errors.push('no JSON-LD blocks found');
    } else {
        const foundTypes = new Set();
        blocks.forEach((block, index) => {
            const parsed = parseJsonLdBlock(block);
            if (!parsed.ok) {
                errors.push(`JSON-LD block #${index + 1}: ${parsed.error}`);
                return;
            }
            normalizeJsonLdTypes(parsed.type).forEach((type) => foundTypes.add(type));
        });

        for (const expectedType of expectedTypes) {
            if (!foundTypes.has(expectedType)) {
                errors.push(`missing JSON-LD @type: ${expectedType}`);
            }
        }
    }

    const requiredOg = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    for (const tag of requiredOg) {
        const re = new RegExp(`<meta\\s+property=["']${tag}["']\\s+content=["'][^"']+["']`, 'i');
        if (!re.test(html)) {
            errors.push(`missing Open Graph meta: ${tag}`);
        }
    }
    if (kind === 'post' && !/property=["']og:type["']\s+content=["']article["']/i.test(html)) {
        warnings.push('og:type is not "article" on blog post');
    }

    return { ok: errors.length === 0, errors, warnings, meta: pageMeta };
}

async function validateBlogJsonLdExpansion(html, file) {
    const issues = [];
    const blocks = extractJsonLdBlocks(html);
    for (let i = 0; i < blocks.length; i += 1) {
        const parsed = parseJsonLdBlock(blocks[i]);
        if (!parsed.ok) {
            continue;
        }
        try {
            await expandJsonLdBlock(parsed.obj);
        } catch (error) {
            issues.push(`JSON-LD block #${i + 1} expansion failed: ${error.message}`);
        }
    }
    return issues;
}

function validateXmlWithXmllint(filePath) {
    const result = spawnSync('xmllint', ['--noout', filePath], { encoding: 'utf8' });
    if (result.error?.code === 'ENOENT') {
        return { ok: true, skipped: true };
    }
    if (result.status === 0) {
        return { ok: true };
    }
    const message = (result.stderr || result.stdout || '').trim();
    return { ok: false, error: message || 'xmllint failed' };
}

function decodeXmlEntities(value) {
    return String(value)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

function extractRssItems(xml) {
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRe.exec(xml)) !== null) {
        const block = match[1];
        const pick = (tag) => {
            const cdata = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'));
            if (cdata) {
                return cdata[1].trim();
            }
            const plain = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
            return plain ? decodeXmlEntities(plain[1].trim()) : null;
        };
        items.push({
            title: pick('title'),
            link: pick('link'),
            guid: pick('guid'),
            pubDate: pick('pubDate'),
            description: pick('description')
        });
    }
    return items;
}

function validateBlogRss(feedPath, posts) {
    const errors = [];
    const warnings = [];

    if (!fs.existsSync(feedPath)) {
        return { ok: false, errors: [`missing RSS feed: ${feedPath}`], warnings: [] };
    }

    const xml = fs.readFileSync(feedPath, 'utf8');

    if (UNSAFE_XML_AMP.test(xml)) {
        errors.push('RSS contains unescaped ampersands (& must be &amp;)');
    }

    const xmlCheck = validateXmlWithXmllint(feedPath);
    if (!xmlCheck.ok) {
        errors.push(`invalid RSS XML: ${xmlCheck.error}`);
    } else if (xmlCheck.skipped) {
        warnings.push('xmllint not available; skipped strict XML parse (basic checks only)');
    }

    for (const tag of ['<rss', '<channel>', '<title>', '<link>', '<description>', '<language>']) {
        if (!xml.includes(tag)) {
            errors.push(`RSS missing required element: ${tag}`);
        }
    }

    const atomSelf = /<atom:link\b[^>]*\brel=["']self["'][^>]*>/i.test(xml);
    if (!atomSelf) {
        errors.push('RSS missing atom:link rel="self"');
    }

    const items = extractRssItems(xml);
    if (items.length !== posts.length) {
        errors.push(`RSS item count mismatch: expected ${posts.length}, got ${items.length}`);
    }

    for (const post of posts) {
        const item = items.find((entry) => entry.link === post.canonical);
        if (!item) {
            errors.push(`RSS missing item for post: ${post.slug}`);
            continue;
        }
        if (!item.title || item.title !== post.title) {
            errors.push(`RSS item title mismatch for post: ${post.slug}`);
        }
        if (!item.pubDate) {
            errors.push(`RSS item missing pubDate for post: ${post.slug}`);
        }
        if (!item.description) {
            errors.push(`RSS item missing description for post: ${post.slug}`);
        }
    }

    return { ok: errors.length === 0, errors, warnings };
}

function validateBlogUrlsInSitemap(projectRoot, expectedUrls) {
    const sitemapPath = path.join(projectRoot, 'sitemap.xml');
    const errors = [];

    if (expectedUrls.length === 0) {
        return { ok: true, errors: [] };
    }

    if (!fs.existsSync(sitemapPath)) {
        return { ok: false, errors: ['missing sitemap.xml (run build or npm run sitemap)'] };
    }

    const sitemap = fs.readFileSync(sitemapPath, 'utf8');
    for (const url of expectedUrls) {
        if (!sitemap.includes(`<loc>${url}</loc>`)) {
            errors.push(`sitemap.xml missing blog URL: ${url}`);
        }
    }

    return { ok: errors.length === 0, errors };
}

async function validateBlog() {
    const projectRoot = path.join(__dirname, '..', '..');
    const manifest = getBlogBuildManifest(projectRoot);

    if (manifest.posts.length === 0) {
        console.log('ℹ️  No blog posts — skipping blog validation');
        return { ok: true, skipped: true };
    }

    console.log(`Validating blog (${manifest.pages.length} HTML page(s), RSS, sitemap)...`);

    const pageResults = [];
    let allOk = true;

    for (const page of manifest.pages) {
        if (!fs.existsSync(page.file)) {
            allOk = false;
            pageResults.push({
                ok: false,
                errors: [`missing built HTML file: ${page.file}`],
                warnings: [],
                meta: page
            });
            continue;
        }

        const html = fs.readFileSync(page.file, 'utf8');
        const result = validateBlogHtmlPage(html, page);
        const expansionErrors = await validateBlogJsonLdExpansion(html, page.file);
        if (expansionErrors.length > 0) {
            result.errors.push(...expansionErrors);
            result.ok = false;
        }

        pageResults.push(result);
        if (!result.ok) {
            allOk = false;
        } else {
            const label = page.kind === 'post' ? page.slug : page.kind;
            console.log(`  blog/${label}: OK`);
            result.warnings.forEach((warning) => console.log(`    ⚠️  ${warning}`));
        }
    }

    const rssResult = validateBlogRss(manifest.feedPath, manifest.posts);
    if (!rssResult.ok) {
        allOk = false;
    } else {
        console.log(`  blog/feed.xml: OK (${manifest.posts.length} item(s))`);
        rssResult.warnings.forEach((warning) => console.log(`    ⚠️  ${warning}`));
    }

    const sitemapResult = validateBlogUrlsInSitemap(projectRoot, manifest.urls);
    if (!sitemapResult.ok) {
        allOk = false;
    } else {
        console.log(`  sitemap.xml: OK (${manifest.urls.length} blog URL(s))`);
    }

    if (!allOk) {
        console.error('\n❌ Blog validation failed:');
        for (const result of pageResults) {
            if (result.ok) {
                continue;
            }
            const label = result.meta?.slug || result.meta?.kind || 'page';
            console.error(`\n- blog/${label}: ${result.meta?.file}`);
            result.errors.forEach((error) => console.error(`  ❌ ${error}`));
        }
        if (!rssResult.ok) {
            console.error('\n- blog/feed.xml');
            rssResult.errors.forEach((error) => console.error(`  ❌ ${error}`));
        }
        if (!sitemapResult.ok) {
            console.error('\n- sitemap.xml');
            sitemapResult.errors.forEach((error) => console.error(`  ❌ ${error}`));
        }
    } else {
        console.log('\n✅ Blog validation OK: pages, RSS, and sitemap');
    }

    return {
        ok: allOk,
        pageResults,
        rssResult,
        sitemapResult
    };
}

module.exports = {
    validateBlog,
    validateBlogHtmlPage,
    validateBlogRss,
    validateBlogUrlsInSitemap
};
