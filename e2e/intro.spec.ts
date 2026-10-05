import { expect, test } from '@playwright/test';

test('first visit: intro plays in under 4 s, header appears, never twice', async ({ page }) => {
  await page.goto('/');
  const site = page.locator('.site');
  await expect(site).toHaveAttribute('data-intro', /dark|hood/);
  await expect(page.getByRole('button', { name: 'Skip intro' })).toBeVisible();
  // Done within 4 s (+ a little for page load).
  await expect(site).not.toHaveAttribute('data-intro', /.+/, { timeout: 4800 });
  await expect(page.locator('.site-header')).toHaveCSS('opacity', '1');
  await expect(page.locator('.caption')).toBeVisible();
  await page.reload();
  await expect(site).toHaveAttribute('data-mode', 'watch');
  await expect(site).not.toHaveAttribute('data-intro', /.+/);
});

test('any key skips the intro; deep links never show it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.site')).toHaveAttribute('data-intro', /.+/);
  await page.keyboard.press('Enter');
  await expect(page.locator('.site')).not.toHaveAttribute('data-intro', /.+/);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?chapter=safety');
  await expect(page.locator('.chapter-title')).toHaveText('Safety');
  await expect(page.locator('.site')).not.toHaveAttribute('data-intro', /.+/);
});
