import { expect, test } from '@playwright/test';

// These tests start after the first-visit intro (e2e/intro.spec.ts covers it).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('oc.intro.seen', '1'));
});

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
    await page.evaluate(
      () => (window as unknown as { __oc: Oc }).__oc.audio.master?.gain.value ?? 0,
    ),
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

test('Engineer: six tabs, live state diagrams, "How it works" from diagrams and captions', async ({
  page,
}) => {
  await page.goto('/?mode=engineer');
  for (const t of ['Signals', 'States', 'Events', 'View model', 'Workshop', 'Performance'])
    await expect(page.getByRole('tab', { name: t })).toBeVisible();
  const diagrams = page.locator('.sm');
  await expect(diagrams).toHaveCount(7);
  for (let i = 0; i < 7; i++) await expect(diagrams.nth(i).locator('.sm-node-on')).toHaveCount(1);
  await diagrams.first().getByRole('button', { name: 'How it works →' }).click();
  const sheet = page.getByRole('dialog', { name: 'How it works' });
  await expect(sheet.locator('h2')).toContainText('cruise');
  await expect(sheet.locator('.hiw-files a').first()).toHaveAttribute('href', /github\.com/);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  // From a Watch caption too, without leaving Watch.
  await page.getByRole('button', { name: 'Watch' }).click();
  await page.getByRole('button', { name: 'How it works →' }).first().click({ timeout: 15000 });
  await expect(page.getByRole('dialog', { name: 'How it works' })).toBeVisible();
  await expect(page.locator('.site')).toHaveAttribute('data-mode', 'watch');
});

test('landing: Show me jumps the demo to the chapter; decisions and privacy open in the sheet', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Show me ↑' }).nth(1).click();
  await expect(page.locator('.chapter-title')).toHaveText('Safety');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
  await page.getByRole('button', { name: /Canvas for the cluster/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Engineering decision' });
  await expect(sheet.locator('h2')).toContainText('Canvas');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Privacy' }).click();
  await expect(page.getByRole('dialog', { name: 'Privacy' })).toContainText('No cookies');
});

test('a browser that cannot run the cluster gets a short note, not a blank page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
  });
  await page.goto('/');
  await expect(page.getByText("This browser can't draw the cluster")).toBeVisible();
  expect(errors).toEqual([]);
});

test('phones: Watch and Engineer only, a Drive link shows Watch with a note', async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(() => localStorage.setItem('oc.intro.seen', '1'));
  await page.goto('/?mode=drive');
  await expect(page.locator('.site')).toHaveAttribute('data-mode', 'watch');
  await expect(page.getByRole('button', { name: 'Drive' })).toHaveCount(0);
  await expect(page.getByText('Rotate for a bigger view.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Take the wheel →' })).toHaveCount(0);
  await page.close();
});

test('recording mode: cluster and captions only, no header, buttons or landing', async ({
  page,
}) => {
  await page.goto('/?record=1&chapter=safety');
  await expect(page.locator('.chapter-title')).toHaveText('Safety');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect(page.locator('.landing')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Take the wheel →' })).toBeHidden();
  await expect(page.locator('.site')).toHaveCSS('cursor', 'none');
});
