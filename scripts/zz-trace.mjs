import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);
await page.goto('http://localhost:5173/?record=1&chapter=motorway&debug');
await page.waitForSelector('canvas.cluster-canvas');
await page.clock.runFor(300 + 14000);
for (let t = 14; t <= 28; t += 1) {
  const r = await page.evaluate(() => {
    const src = window.__oc.session.source;
    const ego = src.world.ego;
    const near = src.world.traffic.vehicles
      .filter((v) => !v.oncoming && Math.abs(v.s - ego.s) < 160)
      .map((v) => `L${v.lane.toFixed(1)} ${(v.s - ego.s).toFixed(0)}m ${(v.v * 3.6).toFixed(0)}`);
    return `ego L${ego.lane.toFixed(2)} ${src.sim.speedKmh.toFixed(0)} acc ${src.assist.state} | ${near.join(' ; ')}`;
  });
  console.log(t, r);
  await page.clock.runFor(1000);
}
await b.close();
