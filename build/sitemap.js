const fs = require('fs');
const path = require('path');

const { SITE_URL, URLS, DEFAULT_LANGUAGE, BLOG_POSTS_PER_PAGE } = require('./constants');
const { loadPosts, collectBlogUrls } = require('./blog/build-blog');

function getBlogSitemapUrls(siteOrigin) {
    try {
        const posts = loadPosts();
        if (posts.length === 0) {
            return [];
        }
        const totalPages = Math.max(1, Math.ceil(posts.length / BLOG_POSTS_PER_PAGE));
        return collectBlogUrls(posts.map((post) => ({
            ...post,
            canonical: `${siteOrigin}/blog/${post.slug}/`
        })), totalPages);
    } catch (error) {
        console.warn(`Warning: blog URLs omitted from sitemap (${error.message})`);
        return [];
    }
}

function generateSitemap({ projectRoot = path.join(__dirname, '..') } = {}) {
    const sitemapPath = path.join(projectRoot, 'sitemap.xml');
    const robotsPath = path.join(projectRoot, 'robots.txt');

    const lastmod = new Date().toISOString().slice(0, 10);
    const siteOrigin = SITE_URL.replace(/\/$/, '');
    const legalUrls = [`${siteOrigin}/privacy.html`, `${siteOrigin}/terms.html`];
    const blogUrls = getBlogSitemapUrls(siteOrigin);

    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    lines.push('<urlset ');
    lines.push('  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    lines.push('  xmlns:xhtml="http://www.w3.org/1999/xhtml">');
    lines.push('  ');
    const defaultUrl = URLS.find(({ lang }) => lang === DEFAULT_LANGUAGE)?.url ?? SITE_URL;
    for (const { url: loc } of URLS) {
        lines.push('  <url>');
        lines.push(`    <loc>${loc}</loc>`);
        for (const { lang, url } of URLS) {
            lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${url}" />`);
        }
        lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push('    <priority>1.0</priority>');
        lines.push('  </url>');
        lines.push('');
    }
    for (const loc of legalUrls) {
        lines.push('  <url>');
        lines.push(`    <loc>${loc}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push('    <priority>0.5</priority>');
        lines.push('  </url>');
        lines.push('');
    }
    for (const loc of blogUrls) {
        const isFeed = loc.endsWith('feed.xml');
        lines.push('  <url>');
        lines.push(`    <loc>${loc}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push(`    <priority>${isFeed ? '0.4' : '0.8'}</priority>`);
        lines.push('  </url>');
        lines.push('');
    }
    lines.push('</urlset>');

    fs.writeFileSync(sitemapPath, lines.join('\n') + '\n', 'utf8');
    console.log('✅ Successfully built sitemap.xml');
    console.log(`📁 Output saved to: ${sitemapPath}`);
    if (blogUrls.length > 0) {
        console.log(`📰 Sitemap includes ${blogUrls.length} blog URL(s)`);
    }
    console.log();

    const robots = `
User-agent: *
Allow: /

Sitemap: ${SITE_URL}sitemap.xml 
  `;
    fs.writeFileSync(robotsPath, robots.trim() + '\n', 'utf8');
    console.log('✅ Successfully built robots.txt');
    console.log(`📁 Output saved to: ${robotsPath}`);
    console.log();

    return { sitemapPath, robotsPath, blogUrls };
}

if (require.main === module) {
    generateSitemap();
}

module.exports = {
    generateSitemap,
    getBlogSitemapUrls
};
