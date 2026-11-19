// Renders each card to PNG at 1500 × 2100 — 5 × 7 inches at 300 dpi.
//   NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node save-the-date/render.js [outDir]
// Chromium lives at /opt/pw-browsers/<version>/..., and that version changes
// between container images, so it is discovered rather than hard-coded.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = '/opt/pw-browsers';
  for (const d of fs.readdirSync(root).filter(n => n.startsWith('chromium-'))) {
    for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(root, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;  // fall back to Playwright's own lookup
}

(async () => {
  const outDir = process.argv[2] || path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: findChromium() });
  const p = await b.newPage({ viewport: { width: 750, height: 1050 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'card.html'));
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  for (const lang of ['en', 'fr', 'de']) {
    const file = path.join(outDir, `save-the-date-${lang}.png`);
    await p.locator('#card-' + lang).screenshot({ path: file });
    const { width, height } = await p.locator('#card-' + lang).boundingBox();
    console.log(`${file}  ${width * 2} × ${height * 2}`);
  }
  await b.close();
})();
