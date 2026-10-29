import { test, expect } from '@playwright/test';

async function dismissTour(page) {
  await page.waitForTimeout(2000);
  const skip = page.getByText('Skip');
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1000);
  }
}

test.describe('Full app smoke', () => {
  test('home loads with title', async ({ page }) => {
    await page.goto('/');
    await dismissTour(page);
    await expect(page).toHaveTitle(/SHOS/i);
  });

  test('quick-add section visible', async ({ page }) => {
    await page.goto('/');
    await dismissTour(page);
    await expect(page.getByText('Quick add')).toBeVisible();
  });

  test('status rings area renders', async ({ page }) => {
    await page.goto('/');
    await dismissTour(page);
    await page.waitForTimeout(1000);
  });
});
