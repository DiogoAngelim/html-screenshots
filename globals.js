const browserOptions = [
  '--remote-debugging-port=9222',
  '--no-first-run',
  '--no-sandbox',
  '--no-default-browser-check',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
];

const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36';

const pageOptions = {
  waitUntil: 'domcontentloaded',
};
export {
  userAgent,
  pageOptions,
  browserOptions,
};
