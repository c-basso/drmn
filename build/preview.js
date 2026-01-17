const path = require('path');
const {takeHtmlPageScreenshot} = require('./takeHtmlPageScreenshot');

const {URLS, DEFAULT_LANGUAGE} = require('./constants');

(async () => {
    for (let item of URLS) {
        const screenshotPath = DEFAULT_LANGUAGE === item.lang
            ? path.resolve(__dirname, '..', 'site_preview.png')
            : path.resolve(__dirname, '..', item.lang, 'site_preview.png');

        await takeHtmlPageScreenshot({
            screenshotPath,
            width: 1200,
            height: 630,
            url: item.url
        });
    }
})()
