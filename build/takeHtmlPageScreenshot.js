const puppeteer = require('puppeteer');

const wait = (ms) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};

const takeHtmlPageScreenshot = async (options) => {
    const {htmlPath, url, screenshotPath, width, height} = options;

    // Log input parameters so it's clear what is being processed
    console.log();
    console.log('[takeHtmlPageScreenshot] Starting screenshot with options:', options);

    const browser = await puppeteer.launch();

    try {
        const page = await browser.newPage();
        await page.setViewport({width, height});
        const targetUrl = url ? url : 'file://' + htmlPath;
        console.log('[takeHtmlPageScreenshot] Navigating to:', targetUrl);

        // Some pages (analytics, live connections) never reach `networkidle0`,
        // so use `load` and a higher timeout to avoid false timeouts.
        page.setDefaultNavigationTimeout(60000);
        await page.goto(targetUrl, { waitUntil: 'load' });
        console.log('[takeHtmlPageScreenshot] Page loaded (load event fired), waiting before screenshot...');

        await wait(100);
        await page.screenshot({path: screenshotPath});
        console.log('[takeHtmlPageScreenshot] Screenshot saved to:', screenshotPath);
    } catch (e) {
        console.error('[takeHtmlPageScreenshot] Error while taking screenshot:', e);
    }

    await browser.close();
    console.log('[takeHtmlPageScreenshot] Browser closed, done.');
};

module.exports = {
    takeHtmlPageScreenshot
};