import path from 'path';
import puppeteer from "puppeteer";
import { userAgent, pageOptions } from './globals.js';
;
const icon = async (htmlContent, options = {}) => {
    const logError = (error) => {
        console.error(`[Error] ${error.message}`);
    };
    const setupVariables = async (htmlContent, options) => {
        let { basePath, cssFiles, jsFiles } = options;
        basePath = basePath || process.cwd();
        cssFiles = cssFiles || [];
        jsFiles = jsFiles || [];
        try {
            return {
                ...options,
                jsFiles,
                cssFiles,
                htmlContent,
                basePath,
                icon: await generateImagePreview({ ...options, htmlContent, cssFiles, jsFiles, basePath }),
            };
        }
        catch (error) {
            logError(error.message);
        }
    };
    const testHtmlContent = (htmlContent) => {
        return {
            hasHTMLTags: /<html[^>]*>/i.test(htmlContent),
            hasBodyTags: /<body[^>]*>/i.test(htmlContent),
        };
    };
    const getNewFiles = (files, existingFiles) => {
        return files.filter((file) => !existingFiles.has(file));
    };
    const formJsTag = (file) => {
        return `<script src="${file}"></script>`;
    };
    const formCssTag = (file) => {
        return `<link rel="stylesheet" href="${file}">`;
    };
    const mapNewFilesAs = (files, type) => {
        return files.map((file) => type === 'javascript' ? formJsTag(file) : formCssTag(file)).join('\n');
    };
    const getNewCssFiles = (imageSettings) => {
        const { htmlContent, cssFiles } = imageSettings;
        return getNewFiles(cssFiles, new Set(htmlContent.match(/<link[^>]*href="([^"]+)"/gi) || []));
    };
    const parseCssFiles = (imageSettings) => {
        return mapNewFilesAs(getNewCssFiles(imageSettings), 'css');
    };
    const getNewJsFiles = (imageSettings) => {
        const { htmlContent, jsFiles } = imageSettings;
        const existingJSFiles = new Set(htmlContent.match(/<script[^>]*src="([^"]+)"/gi) || []);
        return getNewFiles(jsFiles, existingJSFiles);
    };
    const parseJsFiles = (imageSettings) => {
        return mapNewFilesAs(getNewJsFiles(imageSettings), 'javascript');
    };
    const parseFiles = (imageSettings) => {
        return {
            js: parseJsFiles(imageSettings),
            css: parseCssFiles(imageSettings),
        };
    };
    const formHtmlPage = (imageSettings) => {
        const { htmlContent } = imageSettings;
        const { hasHTMLTags, hasBodyTags } = testHtmlContent(htmlContent);
        const { js, css } = parseFiles(imageSettings);
        let htmlPage = '';
        if (!hasHTMLTags) {
            htmlPage += `<!DOCTYPE html><html lang="en"><head>`;
        }
        if (js && js.length > 0) {
            htmlPage += js;
        }
        if (css && css.length > 0) {
            htmlPage += css;
        }
        if (!hasHTMLTags) {
            htmlPage += '</head>';
        }
        if (!hasBodyTags) {
            htmlPage += `<body>`;
        }
        htmlPage += htmlContent;
        if (!hasBodyTags) {
            htmlPage += `</body>`;
        }
        if (!hasHTMLTags) {
            htmlPage += `</html>`;
        }
        return htmlPage;
    };
    const configurePage = async (page) => {
        page.setDefaultNavigationTimeout(3000);
        await page.setViewport({ height: 300, width: 1440 });
        await page.setUserAgent(userAgent);
    };
    const openPage = async (page, htmlContent) => {
        console.log(htmlContent);
        await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
    };
    const getScreenshot = async (page, browser, path) => {
        let screenshot = '';
        try {
            let clip;
            let captureBeyondViewport = false;
            let fullPage = false;
            try {
                clip = await getElementDimensions(page);
            }
            catch (error) {
                throw new Error('Unable to clip the page.');
            }
            screenshot = await page.screenshot({
                path,
                quality: 60,
                type: 'jpeg',
                clip,
            });
        }
        catch (error) {
            logError(error.message);
        }
        await browser.close();
        return screenshot;
    };
    const getBufferFromPage = async (browser, htmlContent, filePath) => {
        const page = await browser.newPage();
        await configurePage(page);
        await openPage(page, htmlContent);
        return await getScreenshot(page, browser, filePath);
    };
    const getElementDimensions = async (page) => {
        return page.evaluate(async (innerSelector) => {
            const elem = document.querySelector(innerSelector);
            if (!elem) {
                throw new Error("element not found");
            }
            elem.scrollIntoViewIfNeeded();
            const boundingBox = elem.getBoundingClientRect();
            return {
                x: Math.round(boundingBox.x) | 0,
                y: Math.round(boundingBox.y) | 0,
                width: Math.round(boundingBox.width),
                height: Math.round(boundingBox.height) | 0,
            };
        }, 'body');
    };
    const connect = async (browserWSEndpoint) => {
        return await puppeteer.connect({ ...pageOptions, browserWSEndpoint });
    };
    const saveImage = async (imageSettings) => {
        const browserWSEndpoint = await launchBrowser();
        const filePath = path.join(imageSettings.basePath, 'preview.jpeg');
        const htmlContent = formHtmlPage(imageSettings);
        const browser = await connect(browserWSEndpoint);
        return await getBufferFromPage(browser, htmlContent, filePath);
    };
    const launchBrowser = async () => {
        const browser = await puppeteer.launch({ timeout: 0 });
        return browser.wsEndpoint();
    };
    const getIcon = async (imageOptions) => {
        return `(<img src="data:image/jpeg;base64,${await saveImage(imageOptions)}" />)`;
    };
    const generateImagePreview = async (blockOptions) => {
        try {
            return await getIcon(blockOptions);
        }
        catch (error) {
            logError(error);
        }
        return icon;
    };
    return await setupVariables(htmlContent, options);
};
export default icon;
