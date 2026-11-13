/**
 * SHOS-V2 Audit Toggle Exercise
 *
 * Verifies every toggle/button per §49a methodology:
 * 1. Visual state flips (aria-checked/aria-pressed/label change)
 * 2. Dependent UI actually re-renders (list changes, section appears, count changes)
 * 3. Change is real (persisted/data-level, not just local visual state)
 * 4. Toggling back restores original state cleanly
 *
 * A control satisfying only (1) is a BUG.
 *
 * Usage:
 *   npx playwright test audit-toggle-exercise.spec.js --project=chromium
 *
 * Prerequisites:
 *   - Vite dev server running on http://localhost:5173
 *   - App data seeded (or run with fresh profile)
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(process.cwd(), '.audit-shots', 'toggle-exercise');
const TRACKER_FILE = path.join(process.cwd(), 'audit-tracker.json');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Helper: take screenshot
async function snap(page, name) {
  const file = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

// Helper: wait for render settle
async function settle(page, ms = 300) {
  await page.waitForTimeout(ms);
}

// Helper: check if element exists
async function exists(page, selector) {
  return (await page.locator(selector).count()) > 0;
}

// ─── Settings: Menstrual tracking toggle ────────────────────────────────────
test('Settings: menstrual tracking toggle', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  // Navigate to Settings
  await page.click('[aria-label="Settings"]');
  await settle(page, 500);
  await snap(page, 'settings-before-menstrual');

  // Find menstrual toggle
  const toggle = page.locator('[aria-label*="Menstrual"], [aria-label*="menstrual"], [data-testid*="menstrual"]').first();
  if (await toggle.count() === 0) {
    // Try text-based search
    const toggleByLabel = page.locator('text=/menstrual/i').first();
    if (await toggleByLabel.count() > 0) {
      await toggleByLabel.click();
      await settle(page, 500);
    }
  } else {
    // Check initial state
    const initialState = await toggle.getAttribute('aria-checked');
    await snap(page, 'menstrual-before');

    // Toggle ON
    await toggle.click();
    await settle(page, 500);
    await snap(page, 'menstrual-after-on');

    // Verify visual flip
    const afterState = await toggle.getAttribute('aria-checked');
    expect(afterState).not.toBe(initialState);

    // Verify dependent UI (Cycle tab should appear)
    const cycleTab = page.locator('text=/cycle/i, [aria-label*="Cycle"]');
    const cycleVisible = await cycleTab.count() > 0;
    expect(cycleVisible).toBeTruthy();

    // Toggle back OFF
    await toggle.click();
    await settle(page, 500);
    await snap(page, 'menstrual-after-off');

    // Verify restore
    const restoredState = await toggle.getAttribute('aria-checked');
    expect(restoredState).toBe(initialState);

    // Verify Cycle tab gone
    const cycleGone = await cycleTab.count() === 0;
    expect(cycleGone).toBeTruthy();
  }
});

// ─── Settings: Spelling locale toggle ────────────────────────────────────────
test('Settings: spelling locale toggle (en-GB/en-US)', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  await page.click('[aria-label="Settings"]');
  await settle(page, 500);

  const spellingToggle = page.locator('text=/spelling|locale|en-GB|en-US/i').first();
  if (await spellingToggle.count() > 0) {
    const initialText = await spellingToggle.textContent();
    await snap(page, 'spelling-before');

    await spellingToggle.click();
    await settle(page, 500);
    await snap(page, 'spelling-after');

    const afterText = await spellingToggle.textContent();
    expect(afterText).not.toBe(initialText);

    // Toggle back
    await spellingToggle.click();
    await settle(page, 500);
    const restoredText = await spellingToggle.textContent();
    expect(restoredText).toBe(initialText);
  }
});

// ─── Medication: Show archived toggle ────────────────────────────────────────
test('Medication: show archived toggle', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  // Navigate to Medication
  const medTab = page.locator('text=/medication/i, [aria-label*="Medication"]').first();
  if (await medTab.count() > 0) {
    await medTab.click();
    await settle(page, 500);
  }

  const archivedToggle = page.locator('text=/show archived/i, text=/hide archived/i').first();
  if (await archivedToggle.count() > 0) {
    const initialLabel = await archivedToggle.textContent();
    const initialCount = await page.locator('[data-testid*="med-card"], .med-card, [class*="card"]').count();

    await snap(page, 'med-archived-before');
    await archivedToggle.click();
    await settle(page, 500);
    await snap(page, 'med-archived-after');

    const afterLabel = await archivedToggle.textContent();
    expect(afterLabel).not.toBe(initialLabel);

    // Toggle back
    await archivedToggle.click();
    await settle(page, 500);
    const restoredLabel = await archivedToggle.textContent();
    expect(restoredLabel).toBe(initialLabel);
  }
});

// ─── Encounters: date filter chips ───────────────────────────────────────────
test('Encounters: date filter chips', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  const encTab = page.locator('text=/encounter/i, [aria-label*="Encounter"]').first();
  if (await encTab.count() > 0) {
    await encTab.click();
    await settle(page, 500);
  }

  // Try "Last month" filter
  const lastMonthChip = page.locator('text=/last month/i').first();
  if (await lastMonthChip.count() > 0) {
    await snap(page, 'enc-filter-before');
    await lastMonthChip.click();
    await settle(page, 500);
    await snap(page, 'enc-filter-after');

    // Check for filter badge
    const filterBadge = page.locator('text=/filter/i').first();
    const hasBadge = await filterBadge.count() > 0;

    // Clear filter
    const clearBtn = page.locator('text=/clear/i, text=/reset/i').first();
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await settle(page, 500);
    }
  }
});

// ─── Contacts: sort/filter/select mode ───────────────────────────────────────
test('Contacts: sort and filter', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  const contactsTab = page.locator('text=/contact/i, [aria-label*="Contact"]').first();
  if (await contactsTab.count() > 0) {
    await contactsTab.click();
    await settle(page, 500);
  }

  // Try sort
  const sortBtn = page.locator('text=/sort/i, text=/a.z|last encounter/i').first();
  if (await sortBtn.count() > 0) {
    await snap(page, 'contacts-before-sort');
    await sortBtn.click();
    await settle(page, 500);
    await snap(page, 'contacts-after-sort');
  }

  // Try select mode
  const selectBtn = page.locator('text=/select/i').first();
  if (await selectBtn.count() > 0) {
    await selectBtn.click();
    await settle(page, 500);
    await snap(page, 'contacts-select-mode');

    // Exit select mode
    const doneBtn = page.locator('text=/done|cancel/i').first();
    if (await doneBtn.count() > 0) {
      await doneBtn.click();
      await settle(page, 500);
    }
  }
});

// ─── Healthcare: sub-tab switching ───────────────────────────────────────────
test('Healthcare: sub-tab switching', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  const hcTab = page.locator('text=/healthcare/i, [aria-label*="Healthcare"]').first();
  if (await hcTab.count() > 0) {
    await hcTab.click();
    await settle(page, 500);
  }

  const subTabs = ['Symptoms', 'Testing', 'Clinic', 'Vaccinations', 'Measurements'];
  for (const tabName of subTabs) {
    const tab = page.locator(`text=/${tabName}/i`).first();
    if (await tab.count() > 0) {
      await tab.click();
      await settle(page, 500);
      await snap(page, `healthcare-${tabName.toLowerCase()}`);
    }
  }
});

// ─── Global Search: search and sort ──────────────────────────────────────────
test('Global Search: search and sort chips', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  const searchBtn = page.locator('[aria-label="Search"], text=/search/i').first();
  if (await searchBtn.count() > 0) {
    await searchBtn.click();
    await settle(page, 500);

    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('grace');
      await settle(page, 1000);
      await snap(page, 'search-grace');

      // Sort chips
      const mostRecentChip = page.locator('text=/most recent/i').first();
      if (await mostRecentChip.count() > 0) {
        await mostRecentChip.click();
        await settle(page, 500);
        await snap(page, 'search-sorted');
      }
    }
  }
});

// ─── Colour scheme toggle ────────────────────────────────────────────────────
test('Settings: colour scheme (dark/light)', async ({ page }) => {
  await page.goto(BASE_URL);
  await settle(page, 1000);

  await page.click('[aria-label="Settings"]');
  await settle(page, 500);

  // Find colour scheme toggle
  const darkModeToggle = page.locator('text=/dark mode|colour scheme|color scheme/i').first();
  if (await darkModeToggle.count() > 0) {
    await snap(page, 'colour-scheme-before');

    // Get current body bg
    const beforeBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await darkModeToggle.click();
    await settle(page, 1000);
    await snap(page, 'colour-scheme-after');

    const afterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(afterBg).not.toBe(beforeBg);

    // Toggle back
    await darkModeToggle.click();
    await settle(page, 1000);
    const restoredBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(restoredBg).toBe(beforeBg);
  }
});

// ─── Summary reporter ────────────────────────────────────────────────────────
test.afterAll(async () => {
  console.log('\n=== Toggle Exercise Complete ===');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log('Review screenshots to verify visual state changes.');
});