import { expect, test } from '@playwright/test';

test('cluster renders and animates without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const canvas = page.locator('canvas.cluster-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  const a = await canvas.screenshot();
  await page.waitForTimeout(1000);
  const b = await canvas.screenshot();
  expect(a.equals(b)).toBe(false); // needles moved
  await expect(page.locator('.site')).not.toHaveAttribute('data-fps', '0');
  expect(errors).toEqual([]);
});

test('opens in Watch, moving within ~1.5 s, and the mode switch updates the URL', async ({
  page,
}) => {
  await page.goto('/?debug');
  await expect(page.locator('.site')).toHaveAttribute('data-mode', 'watch');
  await page.waitForFunction(
    () =>
      ((
        window as unknown as { __oc?: { session: { store: { value(id: string): number } } } }
      ).__oc?.session.store.value('Vehicle.Speed') ?? 0) > 1,
    undefined,
    { timeout: 2500 },
  );
  await page.getByRole('button', { name: 'Drive' }).click();
  await expect(page).toHaveURL(/mode=drive/);
});

test('guided demo: chapters from the URL, captions, Space pauses, Take the wheel goes to Drive', async ({
  page,
}) => {
  await page.goto('/?chapter=safety');
  await expect(page.locator('.chapter-title')).toHaveText('Safety');
  await expect(page.locator('.caption-line')).not.toBeEmpty();
  await page.keyboard.press(' ');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.chapter-title')).toHaveText('Drive modes');
  await page.getByRole('button', { name: 'Take the wheel →' }).click();
  await expect(page).toHaveURL(/mode=drive/);
});

test('Drive dock: at most 8 controls at rest, "?" lists the keys, Esc closes it', async ({
  page,
}) => {
  await page.goto('/?mode=drive');
  const dock = page.locator('.dock');
  await expect(dock).toBeVisible();
  await expect(page.getByRole('button', { name: 'Selector D' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Groups at rest: stalk, scroll rocker, View, selector + console button, brake, accelerator,
  // More controls, "?" (cruise buttons are always drawn but only usable on fast roads).
  const groups = await dock.evaluate(
    (el) =>
      el.querySelectorAll(
        '.stalk2, .dock-wheel .rocker:first-of-type, [aria-label="View"], .lever, .pedal2, .dock-tools button',
      ).length,
  );
  expect(groups).toBeLessThanOrEqual(8);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard controls' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('wheel buttons have touch targets of at least 44 px where the spacing allows', async ({
  page,
}) => {
  await page.goto('/?mode=drive&debug');
  await page.waitForFunction(() => !!(window as unknown as { __oc?: unknown }).__oc);
  await page.evaluate(() => {
    const s = (
      window as unknown as {
        __oc: { session: { source: { paused: boolean; sim: { state: { steeringDeg: number } } } } };
      }
    ).__oc.session.source;
    s.paused = true;
    s.sim.state.steeringDeg = 0;
  });
  await page.waitForTimeout(300);
  // Effective target: how far from the button's centre a click still lands on it.
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('.wheel2 .hb')].map((btn) => {
      const v = btn.getBoundingClientRect();
      const cx = v.x + v.width / 2;
      const cy = v.y + v.height / 2;
      const on = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('.hb') === btn;
      const reach = (dx: number, dy: number) => {
        let n = 0;
        while (n < 80 && on(cx + dx * (n + 1), cy + dy * (n + 1))) n++;
        return n;
      };
      return {
        name: btn.getAttribute('aria-label') ?? '',
        w: reach(-1, 0) + reach(1, 0) + 1,
        h: reach(0, -1) + reach(0, 1) + 1,
      };
    }),
  );
  for (const s of sizes) {
    // OK sits between up and down; RES+/SET− between two buttons 31 px apart.
    if (!s.name.startsWith('OK')) expect(s.h, s.name).toBeGreaterThanOrEqual(44);
    if (!/^(RES|SET)/.test(s.name)) expect(s.w, s.name).toBeGreaterThanOrEqual(44);
  }
});

type Oc = {
  session: {
    store: { value(id: string): number };
    source: { autopilot: boolean; world: { ego: { s: number } } };
  };
  audio: { muted: boolean; master: { gain: { value: number } } | null };
};

test('autoplay is muted, even after the first click; the header toggle turns sound on', async ({
  page,
}) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => !!(window as unknown as { __oc?: unknown }).__oc);
  // Any click unlocks audio (browser rule); it must stay silent.
  await page.getByRole('button', { name: 'Next chapter' }).click();
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => (window as unknown as { __oc: Oc }).__oc.audio.master?.gain.value),
  ).toBe(0);
  await page.getByRole('button', { name: 'Sound on' }).click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as unknown as { __oc: Oc }).__oc.audio.master?.gain.value),
  ).toBeGreaterThan(0.5);
});

test('Take the wheel mid-chapter: same place and speed, demo driver off, captions gone', async ({
  page,
}) => {
  await page.goto('/?chapter=motorway&debug');
  await page.waitForFunction(() => !!(window as unknown as { __oc?: unknown }).__oc);
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => ({
    s: (window as unknown as { __oc: Oc }).__oc.session.source.world.ego.s,
    kmh: (window as unknown as { __oc: Oc }).__oc.session.store.value('Vehicle.Speed'),
  }));
  await page.getByRole('button', { name: 'Take the wheel →' }).click();
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({
    s: (window as unknown as { __oc: Oc }).__oc.session.source.world.ego.s,
    kmh: (window as unknown as { __oc: Oc }).__oc.session.store.value('Vehicle.Speed'),
    autopilot: (window as unknown as { __oc: Oc }).__oc.session.source.autopilot,
  }));
  expect(after.autopilot).toBe(false);
  expect(after.s - before.s).toBeGreaterThan(0);
  expect(after.s - before.s).toBeLessThan(15);
  expect(Math.abs(after.kmh - before.kmh)).toBeLessThan(5);
  await expect(page.locator('.caption')).toHaveCount(0);
  await expect(page.locator('.dock')).toBeVisible();
});
