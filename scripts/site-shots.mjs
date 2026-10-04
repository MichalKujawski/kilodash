// Website screenshots for design review: `node scripts/site-shots.mjs <outDir> [name=query@WxH ...]`.
// Default: Watch and Drive at 1440×900. Reports time until the cockpit is moving, fps and dropped frames.
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const [outDir = 'docs/design/progress', ...specs] = process.argv.slice(2);
const shots = (
  specs.length ? specs : ['watch=mode=watch@1440x900', 'drive=mode=drive@1440x900']
).map((s) => {
  const [name, rest] =
    s.split('=', 2).length === 2
      ? [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]
      : [s, ''];
  const [query, size = '1440x900'] = rest.split('@');
  const [w, h] = size.split('x').map(Number);
  return { name, query, w, h };
});
const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--ignore-gpu-blocklist',
    '--enable-gpu',
    '--use-angle=vulkan',
    '--enable-features=Vulkan',
  ],
});
for (const { name, query, w, h } of shots) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: w < 900 ? 2 : 1,
  });
  const t0 = Date.now();
  await page.goto(`${BASE}/?${query}`);
  // "Moving": the speedometer shows motion.
  let movingMs = -1;
  for (let i = 0; i < 100; i++) {
    const v = await page.evaluate(() => {
      const oc = window.__oc;
      return oc ? oc.session.store.value('Vehicle.Speed') : 0;
    });
    if (v > 1) {
      movingMs = Date.now() - t0;
      break;
    }
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(3500);
  const site = page.locator('.site, .kiosk');
  const d0 = Number(await site.getAttribute('data-dropped'));
  await page.waitForTimeout(3000);
  const fps = await site.getAttribute('data-fps');
  const dropped = Number(await site.getAttribute('data-dropped')) - d0;
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`${name}: moving after ${movingMs} ms, ${fps} fps, ${dropped} dropped in 3 s`);
  await page.close();
}
await browser.close();
