#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { auditBlogPost, parsePostSlugFromUrl } = require('./blogPostContentQuality');

const ROOT_DIR = path.join(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT_DIR, 'build', 'blog', 'posts');

function loadAllPosts() {
    if (!fs.existsSync(POSTS_DIR)) {
        return [];
    }
    return fs.readdirSync(POSTS_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((name) => JSON.parse(fs.readFileSync(path.join(POSTS_DIR, name), 'utf8')));
}

function loadPostBySlug(slug) {
    const filePath = path.join(POSTS_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Post not found: build/blog/posts/${slug}.json`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatReport(slug, result) {
    const lines = [
        `Blog post audit: ${slug}`,
        `Score: ${result.score}/100`,
        `Metrics: ${result.metrics.wordCount} words, ${result.metrics.faqCount} FAQ, ${result.metrics.internalLinkCount} internal links, keyword "${result.metrics.primaryKeyword}" @ ${(result.metrics.keywordDensity * 100).toFixed(1)}%`,
        `Source: build/blog/posts/${slug}.json`,
        ''
    ];

    if (result.critical?.length) {
        lines.push('CRITICAL (blocks indexing / fails CI):');
        result.critical.forEach((item) => lines.push(`  - ${item}`));
        lines.push('');
    }

    if (result.quality?.length) {
        lines.push('QUALITY (fix for SEO/GEO):');
        result.quality.forEach((item) => lines.push(`  - ${item}`));
        lines.push('');
    }

    if (result.warnings?.length) {
        lines.push('WARNINGS:');
        result.warnings.forEach((item) => lines.push(`  - ${item}`));
    }

    if (!result.critical?.length && !result.quality?.length && !result.warnings?.length) {
        lines.push('No issues found.');
    }

    return lines.join('\n');
}

function main() {
    const input = process.argv[2];
    const jsonOutput = process.argv.includes('--json');
    const strict = process.argv.includes('--strict');

    if (!input) {
        console.error('Usage: node build/validate/audit-blog-post.js <slug|/blog/slug/|URL> [--json] [--strict]');
        process.exit(1);
    }

    const slug = parsePostSlugFromUrl(input);
    if (!slug) {
        console.error(`Could not parse blog slug from: ${input}`);
        process.exit(1);
    }

    const post = loadPostBySlug(slug);
    const allPosts = loadAllPosts();
    const otherPosts = allPosts.filter((p) => p.slug !== slug);
    const result = auditBlogPost(post, { strict, otherPosts });

    if (jsonOutput) {
        console.log(JSON.stringify({ slug, source: `build/blog/posts/${slug}.json`, ...result }, null, 2));
    } else {
        console.log(formatReport(slug, result));
    }

    process.exit(strict ? (result.ok ? 0 : 1) : (result.critical?.length ? 1 : 0));
}

if (require.main === module) {
    main();
}

module.exports = { formatReport, loadPostBySlug };
