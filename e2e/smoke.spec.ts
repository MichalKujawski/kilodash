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
