// After domain verification, paste codes from Search Console / Bing Webmaster Tools.
// ChatGPT Search uses Bing — submit sitemap at https://www.bing.com/webmasters
const GOOGLE_SITE_VERIFICATION = ''; // verified by DNS TXT record
const MS_VALIDATE = 'E15B500A4986A32DDDF23064D5A94A0F';

const SITE_URL = 'https://drmn.xyz/';
const DEFAULT_LANGUAGE = 'en';

const { buildOgLocaleMap, getHreflangCode } = require('./locales');

const APP_ID = '6746480683';
const APP_STORE_URL = `https://apps.apple.com/app/id${APP_ID}`;
const AUTHOR_URL = 'https://apps.apple.com/developer/id1239180595';

const FOOTER_PRIVACY_URL = '/privacy.html';
const FOOTER_TERMS_URL = '/terms.html';
const FOOTER_BLOG_URL = '/blog/';

const BLOG_POSTS_PER_PAGE = 10;

const DEFAULT_OG_LOGO = `${SITE_URL}img/logo.webp`;

const SOFTWARE_APPLICATION_AGGREGATE_RATING = {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '10'
};

// Shipped locales are active; uncomment a line after adding build/<code>.json.
const LANGUAGES = [
    DEFAULT_LANGUAGE,
    'ru',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ja',
    'ko',
    'zh',
    'cs',
    'da',
    'el',
    'fi',   // Suomi
    'fil',  // Filipino (hreflang: tl)
    'he',   // עברית (RTL)
    'hr',   // Hrvatski
    'hu',   // Magyar
    'id',   // Bahasa Indonesia
    'ms',   // Bahasa Melayu
    'nl',   // Nederlands
    'no',   // Norsk (html lang: nb)
    'pl',   // Polski
    'ro',   // Română
    'sk',   // Slovenčina
    'sv',   // Svenska
    'bg',   // Български
    'sl',   // Slovenščina
    'ca',   // Català
    'hi',   // हिन्दी
    'bn',   // বাংলা
    'ml',   // മലയാളം
    'th',   // ไทย
    'tr',   // Türkçe
    'uk',   // Українська
    'vi'    // Tiếng Việt
];

const URLS = LANGUAGES.map((slug) => ({
    slug,
    lang: getHreflangCode(slug),
    url: slug === DEFAULT_LANGUAGE ? SITE_URL : `${SITE_URL}${slug}/`
}));

const OG_LOCALE_BY_LANGUAGE = buildOgLocaleMap(LANGUAGES);

const CANONICAL_URL_BY_LANGUAGE = new Map(
    LANGUAGES.map((slug) => [slug, slug === DEFAULT_LANGUAGE ? SITE_URL : `${SITE_URL}${slug}/`])
);

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

const BLOG_INDEX_JSON_LD_TYPES = ['CollectionPage', 'BreadcrumbList'];
const BLOG_POST_JSON_LD_TYPES = ['BlogPosting', 'BreadcrumbList'];

const YANDEX_METRIKA_SNIPPET = `  
<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js', 'ym');

    ym(102522439, 'init', {clickmap:true, referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/102522439" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->


`;

function getAnalyticsContext() {
    return {
        yandex_metrika: YANDEX_METRIKA_SNIPPET
    };
}

module.exports = {
    GOOGLE_SITE_VERIFICATION,
    MS_VALIDATE,
    SITE_URL,
    URLS,
    DEFAULT_LANGUAGE,
    LANGUAGES,
    APP_ID,
    APP_STORE_URL,
    AUTHOR_URL,
    FOOTER_PRIVACY_URL,
    FOOTER_TERMS_URL,
    FOOTER_BLOG_URL,
    BLOG_POSTS_PER_PAGE,
    DEFAULT_OG_LOGO,
    SOFTWARE_APPLICATION_AGGREGATE_RATING,
    OG_LOCALE_BY_LANGUAGE,
    CANONICAL_URL_BY_LANGUAGE,
    EXPECTED_JSON_LD_TYPES,
    BLOG_INDEX_JSON_LD_TYPES,
    BLOG_POST_JSON_LD_TYPES,
    INDEX_NOW_KEY,
    INDEX_NOW_ENGINES,
    ADDITIONAL_URLS,
    YANDEX_METRIKA_SNIPPET,
    getAnalyticsContext
};
