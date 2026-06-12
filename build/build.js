const fs = require('fs');
const path = require('path');

const {
    URLS,
    SITE_URL,
    DEFAULT_LANGUAGE,
    LANGUAGES,
    APP_ID,
    APP_STORE_URL,
    FOOTER_PRIVACY_URL,
    FOOTER_TERMS_URL,
    FOOTER_BLOG_URL,
    DEFAULT_OG_LOGO,
    SOFTWARE_APPLICATION_AGGREGATE_RATING,
    OG_LOCALE_BY_LANGUAGE,
    CANONICAL_URL_BY_LANGUAGE,
    getAnalyticsContext
} = require('./constants');
const {
    getHtmlLang,
    getHtmlDir,
    getFooterLastUpdatedConfig
} = require('./locales');
const { renderTemplate } = require('./template-engine');
const { buildBlog } = require('./blog/build-blog');
const { generateSitemap } = require('./sitemap');

const ROOT_DIR = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const URLS_PATH = path.join(ROOT_DIR, 'urls.txt');
const LLMS_PATH = path.join(ROOT_DIR, 'llms.txt');

const BUILD_TIMESTAMP = Date.now();
const BUILD_DATE_ISO = new Date(BUILD_TIMESTAMP).toISOString().slice(0, 10);
const CURRENT_YEAR = new Date(BUILD_TIMESTAMP).getFullYear();

const DEFAULT_SITE_NAME = 'DRMN';

function writeUrlsFile(blogUrls = []) {
    const allUrls = [...URLS.map(({ url }) => url), ...blogUrls];
    fs.writeFileSync(URLS_PATH, allUrls.join('\n'), 'utf8');
    console.log('✅ Successfully built urls.txt file');
    console.log(`📁 Output saved to: ${URLS_PATH}`);
    console.log();
}

function absoluteSiteUrl(maybe) {
    if (maybe == null || maybe === '') {
        return SITE_URL;
    }
    const value = String(maybe);
    if (/^https?:\/\//i.test(value)) {
        return value;
    }
    return `${SITE_URL.replace(/\/?$/, '/')}${value.replace(/^\//, '')}`;
}

function stripHtml(value) {
    if (typeof value !== 'string') {
        return value;
    }
    return value
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Month + year in the given locale (no extra words like "de" / "г."). */
function formatFooterMonthYear(date, locale) {
    const parts = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).formatToParts(date);
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    return `${month} ${year}`.trim();
}

function writeLlmsFile(defaultLocaleData) {
    const appName = defaultLocaleData.header?.app_name || DEFAULT_SITE_NAME;
    const description =
        stripHtml(defaultLocaleData.meta?.description) ||
        'DRMN is a free iOS app with white noise and sleep sounds for iPhone.';
    const privacyUrl = absoluteSiteUrl(FOOTER_PRIVACY_URL);
    const termsUrl = absoluteSiteUrl(FOOTER_TERMS_URL);
    const fileSize = defaultLocaleData.app_info?.file_size || '49.2 MB';
    const minIos = defaultLocaleData.seo?.structured_data?.software_application?.softwareRequirements || 'iOS 17.1 or later';

    const lines = [
        `# ${appName} - White Noise & Sleep Sounds App`,
        '',
        `> ${description}`,
        '',
        '## Main Sections',
        '',
        `- [Home](${SITE_URL}): App overview and features`,
        `- [Blog](${absoluteSiteUrl(FOOTER_BLOG_URL)}): Sleep and focus sound guides (English)`,
        `- [Privacy Policy](${privacyUrl}): Privacy and data handling`,
        `- [Terms of Service](${termsUrl}): Terms and conditions`,
        '',
        '## Key Facts',
        '',
        '- Platform: iOS (iPhone)',
        '- Price: Free with optional premium features',
        `- File Size: ${fileSize}`,
        `- Minimum iOS: ${minIos}`,
        '- Category: Health & Fitness',
        `- Developer: ${defaultLocaleData.app_info?.developer || 'Vladimir Ivakhnenko'}`,
        '- App Store Rating: 4.9/5 stars (10 reviews)',
        '- Users report: 30-50% faster sleep onset',
        '',
        '## Features',
        '',
        '- White noise, brown noise, dark noise',
        '- Nature sounds (rain, ocean, fire, birds)',
        '- Meditation and focus sounds',
        '- Baby sleep sounds (hair dryer, vacuum, keyboard)',
        '- Sound mixing capabilities',
        '- Offline mode',
        '- Battery-optimized',
        '- Sleep timer with auto-fade',
        '',
        '## Language Pages',
        '',
        ...URLS.map(({ lang, url }) => `- [${lang}](${url})`),
        '',
        '## App Store',
        '',
        `- URL: ${APP_STORE_URL}`,
        `- App ID: ${APP_ID}`,
        '- Category: Health & Fitness',
        '- Age Rating: 4+',
        '',
        '## Contact',
        '',
        `- Website: ${SITE_URL}`,
        `- App Store: ${APP_STORE_URL}`,
        '',
        `Last updated: ${BUILD_DATE_ISO}`
    ];

    fs.writeFileSync(LLMS_PATH, `${lines.join('\n')}\n`, 'utf8');
    console.log('✅ Successfully built llms.txt file');
    console.log(`📁 Output saved to: ${LLMS_PATH}`);
    console.log();
}

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getOutputDirectory(lang) {
    return path.join(ROOT_DIR, lang === DEFAULT_LANGUAGE ? '.' : lang);
}

function getJsonPath(lang) {
    return path.join(__dirname, `${lang}.json`);
}

function getOutputPath(lang) {
    return path.join(getOutputDirectory(lang), 'index.html');
}

function getMissingTranslationFiles() {
    return LANGUAGES
        .map((lang) => ({ lang, jsonPath: getJsonPath(lang) }))
        .filter(({ jsonPath }) => !fs.existsSync(jsonPath));
}

function getPreviewImageUrl(lang) {
    const relative = lang === DEFAULT_LANGUAGE ? 'site_preview.png' : `${lang}/site_preview.png`;
    const absolute = path.join(ROOT_DIR, relative);
    const usePath = fs.existsSync(absolute) ? relative : 'site_preview.png';
    return `${SITE_URL}${usePath}`;
}

function getCanonicalUrl(meta, lang) {
    return meta.canonical || CANONICAL_URL_BY_LANGUAGE.get(lang) || SITE_URL;
}

function normalizeMeta(data, lang) {
    data.meta = data.meta || {};

    const canonicalUrl = getCanonicalUrl(data.meta, lang);
    const previewUrl = getPreviewImageUrl(lang);

    data.meta.lang = data.meta.lang || lang;
    data.meta.html_lang = getHtmlLang(lang);
    data.meta.html_dir = getHtmlDir(lang);
    data.meta.version = BUILD_TIMESTAMP;
    data.meta.canonical = canonicalUrl;
    data.meta.alternate_default = SITE_URL;
    data.meta.alternate_languages = URLS;
    data.meta.app_store_id = APP_ID;
    data.meta.og_url = canonicalUrl;
    data.meta.twitter_url = canonicalUrl;
    data.meta.og_image = previewUrl;
    data.meta.twitter_image = previewUrl;
    data.meta.og_logo = data.meta.og_logo || DEFAULT_OG_LOGO;
    data.meta.og_site_name = data.meta.og_site_name || data.header?.app_name || DEFAULT_SITE_NAME;
    data.meta.og_locale = data.meta.og_locale || OG_LOCALE_BY_LANGUAGE[lang] || OG_LOCALE_BY_LANGUAGE.en;
    data.meta.last_updated_iso = BUILD_DATE_ISO;
}

function normalizeHeader(data) {
    data.header = data.header || {};
    data.header.download_url = APP_STORE_URL;
}

function normalizeFooter(data, lang) {
    data.footer = data.footer || {};
    data.footer.privacy_url = FOOTER_PRIVACY_URL;
    data.footer.terms_url = FOOTER_TERMS_URL;
    data.footer.blog_url = FOOTER_BLOG_URL;
    data.footer.blog_link = data.footer.blog_link || 'Blog';

    if (typeof data.footer.copyright === 'string') {
        data.footer.copyright = data.footer.copyright.replace(/\{year\}/g, String(CURRENT_YEAR));
    }

    const footerLu = getFooterLastUpdatedConfig(lang);
    if (footerLu) {
        data.footer.last_updated = footerLu.prefix + formatFooterMonthYear(new Date(BUILD_TIMESTAMP), footerLu.intl);
    }
    data.footer.last_updated_iso = BUILD_DATE_ISO;
}

function ensureSeoShape(data) {
    data.seo = data.seo || {};
    data.seo.structured_data = data.seo.structured_data || {};
}

function buildSoftwareApplicationStructuredData(data) {
    const app = data.seo.structured_data.software_application;
    if (!app || typeof app !== 'object') {
        return;
    }
    app.url = data.meta?.canonical;
    app.downloadUrl = APP_STORE_URL;
    app.dateModified = BUILD_DATE_ISO;
    app.aggregateRating = { ...SOFTWARE_APPLICATION_AGGREGATE_RATING };
    if (app.offers && typeof app.offers === 'object') {
        app.offers.url = APP_STORE_URL;
    }
}

function buildOrganizationStructuredData(data) {
    const org = data.seo.structured_data.organization;
    if (!org || typeof org !== 'object') {
        return;
    }
    org.url = data.meta?.canonical || SITE_URL;
    org.logo = org.logo || DEFAULT_OG_LOGO;
    if (!org.description && data.meta?.description) {
        org.description = stripHtml(data.meta.description);
    }
}

function buildWebsiteStructuredData(data) {
    const fallbackName = data.meta?.og_site_name || data.header?.app_name || DEFAULT_SITE_NAME;
    const website = data.seo.structured_data.website;

    if (!website || typeof website !== 'object') {
        data.seo.structured_data.website = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: fallbackName,
            description: stripHtml(data.meta?.description),
            inLanguage: data.meta?.lang,
            url: data.meta?.canonical || SITE_URL
        };
        return;
    }

    website.url = data.meta?.canonical;
    website.name = website.name || fallbackName;
    website.description = website.description || stripHtml(data.meta?.description);
    website.inLanguage = website.inLanguage || data.meta?.lang;
    delete website.potentialAction;
}

function buildHowToStructuredData(data) {
    const howto = data.seo.structured_data.howto;
    if (!howto || typeof howto !== 'object') {
        return;
    }

    if (Array.isArray(data.how_it_works?.steps)) {
        howto.step = data.how_it_works.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: stripHtml(step?.title),
            text: stripHtml(step?.description)
        }));
    }

    if (!Array.isArray(howto.step)) {
        howto.step = [];
    }

    const firstStep = howto.step[0];
    if (firstStep && typeof firstStep === 'object') {
        firstStep.url = APP_STORE_URL;
    }
}

function buildFaqStructuredData(data) {
    const items = Array.isArray(data.seo?.faq) ? data.seo.faq : [];
    data.seo.structured_data.faqpage = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((faq) => ({
            '@type': 'Question',
            name: stripHtml(faq?.question),
            acceptedAnswer: {
                '@type': 'Answer',
                text: stripHtml(faq?.answer)
            }
        }))
    };
}

function buildBreadcrumbStructuredData(data) {
    data.seo.breadcrumb_home = data.seo.breadcrumb_home || 'Home';
    data.seo.structured_data.breadcrumb_list = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: data.seo.breadcrumb_home,
                item: data.meta?.canonical
            }
        ]
    };
}

function preparePageData(data, lang) {
    normalizeMeta(data, lang);
    normalizeHeader(data);
    normalizeFooter(data, lang);
    ensureSeoShape(data);
    data.analytics = getAnalyticsContext();
    buildSoftwareApplicationStructuredData(data);
    buildOrganizationStructuredData(data);
    buildWebsiteStructuredData(data);
    buildHowToStructuredData(data);
    buildFaqStructuredData(data);
    buildBreadcrumbStructuredData(data);
    return data;
}

function buildPage(template, lang) {
    const outputDir = getOutputDirectory(lang);
    const outputPath = getOutputPath(lang);
    const jsonPath = getJsonPath(lang);

    ensureDirectoryExists(outputDir);
    const data = preparePageData(readJsonFile(jsonPath), lang);
    fs.writeFileSync(outputPath, renderTemplate(template, data, lang), 'utf8');

    console.log(`✅ Successfully built index.html from template and ${lang}.json`);
    console.log(`📁 Output saved to: ${outputPath}`);
}

async function main() {
    const missing = getMissingTranslationFiles();
    if (missing.length > 0) {
        console.error(
            `❌ Missing translation files: ${missing.map((item) => `${item.lang}: ${path.basename(item.jsonPath)}`).join(', ')}`
        );
        process.exit(1);
    }

    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    const defaultData = preparePageData(readJsonFile(getJsonPath(DEFAULT_LANGUAGE)), DEFAULT_LANGUAGE);
    writeLlmsFile(defaultData);

    for (const lang of LANGUAGES) {
        try {
            buildPage(template, lang);
        } catch (error) {
            console.error(`❌ Error building ${lang}:`, error.message);
            process.exit(1);
        }
    }

    let blogUrls = [];
    try {
        blogUrls = await buildBlog({
            buildTimestamp: BUILD_TIMESTAMP,
            buildDateIso: BUILD_DATE_ISO,
            currentYear: CURRENT_YEAR
        });
    } catch (error) {
        console.error('❌ Error building blog:', error.message);
        process.exit(1);
    }

    writeUrlsFile(blogUrls);
    generateSitemap();
}

main().catch((error) => {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
});
