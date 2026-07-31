const fs = require('fs');
const path = require('path');
const { chromium } = require('../sales-mindset-app/node_modules/playwright-core');

// Find a usable browser path based on typical playwright/puppeteer or system paths
// The project has playwright-core installed.
async function capture() {
  const vpw = [
    { width: 360, height: 800, name: '360' },
    { width: 390, height: 844, name: '390' },
    { width: 768, height: 1024, name: '768' },
    { width: 1280, height: 800, name: '1280' },
    { width: 1440, height: 900, name: '1440' }
  ];
  const pages = [
    'index.html',
    'dashboard.html',
    'journey.html',
    'resources.html',
    'contact.html'
  ];

  let browserPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (!browserPath) {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        browserPath = p;
        break;
      }
    }
  }

  if (!browserPath) {
    console.error('Could not find a browser executable.');
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: browserPath });
  const context = await browser.newContext();
  const page = await context.newPage();

  const outDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const vp of vpw) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of pages) {
      if (vp.name === '390' && !['index.html', 'dashboard.html'].includes(p)) continue;
      if (vp.name === '768' && p === 'contact.html') continue;

      const fileUri = `file:///${path.join(__dirname, p).replace(/\\/g, '/')}`;
      console.log(`Navigating to ${fileUri} at ${vp.width}x${vp.height}...`);
      await page.addInitScript(() => window.IS_SCREENSHOT = true);
      await page.goto(fileUri, { waitUntil: 'networkidle' });

      if (p === 'contact.html') {
        const btn = await page.$('button[type="submit"]');
        if (btn) await btn.focus();
      }
      
      // If landing, scroll down slightly to show header state? No, top is fine to show hero
      
      const outPath = path.join(outDir, `${p.replace('.html', '')}-${vp.name}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved ${outPath}`);
    }
  }

  await browser.close();
  console.log('Screenshots complete.');
}

capture().catch(e => {
  console.error(e);
  process.exit(1);
});
