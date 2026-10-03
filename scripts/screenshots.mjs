// Deterministic visual-review screenshots: `node scripts/screenshots.mjs [outDir] [poses...]`.
// Needs a running dev or preview server (BASE_URL, default http://localhost:5173).
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const [outDir = 'docs/screenshots', ...only] = process.argv.slice(2);
const poses = only.length ? only : ['idle', 'city', 'highway', 'redline', 'night'];
const keys = (process.env.KEYS ?? '').split(',').filter(Boolean);

const browser = await chromium.launch({
  ...(process.env.PW_CHROME === '0' ? {} : { channel: 'chrome' }),
});
const page = await browser.newPage({ viewport: { width: 1920, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const pose of poses) {
  await page.goto(`${BASE}/?kiosk=1&pose=${pose}${process.env.QUERY ?? ''}`);
  await page.waitForTimeout(1500);
  for (const k of keys) {
    await page.keyboard.press(k);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${pose}.png` });
  const kiosk = page.locator('.kiosk');
  const fps = await kiosk.getAttribute('data-fps');
  const ms = await kiosk.getAttribute('data-frame-ms');
  console.log(`${pose}: ${fps} fps, ${ms} ms CPU/frame`);
}
if (process.env.SITE !== '0') {
  await page.setViewportSize({ width: 1600, height: 820 });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${outDir}/website.png` });
}
console.log(errors.length ? `errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
