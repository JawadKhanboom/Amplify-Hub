const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENS_DIR)) {
  fs.mkdirSync(SCREENS_DIR);
}

const DASHBOARD_URL = `file:///${path.join(__dirname, 'dashboard.html').replace(/\\/g, '/')}`;

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 }
];

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.addInitScript(() => window.IS_SCREENSHOT = true);

  for (const vp of viewports) {
    console.log(`\nChecking dashboard.html at ${vp.width}x${vp.height}...`);
    await page.setViewportSize(vp);
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
    
    // Check overflow
    const overflowInfo = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return { scrollW, innerW, overflow: scrollW > innerW };
    });
    
    console.log(`ScrollWidth: ${overflowInfo.scrollW}, InnerWidth: ${overflowInfo.innerW}`);
    if (overflowInfo.overflow) {
      console.log(`[!] OVERFLOW DETECTED at ${vp.width}px!`);
    } else {
      console.log(`[OK] No overflow. document.scrollWidth === window.innerWidth`);
    }

    const filename = `dashboard-${vp.width}.png`;
    const filepath = path.join(SCREENS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Saved ${filepath}`);
  }

  await browser.close();
}

run().catch(console.error);
