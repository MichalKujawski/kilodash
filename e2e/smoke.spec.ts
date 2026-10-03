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
  await expect(page.locator('.chip-mono')).not.toHaveText('0 fps');
  expect(errors).toEqual([]);
});
