const fs = require('fs');
const path = require('path');

const { renderTemplate, stripHtml } = require('../template-engine');
const { SITE_URL, APP_STORE_URL, APP_ID, DEFAULT_OG_LOGO, getAnalyticsContext } = require('../constants');

const ROOT_DIR = path.join(__dirname, '..', '..');
const PAGES_DIR = path.join(__dirname, 'pages');
const TEMPLATE_PATH = path.join(__dirname, 'template-guide.html');
const GUIDES_OUT_DIR = path.join(ROOT_DIR, 'guides');

const APP_FULL_NAME = 'Sound Machine Deep Sleep DRMN';

const LABELS = {
    logo_alt: 'DRMN sleep sounds app icon',
    guides: 'Guides',
    faq: 'FAQ',
    download: 'Download',
    last_updated: 'Last updated',
    app_full_name: APP_FULL_NAME,
    app_icon_alt: `${APP_FULL_NAME} app icon`,
    download_aria: `Download ${APP_FULL_NAME} on the App Store`,
    badge_alt: 'Download on the App Store',
    faq_heading: 'Frequently asked questions',
    related_heading: 'Related guides',
    privacy: 'Privacy',
    terms: 'Terms',
    blog: 'Blog'
};

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function absoluteGuideUrl(slug) {
    return `${SITE_URL.replace(/\/?$/, '/')}guides/${slug}/`;
}

function formatDisplayDate(isoDate) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${isoDate}T12:00:00Z`));
}

function validateGuide(guide, fileName) {
    const required = [
        'slug', 'title', 'meta_title', 'description', 'kicker', 'lede',
        'datePublished', 'dateModified', 'answer_html', 'body_html',
        'faq_html', 'faq', 'cta_tagline', 'card_title', 'card_description', 'short_title'
    ];
    for (const field of required) {
        if (guide[field] === undefined || guide[field] === '') {
            throw new Error(`Guide ${fileName} is missing required field "${field}"`);
        }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug)) {
        throw new Error(`Guide ${fileName} has invalid slug "${guide.slug}"`);
    }
}

function loadGuides() {
    if (!fs.existsSync(PAGES_DIR)) {
        return [];
    }

    const guides = fs.readdirSync(PAGES_DIR)
        .filter((name) => name.endsWith('.json'))
        .map((fileName) => {
            const guide = readJsonFile(path.join(PAGES_DIR, fileName));
            validateGuide(guide, fileName);
            return guide;
        })
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.slug.localeCompare(b.slug));

    const slugs = new Set();
    for (const guide of guides) {
        if (slugs.has(guide.slug)) {
            throw new Error(`Duplicate guide slug "${guide.slug}"`);
        }
        slugs.add(guide.slug);
    }

    return guides;
}

function buildArticleSchema(guide, canonical) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        author: { '@type': 'Organization', name: 'DRMN' },
        publisher: { '@type': 'Organization', name: 'DRMN', url: SITE_URL, logo: { '@type': 'ImageObject', url: DEFAULT_OG_LOGO } },
        mainEntityOfPage: canonical,
        image: `${SITE_URL.replace(/\/?$/, '/')}img/icon-1024.png`
    };
}

function buildFaqSchema(guide) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: guide.faq.map((item) => ({
            '@type': 'Question',
            name: stripHtml(item.question),
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(item.answer) }
        }))
    };
}

function buildBreadcrumbSchema(guide, canonical) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Guides', item: `${SITE_URL.replace(/\/?$/, '/')}#guides` },
            { '@type': 'ListItem', position: 3, name: guide.title, item: canonical }
        ]
    };
}

function prepareGuideContext(guide, buildTimestamp) {
    const canonical = absoluteGuideUrl(guide.slug);

    return {
        meta: {
            version: buildTimestamp,
            title: guide.meta_title,
            description: guide.description,
            og_title: guide.title,
            og_description: guide.description,
            og_image: `${SITE_URL.replace(/\/?$/, '/')}img/icon-1024.png`,
            canonical,
            app_store_id: APP_ID
        },
        guide: {
            ...guide,
            dateModifiedDisplay: formatDisplayDate(guide.dateModified),
            related: (guide.related || []).map((item) => ({
                title: item.title,
                url: `/guides/${item.slug}/`
            }))
        },
        labels: LABELS,
        cta: { url: APP_STORE_URL },
        footer: { copyright: `© ${new Date(buildTimestamp).getFullYear()} c-basso` },
        seo: {
            structured_data: {
                article: buildArticleSchema(guide, canonical),
                faqpage: buildFaqSchema(guide),
                breadcrumb_list: buildBreadcrumbSchema(guide, canonical)
            }
        },
        analytics: getAnalyticsContext()
    };
}

function buildGuides({ buildTimestamp }) {
    const guides = loadGuides();
    if (guides.length === 0) {
        console.log('ℹ️  No guides found — skipping guides build');
        return [];
    }

    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    for (const guide of guides) {
        const outputDir = path.join(GUIDES_OUT_DIR, guide.slug);
        fs.mkdirSync(outputDir, { recursive: true });
        const context = prepareGuideContext(guide, buildTimestamp);
        const html = renderTemplate(template, context, 'guides');
        fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf8');
        console.log(`✅ Successfully built guides/${guide.slug}/index.html`);
    }

    console.log(`📁 Guides: ${guides.length} page(s)`);
    return collectGuideUrls(guides);
}

function collectGuideUrls(guides = loadGuides()) {
    return guides.map((guide) => absoluteGuideUrl(guide.slug));
}

function collectGuideSitemapEntries() {
    return loadGuides().map((guide) => ({
        loc: absoluteGuideUrl(guide.slug),
        lastmod: String(guide.dateModified || guide.datePublished).slice(0, 10)
    }));
}

/** Landing-page guide cards (same content for every locale; guides are English). */
function getGuideCards() {
    const guides = loadGuides();
    return {
        items: guides.map((guide) => ({
            title: guide.card_title,
            description: guide.card_description,
            url: `/guides/${guide.slug}/`
        })),
        footer_items: guides
            .filter((guide) => guide.in_footer)
            .map((guide) => ({
                short_title: guide.short_title,
                url: `/guides/${guide.slug}/`
            }))
    };
}

module.exports = {
    buildGuides,
    loadGuides,
    collectGuideUrls,
    collectGuideSitemapEntries,
    getGuideCards
};
