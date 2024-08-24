import path from 'path';
import puppeteer from "puppeteer";
import { userAgent, pageOptions } from './globals.js';
;
const icon = async (htmlContent, chromePath, options = {}) => {
    const logError = (error) => {
        console.error(`[Error] ${error.message}`);
    };
    const setupVariables = async (htmlContent, chromePath, options) => {
        let { basePath, cssFiles, jsFiles } = options;
        basePath = basePath || process.cwd();
        cssFiles = cssFiles || [];
        jsFiles = jsFiles || [];
        if (!chromePath) {
            throw new Error('A path to a chrome executable must be provided.');
        }
        try {
            return await generateImagePreview({ ...options, htmlContent, cssFiles, jsFiles, basePath, chromePath });
        }
        catch (error) {
            logError(error);
        }
    };
    const testHtmlContent = (htmlContent) => {
        return {
            hasHTMLTags: /<html[^>]*>/i.test(htmlContent),
            hasHeadTags: /<head[^>]*>/i.test(htmlContent),
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
        const { hasHTMLTags, hasHeadTags, hasBodyTags } = testHtmlContent(htmlContent);
        const { js, css } = parseFiles(imageSettings);
        let htmlPage = '';
        if (!hasHTMLTags) {
            htmlPage += `<!DOCTYPE html><html lang="en">`;
        }
        if (!hasHeadTags) {
            htmlPage += `<head>${css}${js}</head>`;
        }
        if (!hasBodyTags) {
            htmlPage += `<body>`;
        }
        htmlPage += htmlContent;
        if (hasHeadTags) {
            htmlPage += `${css}${js}`;
        }
        if (!hasBodyTags) {
            htmlPage += `</body>`;
        }
        if (!hasHTMLTags) {
            htmlPage += `</html>`;
        }
        return htmlPage;
    };
    const configurePage = async (page) => {
        page.setDefaultNavigationTimeout(0);
        await page.setViewport({ height: 300, width: 1440 });
        await page.setUserAgent(userAgent);
    };
    const openPage = async (page, htmlContent) => {
        await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
    };
    const getScreenshot = async (page, browser, path) => {
        const screenshot = await page.screenshot({
            path,
            quality: 70,
            type: 'jpeg',
            clip: await getElementDimensions(page),
        });
        await browser.close();
        return screenshot;
    };
    const getBufferFromPage = async (browser, htmlContent, filePath) => {
        const page = await browser.newPage();
        await configurePage(page);
        await openPage(page, htmlContent);
        return await getScreenshot(page, browser, filePath);
    };
    // const bufferToString = (buffer: Buffer) => {
    //   return Buffer.from(buffer).toString('base64');
    // };
    // const saveBuffer = (filePath: string, buffer: Buffer) => {
    //   fs.writeFileSync(filePath, buffer);
    //   return bufferToString(buffer);
    // };
    // const getImageBuffer = async (browser: any, filePath: string, htmlContent: string): Promise<any> => {
    //   return saveBuffer(filePath, await getBufferFromPage(browser, htmlContent, filePath));
    // };
    const getElementDimensions = async (page) => {
        return page.evaluate(async (innerSelector) => {
            const elem = document.querySelector(innerSelector);
            if (!elem) {
                throw new Error("element not found");
            }
            elem.scrollIntoViewIfNeeded();
            const boundingBox = elem.getBoundingClientRect();
            return {
                x: Math.round(boundingBox.x),
                y: Math.round(boundingBox.y),
                width: Math.round(boundingBox.width),
                height: Math.round(boundingBox.height),
            };
        }, 'body');
    };
    const connect = async (browserWSEndpoint) => {
        return await puppeteer.connect({ browserWSEndpoint });
    };
    const saveImage = async (imageSettings) => {
        const browserWSEndpoint = await launchBrowser(imageSettings);
        const filePath = path.join(imageSettings.basePath, 'preview.jpeg');
        const htmlContent = formHtmlPage(imageSettings);
        const browser = await connect(browserWSEndpoint);
        return await getBufferFromPage(browser, htmlContent, filePath);
    };
    const launchBrowser = async (options) => {
        const browser = await puppeteer.launch({ executablePath: options.chromePath, timeout: 0 });
        return browser.wsEndpoint();
    };
    const getIcon = async (imageOptions) => {
        return `(<img src="data:image/jpeg;base64,${await saveImage(imageOptions)}" />)`;
    };
    const generateImagePreview = async (blockOptions) => {
        let { chromePath } = blockOptions;
        if (chromePath) {
            try {
                return await getIcon(blockOptions);
            }
            catch (error) {
                logError(error);
            }
        }
        return icon;
    };
    return await setupVariables(htmlContent, chromePath, options);
};
export default icon;