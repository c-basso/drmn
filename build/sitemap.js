const fs = require('fs');
const path = require('path');

const { SITE_URL, URLS, DEFAULT_LANGUAGE, BLOG_POSTS_PER_PAGE, ADDITIONAL_URLS } = require('./constants');
const { loadPosts, collectBlogSitemapEntries } = require('./blog/build-blog');
const { collectGuideSitemapEntries } = require('./guides/build-guides');

const SITEMAP_CHILD_DIR = 'sitemaps';
const SITEMAP_INDEX_FILE = 'sitemap.xml';
const SITEMAP_CHILD_FILES = {
    pages: 'pages.xml',
    guides: 'guides.xml',
    legal: 'legal.xml',
    blog: 'blog.xml'
};

function getBlogSitemapEntries(siteOrigin) {
    try {
        const posts = loadPosts();
        if (posts.length === 0) {
            return [];
        }
        const totalPages = Math.max(1, Math.ceil(posts.length / BLOG_POSTS_PER_PAGE));
        return collectBlogSitemapEntries(posts.map((post) => ({
            ...post,
            canonical: `${siteOrigin}/blog/${post.slug}/`
        })), totalPages);
    } catch (error) {
        console.warn(`Warning: blog URLs omitted from sitemap (${error.message})`);
        return [];
    }
}

function getBlogSitemapUrls(siteOrigin) {
    return getBlogSitemapEntries(siteOrigin).map(({ loc }) => loc);
}

function urlsetOpen(withHreflang) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<urlset',
        '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    ];
    if (withHreflang) {
        lines.push('  xmlns:xhtml="http://www.w3.org/1999/xhtml">');
    } else {
        lines.push('>');
    }
    lines.push('  ');
    return lines;
}

function urlsetClose() {
    return ['</urlset>'];
}

function simpleUrlEntry(loc, lastmod, priority) {
    return [
        '  <url>',
        `    <loc>${loc}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <priority>${priority}</priority>`,
        '  </url>',
        ''
    ];
}

function localizedPageEntry(loc, lastmod, alternates, defaultUrl) {
    const lines = [
        '  <url>',
        `    <loc>${loc}</loc>`
    ];
    for (const { lang, url } of alternates) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}" />`);
    }
    lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push('    <priority>1.0</priority>');
    lines.push('  </url>');
    lines.push('');
    return lines;
}

function buildPagesSitemap(lastmod) {
    const defaultUrl = URLS.find(({ slug }) => slug === DEFAULT_LANGUAGE)?.url ?? SITE_URL;
    const lines = urlsetOpen(true);
    for (const { url: loc } of URLS) {
        lines.push(...localizedPageEntry(loc, lastmod, URLS, defaultUrl));
    }
    lines.push(...urlsetClose());
    return lines.join('\n') + '\n';
}

function buildLegalSitemap(siteOrigin, lastmod) {
    const legalUrls = [
        `${siteOrigin}/privacy.html`,
        `${siteOrigin}/terms.html`,
        `${siteOrigin}/about.html`,
        ...ADDITIONAL_URLS.filter((url) => url.startsWith(siteOrigin))
    ];
    const lines = urlsetOpen(false);
    for (const loc of legalUrls) {
        lines.push(...simpleUrlEntry(loc, lastmod, '0.5'));
    }
    lines.push(...urlsetClose());
    return lines.join('\n') + '\n';
}

function buildBlogSitemap(blogEntries) {
    const lines = urlsetOpen(false);
    for (const { loc, lastmod } of blogEntries) {
        const isFeed = loc.endsWith('feed.xml');
        lines.push(...simpleUrlEntry(loc, lastmod, isFeed ? '0.4' : '0.8'));
    }
    lines.push(...urlsetClose());
    return lines.join('\n') + '\n';
}

function buildGuidesSitemap(guideEntries) {
    const lines = urlsetOpen(false);
    for (const { loc, lastmod } of guideEntries) {
        lines.push(...simpleUrlEntry(loc, lastmod, '0.9'));
    }
    lines.push(...urlsetClose());
    return lines.join('\n') + '\n';
}

function buildSitemapIndex(childSitemaps, childLastmods) {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  '
    ];
    for (const [index, loc] of childSitemaps.entries()) {
        lines.push('  <sitemap>');
        lines.push(`    <loc>${loc}</loc>`);
        lines.push(`    <lastmod>${childLastmods[index]}</lastmod>`);
        lines.push('  </sitemap>');
        lines.push('');
    }
    lines.push('</sitemapindex>');
    return lines.join('\n') + '\n';
}

function writeFileEnsuringDir(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function generateSitemap({ projectRoot = path.join(__dirname, '..') } = {}) {
    const indexPath = path.join(projectRoot, SITEMAP_INDEX_FILE);
    const childDir = path.join(projectRoot, SITEMAP_CHILD_DIR);
    const robotsPath = path.join(projectRoot, 'robots.txt');

    const lastmod = new Date().toISOString().slice(0, 10);
    const siteOrigin = SITE_URL.replace(/\/$/, '');
    const blogEntries = getBlogSitemapEntries(siteOrigin);
    const blogUrls = blogEntries.map(({ loc }) => loc);

    const childSitemapUrls = [];
    const childSitemapLastmods = [];
    const writtenChildFiles = [];

    const pagesPath = path.join(childDir, SITEMAP_CHILD_FILES.pages);
    writeFileEnsuringDir(pagesPath, buildPagesSitemap(lastmod));
    childSitemapUrls.push(`${SITE_URL}${SITEMAP_CHILD_DIR}/${SITEMAP_CHILD_FILES.pages}`);
    childSitemapLastmods.push(lastmod);
    writtenChildFiles.push({ name: SITEMAP_CHILD_FILES.pages, urlCount: URLS.length });

    let guideEntries = [];
    try {
        guideEntries = collectGuideSitemapEntries();
    } catch (error) {
        console.warn(`Warning: guide URLs omitted from sitemap (${error.message})`);
    }
    if (guideEntries.length > 0) {
        const guidesPath = path.join(childDir, SITEMAP_CHILD_FILES.guides);
        const guidesLastmod = guideEntries
            .map(({ lastmod: entryLastmod }) => entryLastmod)
            .reduce((max, entryLastmod) => (entryLastmod > max ? entryLastmod : max));
        writeFileEnsuringDir(guidesPath, buildGuidesSitemap(guideEntries));
        childSitemapUrls.push(`${SITE_URL}${SITEMAP_CHILD_DIR}/${SITEMAP_CHILD_FILES.guides}`);
        childSitemapLastmods.push(guidesLastmod);
        writtenChildFiles.push({ name: SITEMAP_CHILD_FILES.guides, urlCount: guideEntries.length });
    }

    const legalPath = path.join(childDir, SITEMAP_CHILD_FILES.legal);
    writeFileEnsuringDir(legalPath, buildLegalSitemap(siteOrigin, lastmod));
    childSitemapUrls.push(`${SITE_URL}${SITEMAP_CHILD_DIR}/${SITEMAP_CHILD_FILES.legal}`);
    childSitemapLastmods.push(lastmod);
    writtenChildFiles.push({ name: SITEMAP_CHILD_FILES.legal, urlCount: 3 + ADDITIONAL_URLS.filter((url) => url.startsWith(siteOrigin)).length });

    if (blogEntries.length > 0) {
        const blogPath = path.join(childDir, SITEMAP_CHILD_FILES.blog);
        const blogLastmod = blogEntries
            .map(({ lastmod: entryLastmod }) => entryLastmod)
            .reduce((max, entryLastmod) => (entryLastmod > max ? entryLastmod : max));
        writeFileEnsuringDir(blogPath, buildBlogSitemap(blogEntries));
        childSitemapUrls.push(`${SITE_URL}${SITEMAP_CHILD_DIR}/${SITEMAP_CHILD_FILES.blog}`);
        childSitemapLastmods.push(blogLastmod);
        writtenChildFiles.push({ name: SITEMAP_CHILD_FILES.blog, urlCount: blogEntries.length });
    } else {
        const staleBlogPath = path.join(childDir, SITEMAP_CHILD_FILES.blog);
        if (fs.existsSync(staleBlogPath)) {
            fs.unlinkSync(staleBlogPath);
        }
    }

    fs.writeFileSync(
        indexPath,
        buildSitemapIndex(childSitemapUrls, childSitemapLastmods),
        'utf8'
    );

    console.log(`✅ Successfully built ${SITEMAP_INDEX_FILE} (sitemap index)`);
    console.log(`📁 Output saved to: ${indexPath}`);
    for (const { name, urlCount } of writtenChildFiles) {
        console.log(`   ↳ ${SITEMAP_CHILD_DIR}/${name} (${urlCount} URL(s))`);
    }
    console.log();

    const robots = `
User-agent: *
Allow: /

Sitemap: ${SITE_URL}${SITEMAP_INDEX_FILE}
  `;
    fs.writeFileSync(robotsPath, robots.trim() + '\n', 'utf8');
    console.log('✅ Successfully built robots.txt');
    console.log(`📁 Output saved to: ${robotsPath}`);
    console.log();

    return {
        sitemapPath: indexPath,
        childDir,
        robotsPath,
        blogUrls,
        childSitemapUrls
    };
}

if (require.main === module) {
    generateSitemap();
}

module.exports = {
    generateSitemap,
    getBlogSitemapEntries,
    getBlogSitemapUrls,
    SITEMAP_CHILD_DIR,
    SITEMAP_INDEX_FILE,
    SITEMAP_CHILD_FILES
};
