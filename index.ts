import path from 'path';
import puppeteer from "puppeteer";
import { userAgent, pageOptions } from './globals.js';
;

interface options {
  basePath?: string,
  cssFiles?: string[],
  jsFiles?: string[]
}

const icon = async (htmlContent: string, chromePath: string, options: options = {}): Promise<any> => {
  const logError = (error: { message: string }) => {
    console.error(`[Error] ${error.message}`);
  };
  const setupVariables = async (htmlContent: string, chromePath: string, options: any) => {
    let { basePath, cssFiles, jsFiles } = options;
    basePath = basePath || process.cwd();
    cssFiles = cssFiles || [];
    jsFiles = jsFiles || [];

    if (!chromePath) {
      throw new Error('A path to a chrome executable must be provided.');
    }

    try {

      return {
        ...options,
        jsFiles,
        cssFiles,
        htmlContent,
        basePath,
        icon: await generateImagePreview({ ...options, htmlContent, cssFiles, jsFiles, basePath, chromePath }),
      };
    }
    catch (error) {
      logError(error);
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
  const configurePage = async (page: any) => {
    page.setDefaultNavigationTimeout(0);
    await page.setViewport({ height: 300, width: 1440 });
    await page.setUserAgent(userAgent);
  };
  const openPage = async (page: any, htmlContent: string) => {
    await page.goto(`data:text/html,${encodeURIComponent(htmlContent)}`, pageOptions);
  };
  const getScreenshot = async (page: any, browser: any, path: string): Promise<any> => {
    const screenshot = await page.screenshot({
      path,
      quality: 70,
      type: 'jpeg',
      clip: await getElementDimensions(page),
    });

    await browser.close();

    return screenshot;
  };
  const getBufferFromPage = async (browser: any, htmlContent: string, filePath: string): Promise<any> => {
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
  const getElementDimensions = async (page: any) => {
    return page.evaluate(async (innerSelector: any) => {
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
  const connect = async (browserWSEndpoint: string) => {
    return await puppeteer.connect({ browserWSEndpoint });
  };
  const saveImage = async (imageSettings: any): Promise<any> => {
    const browserWSEndpoint = await launchBrowser(imageSettings);
    const filePath = path.join(imageSettings.basePath, 'preview.jpeg');
    const htmlContent = formHtmlPage(imageSettings);
    const browser = await connect(browserWSEndpoint);

    return await getBufferFromPage(browser, htmlContent, filePath);
  };
  const launchBrowser = async (options: { chromePath: string }) => {
    const browser = await puppeteer.launch({ executablePath: options.chromePath, timeout: 0 });
    return browser.wsEndpoint();
  };
  const getIcon = async (imageOptions: any) => {
    return `(<img src="data:image/jpeg;base64,${await saveImage(imageOptions)}" />)`;
  };
  const generateImagePreview = async (blockOptions: any) => {
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