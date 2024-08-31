import path from 'path';
import puppeteer from "puppeteer";
import { userAgent, pageOptions } from './globals.js';
;

interface options {
  basePath?: string,
  cssFiles?: string[],
  jsFiles?: string[]
}

const icon = async (htmlContent: string, options: options = {}): Promise<any> => {
  const logError = (error: { message: string }) => {
    console.error(`[Error] ${error.message}`);
  };
  const setupVariables = async (htmlContent: string, options: any) => {
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
  const testHtmlContent = (htmlContent: string) => {
    return {
      hasHTMLTags: /<html[^>]*>/i.test(htmlContent),
      hasHeadTags: /<head[^>]*>/i.test(htmlContent),
      hasBodyTags: /<body[^>]*>/i.test(htmlContent),
    };
  };
  const getNewFiles = (files: string[], existingFiles: any) => {
    return files.filter((file) => !existingFiles.has(file));
  };
  const formJsTag = (file: string) => {
    return `<script src="${file}"></script>`;
  };
  const formCssTag = (file: string) => {
    return `<link rel="stylesheet" href="${file}">`;
  };
  const mapNewFilesAs = (files: string[], type: string) => {
    return files.map((file) => type === 'javascript' ? formJsTag(file) : formCssTag(file)).join('\n');
  };
  const getNewCssFiles = (imageSettings: { htmlContent: string, cssFiles: string[] }) => {
    const { htmlContent, cssFiles } = imageSettings;
    return getNewFiles(cssFiles, new Set(htmlContent.match(/<link[^>]*href="([^"]+)"/gi) || []));
  };
  const parseCssFiles = (imageSettings: { htmlContent: string, cssFiles: string[] }) => {
    return mapNewFilesAs(getNewCssFiles(imageSettings), 'css');
  };
  const getNewJsFiles = (imageSettings: { htmlContent: string, jsFiles: string[] }) => {
    const { htmlContent, jsFiles } = imageSettings;
    const existingJSFiles = new Set(htmlContent.match(/<script[^>]*src="([^"]+)"/gi) || []);
    return getNewFiles(jsFiles, existingJSFiles);
  };
  const parseJsFiles = (imageSettings: any) => {
    return mapNewFilesAs(getNewJsFiles(imageSettings), 'javascript');
  };
  const parseFiles = (imageSettings: any) => {
    return {
      js: parseJsFiles(imageSettings),
      css: parseCssFiles(imageSettings),
    };
  };
  const formHtmlPage = (imageSettings: { htmlContent: string }) => {
    const { htmlContent } = imageSettings;
    const { hasHTMLTags, hasHeadTags, hasBodyTags } = testHtmlContent(htmlContent);
    const { js, css } = parseFiles(imageSettings);
    let htmlPage = '';
    if (!hasHTMLTags) {
      htmlPage += `<!DOCTYPE html><html lang="en">`;
    }
    if (!hasHeadTags) {
      htmlPage += '<head>';
      if (js && js.length > 0) {
        htmlPage += js;
      }
      if (css && css.length > 0) {
        htmlPage += css;
      }
      htmlPage += '</head>';
    }
    if (!hasBodyTags) {
      htmlPage += `<body>`;
    }
    htmlPage += htmlContent;
    if (hasHeadTags) {
      if (js && js.length > 0) {
        htmlPage += js;
      }
      if (css && css.length > 0) {
        htmlPage += css;
      }
    }
    if (!hasBodyTags) {
      htmlPage += `</body>`;
    }
    if (!hasHTMLTags) {
      htmlPage += `</html>`;
    }
    return htmlPage;
  };
  const configurePage = async (page: any) => {
    page.setDefaultNavigationTimeout(0);
    await page.setViewport({ height: 300, width: 1440 });
    await page.setUserAgent(userAgent);
  };
  const openPage = async (page: any, htmlContent: string) => {
    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
  };
  const getScreenshot = async (page: any, browser: any, path: string): Promise<any> => {
    let screenshot = '';

    try {
      let clip: any;

      try {
        clip = await getElementDimensions(page)
      } catch (error) {
        throw new Error('Unable to clip the page.');
      }

      screenshot = await page.screenshot({
        path,
        quality: 60,
        type: 'jpeg',
        clip,
      });
    } catch (error) {
      logError(error.message);
    }

    await browser.close();

    return screenshot;
  };
  const getBufferFromPage = async (browser: any, htmlContent: string, filePath: string): Promise<any> => {
    const page = await browser.newPage();
    await configurePage(page);
    await openPage(page, htmlContent);
    return await getScreenshot(page, browser, filePath);
  };
  const getElementDimensions = async (page: any) => {
    return page.evaluate(async (innerSelector: any) => {
      const elem = document.querySelector(innerSelector);
      if (!elem) {
        throw new Error("element not found");
      }
      elem.scrollIntoViewIfNeeded();
      const boundingBox = elem.getBoundingClientRect();
      return {
        x: Math.round(boundingBox.x) | 0,
        y: Math.round(boundingBox.y) | 0,
        width: Math.round(boundingBox.width) | 60,
        height: Math.round(boundingBox.height) | 60,
      };
    }, 'body');
  };
  const connect = async (browserWSEndpoint: string) => {
    return await puppeteer.connect({ ...pageOptions, browserWSEndpoint });
  };
  const saveImage = async (imageSettings: any): Promise<any> => {
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
  const getIcon = async (imageOptions: any) => {
    return `(<img src="data:image/jpeg;base64,${await saveImage(imageOptions)}" />)`;
  };
  const generateImagePreview = async (blockOptions: any) => {
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