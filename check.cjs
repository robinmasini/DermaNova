const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    const response = await page.goto('http://localhost:5000', { waitUntil: 'networkidle0' });
    console.log('STATUS:', response.status());
    const content = await page.content();
    if (content.includes('id="root"></div>')) {
      console.log('ROOT IS EMPTY (White Page)');
    } else {
      console.log('ROOT IS NOT EMPTY');
    }
    await browser.close();
  } catch (err) {
    console.error(err);
  }
  console.log("Done");
})();
