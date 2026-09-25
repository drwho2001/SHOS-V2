// Batch A live verification — proves focus actually LANDS in each fixed
// sheet, which is exactly what the 25 Sep accessibility batch claimed but
// silently failed to deliver (ref on a <div> with no tabIndex is a no-op).
// Run against `vite preview`: node scripts/verify-focus.cjs
const { chromium } = require("playwright");
const APP_URL = process.env.SMOKE_TEST_URL || "http://localhost:5183";

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; console.log("  ok - " + msg); }
  else { fail++; console.log("  FAIL - " + msg); }
}

async function dismissBanners(page) {
  for (const l of ["due medications", "refill", "testing", "clinic visit", "vaccination"]) {
    await page.locator(`[aria-label="Dismiss ${l} banner"]`).first().click({ timeout: 1500 }).catch(() => {});
  }
  await page.locator('[aria-label="Dismiss update notice"]').first().click({ timeout: 1500 }).catch(() => {});
}
async function goHome(page) {
  await dismissBanners(page);
  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await dismissBanners(page);
}
// Navigate to Healthcare's Symptoms tab, reporting what's actually on
// screen if it can't get there (the due-reminder/SW banners are
// position:fixed at the top and have silently eaten coordinate clicks
// before - see the smoke suite's own helper comments).
async function openSymptoms(page) {
  await goHome(page);
  await page.locator("text=Healthcare").last().click({ timeout: 8000 });
  await page.waitForTimeout(900);
  await dismissBanners(page);
  // NB: must use the role="tab" locator, NOT text=Symptoms — Playwright's
  // text= engine is a case-insensitive substring match, so it was happily
  // matching "Active symptoms" in Healthcare's own summary card and
  // clicking that instead of the sub-tab. (This script's own bug, caught
  // live, not an app bug.)
  const tab = page.getByRole("tab", { name: "Symptoms" });
  const ok = await tab.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (!ok) {
    console.log("    (diagnostic) body text: " + (await page.evaluate(() => document.body.innerText)).slice(0, 300).replace(/\n/g, " / "));
  }
  await tab.click({ timeout: 8000 });
  await page.waitForTimeout(900);
}
// What is focused right now, and is it inside a dialog?
async function focusReport(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    const dlg = a ? a.closest('[role="dialog"]') : null;
    const searchInput = document.querySelector('input[placeholder^="Search contacts"]');
    return {
      tag: a ? a.tagName : null,
      role: a ? a.getAttribute("role") : null,
      label: a ? a.getAttribute("aria-label") : null,
      insideDialog: !!dlg,
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
      focusedIsDialogItself: a ? a.getAttribute("role") === "dialog" : false,
      searchOpen: !!searchInput,
      searchInputFocused: !!searchInput && searchInput === document.activeElement,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator("text=Skip").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator("text=Don't ask again").first().click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(600);

  // ---- 1. Contacts Add/Edit sheet: the duplicate-wrapper regression ----
  console.log("\n[1] Contacts -> Add contact (restored backdrop)");
  await goHome(page);
  await page.locator("text=Contacts").last().click({ timeout: 8000 });
  await page.waitForTimeout(700);
  await page.locator('[aria-label="Add contact"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(900);
  const sheetCount = await page.locator("[data-contact-sheet]").count();
  check(sheetCount === 1, `exactly one [data-contact-sheet] (was 2 - duplicate wrapper). found ${sheetCount}`);
  const backdrop = await page.evaluate(() => {
    const s = document.querySelector("[data-contact-sheet]");
    const p = s ? s.parentElement : null;
    if (!p) return null;
    const cs = getComputedStyle(p);
    return { position: cs.position, background: cs.backgroundColor, ariaLabel: p.getAttribute("aria-label") };
  });
  check(!!backdrop && backdrop.position === "fixed", `sheet's own root is a fixed backdrop (position=${backdrop && backdrop.position})`);
  check(!!backdrop && /rgba\(0,\s*0,\s*0/.test(backdrop.background), `backdrop is dimmed (bg=${backdrop && backdrop.background})`);
  check(!!backdrop && backdrop.ariaLabel === "Add contact", `backdrop carries the correct aria-label (got "${backdrop && backdrop.ariaLabel}", was wrongly "Import shared profile")`);
  let f = await focusReport(page);
  check(f.focusedIsDialogItself && f.insideDialog, `focus landed ON the dialog itself (tag=${f.tag} role=${f.role})`);
  // tap outside must close it again
  await page.mouse.click(195, 60);
  await page.waitForTimeout(700);
  const afterOutside = await page.locator("[data-contact-sheet]").count();
  check(afterOutside === 0, `tapping the backdrop closes the sheet again (found ${afterOutside})`);

  // ---- 2. Healthcare -> Symptoms -> Log symptom (was a no-op focus) ----
  console.log("\n[2] Healthcare -> Symptoms -> Log symptom (tabIndex added)");
  await openSymptoms(page);
  await page.locator('[aria-label="Add symptom entry"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(900);
  f = await focusReport(page);
  check(f.focusedIsDialogItself, `focus landed on the Log-symptom dialog (tag=${f.tag} role=${f.role})`);
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator('[aria-label="Close"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);

  // ---- 3. Healthcare -> Episodes: label + focus + no nested dialog ----
  console.log("\n[3] Healthcare -> Episodes (overlay relabelled, focus moved)");
  await page.locator('[aria-label="Episodes"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1000);
  const ep = await page.evaluate(() => {
    const dl = Array.from(document.querySelectorAll('[role="dialog"]'))
      .filter((d) => /Episodes/.test(d.getAttribute("aria-label") || ""));
    return { count: dl.length, labels: dl.map((d) => d.getAttribute("aria-label")) };
  });
  check(ep.count === 1, `exactly ONE Episodes dialog, no nesting (found ${ep.count}: ${ep.labels.join(" | ")})`);
  f = await focusReport(page);
  check(f.focusedIsDialogItself || f.insideDialog, `focus reached the Episodes dialog (tag=${f.tag} role=${f.role})`);

  // ---- 4. Global Search: focus must land in the INPUT, not a container ----
  // Full reload first: the Episodes overlay from test 3 is position:fixed
  // over the whole app, so the bottom nav underneath it is not clickable
  // and there is no Escape handler yet (that is a separate, later batch).
  // This is a real finding in its own right, not just a test inconvenience.
  console.log("\n[4] Global Search (input must keep focus)");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // The app deliberately resumes the last active tab on boot (a real
  // feature, and the smoke suite clears/handles it everywhere), so after a
  // reload we land on Healthcare, not Home - go Home explicitly first or
  // Home's own header Search icon isn't in the DOM at all.
  await goHome(page);
  await page.locator('[aria-label="Search"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1000);
  f = await focusReport(page);
  check(f.searchInputFocused, `focus is on the search INPUT, not a container (tag=${f.tag} role=${f.role} searchOpen=${f.searchOpen})`);

  console.log(`\npage errors: ${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log("  " + e));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed, ${errors.length} page errors`);
  await browser.close();
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
})();
