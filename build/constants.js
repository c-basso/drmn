// Optional: set meta.google_site_verification and meta.ms_validate in each build/<lang>.json
// after domain verification in Google Search Console and Bing Webmaster Tools.
const SITE_URL = 'https://drmn.xyz/';
const DEFAULT_LANGUAGE = 'en';

const APP_ID = '6746480683';
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_ID}`;

const FOOTER_PRIVACY_URL = '/privacy.html';
const FOOTER_TERMS_URL = '/terms.html';

const DEFAULT_OG_LOGO = `${SITE_URL}img/logo.webp`;

const SOFTWARE_APPLICATION_AGGREGATE_RATING = {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '10'
};

const LANGUAGES = [
    DEFAULT_LANGUAGE,
    'ru',
    'es',
    'fr',
    'de',
    'it',
    'pt'
];

const URLS = LANGUAGES.map((lang) => ({
    lang,
    url: lang === DEFAULT_LANGUAGE ? SITE_URL : `${SITE_URL}${lang}/`
}));

const OG_LOCALE_BY_LANGUAGE = {
    en: 'en_US',
    ru: 'ru_RU',
    es: 'es_ES',
    fr: 'fr_FR',
    de: 'de_DE',
    it: 'it_IT',
    pt: 'pt_BR'
};

const CANONICAL_URL_BY_LANGUAGE = new Map(URLS.map(({ lang, url }) => [lang, url]));

const ADDITIONAL_URLS = [`${SITE_URL}llms.txt`];

// Expected JSON-LD types that should be present on each generated page.
// Keep this list in sync with `build/template.html` structured data scripts.
const EXPECTED_JSON_LD_TYPES = [
    'MobileApplication',
    'Organization',
    'WebSite',
    'HowTo',
    'FAQPage',
    'BreadcrumbList'
];

const INDEX_NOW_KEY = 'z1CYpveatbisfkh3cqp7ys73';

// https://www.indexnow.org/searchengines.json
const INDEX_NOW_ENGINES = [
    'indexnow.yep.com',
    'search.seznam.cz',
    'searchadvisor.naver.com',
    'indexnow.amazonbot.amazon',
    'api.indexnow.org',
    'yandex.com',
    'bing.com'
];

module.exports = {
    SITE_URL,
    URLS,
    DEFAULT_LANGUAGE,
    LANGUAGES,
    APP_ID,
    APP_STORE_URL,
    FOOTER_PRIVACY_URL,
    FOOTER_TERMS_URL,
    DEFAULT_OG_LOGO,
    SOFTWARE_APPLICATION_AGGREGATE_RATING,
    OG_LOCALE_BY_LANGUAGE,
    CANONICAL_URL_BY_LANGUAGE,
    EXPECTED_JSON_LD_TYPES,
    INDEX_NOW_KEY,
    INDEX_NOW_ENGINES,
    ADDITIONAL_URLS
};
