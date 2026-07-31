const { chromium } = require('../sales-mindset-app/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

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


const SCREENS_DIR = path.join(__dirname, 'screenshots');
if (!fs.existsSync(SCREENS_DIR)) {
  fs.mkdirSync(SCREENS_DIR);
}

const URL = `file:///${path.join(__dirname, 'index.html').replace(/\\/g, '/')}`;

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 }
];

async function run() {
  const browser = await chromium.launch({ executablePath: browserPath });
  
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    
    // Set IS_SCREENSHOT to pause animations for static shots
    await page.addInitScript(() => window.IS_SCREENSHOT = true);
    
    console.log(`Capturing screenshot at ${vp.width}x${vp.height}...`);
    await page.goto(URL, { waitUntil: 'networkidle' });
    
    // Give it a moment to render
    await page.waitForTimeout(500);

    // Force reveal elements to be visible for static screenshots
    await page.addStyleTag({
      content: `
        .rv,
        .rv.on,
        .rv.in {
          opacity: 1 !important;
          visibility: visible !important;
          transform: none !important;
          filter: none !important;
          animation: none !important;
          transition: none !important;
        }
      `
    });
    // Extra timeout to ensure styles apply
    await page.waitForTimeout(200);
    
    const filename = `preview-${vp.width}.png`;
    const filepath = path.join(SCREENS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    
    await context.close();
  }

  await browser.close();
  console.log(`Done.`);
}

run().catch(console.error);
