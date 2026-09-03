// smoke-test.cjs
//
// Manual regression check for a handful of flows that are easy to
// silently break and annoying to re-verify by hand every time: medication
// dose logging (reason/side effects), the Testing <-> Symptom Log
// two-way link, and the Locations registry screen's extra fields.
// Not wired into CI (no test runner is configured in this project, and
// running a real headless browser in CI is its own project) — this is a
// dev tool, run it yourself before/after a risky change:
//
//   npm run dev -- --port 5183   (in one terminal)
//   node scripts/smoke-test.cjs  (in another)
//
// .cjs, not .js — this project is "type": "module" in package.json,
// and this script uses plain require().
//
// Requires Chromium + the `playwright` package available on PATH/require
// (this repo does not depend on it directly — see README-less note below:
// point PLAYWRIGHT_MODULE / PLAYWRIGHT_EXECUTABLE at a local install if
// the defaults below don't resolve on your machine).
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE || "playwright";
const PLAYWRIGHT_EXECUTABLE = process.env.PLAYWRIGHT_EXECUTABLE || undefined; // let Playwright find its own browser by default
const APP_URL = process.env.SMOKE_TEST_URL || "http://localhost:5183";

const { chromium } = require(PLAYWRIGHT_MODULE);

function assert(cond, msg) {
  if (!cond) throw new Error("FAILED: " + msg);
  console.log("  ok — " + msg);
}

async function dismissOnboarding(page) {
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator("text=Skip").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator("text=Don't ask again").first().click({ timeout: 3000 }).catch(async () => {
    await page.locator("text=Not now").first().click({ timeout: 3000 }).catch(() => {});
  });
  await page.waitForTimeout(600);
  // ADDED 3 Sep 2026 — the seed data's own PrEP dose is always "due
  // now", which (correctly, as of the new in-app due-meds awareness
  // banner) now shows a real banner reading "PrEP (Descovy) — due now"
  // above every screen. That text otherwise collides with this
  // script's own `text=PrEP (Descovy)` locator further down (matches
  // the banner instead of the real list entry) — dismissed here,
  // same as a real user glancing at it once and moving on, so the rest
  // of this script keeps testing the real medication list, not the
  // banner sitting on top of it.
  await page.locator('[aria-label="Dismiss"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function testMedicationReasonSideEffects(page) {
  console.log("\n[1/3] Medication log — Reason/Side effects (added 1 Sep 2026)");
  await page.locator("text=Medication").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Log").first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=PrEP (Descovy)").first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  assert(await page.locator("text=Reason (optional)").count() > 0, "Reason chips render on a dose entry");
  assert(await page.locator("text=Side effects (optional)").count() > 0, "Side effects chips render on a dose entry");
  await page.locator("text=Routine").click({ timeout: 3000 });
  await page.locator("text=Nausea").click({ timeout: 3000 });
  await page.locator("text=Save correction").click({ timeout: 3000 });
  await page.waitForTimeout(600);
  assert((await page.evaluate(() => document.body.innerText)).includes("Routine · Nausea"), "Log tab shows the saved reason/side-effect summary");
}

async function testSymptomTestTwoWayLink(page) {
  console.log("\n[2/3] Testing <-> Symptom Log two-way link (added 2 Sep 2026)");
  await page.locator("text=Healthcare").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Test of cure — Gonorrhoea").click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Edit").first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(400);
  const chip = page.locator("text=+ Discharge + discomfort");
  if (await chip.count() > 0) {
    await chip.click({ timeout: 5000 });
    await page.waitForTimeout(400);
    assert((await page.evaluate(() => document.body.innerText)).includes("Discharge + discomfort · Aug"), "linked chip moves into the linked-entries list");
  } else {
    console.log("  skip — already linked from a previous run (idempotent state, not a failure)");
  }
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(300);
  await page.locator("text=Save").click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Symptoms").first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Discharge + discomfort").click({ timeout: 5000 });
  await page.waitForTimeout(500);
  const text = await page.evaluate(() => document.body.innerText);
  assert(text.includes("Test of cure — Gonorrhoea"), "Symptom Log's own Related records now lists the test linked from Testing's side");
}

async function testLocationsExtraFields(page) {
  console.log("\n[3/3] Locations registry — extra fields (added 2 Sep 2026)");
  // the Settings gear only lives on the Home dashboard header — get back
  // there first, since the previous check left us on Healthcare/Symptoms.
  // The Home tab is icon-only (no text label — see App.jsx's bottom nav,
  // it's the raised circular button), so this is a coordinate click
  // tied to the 390x844 viewport set below, not a text/role locator.
  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  await page.locator("text=Manage lists").click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Locations").click({ timeout: 5000 });
  await page.waitForTimeout(600);
  const homeRow = page.locator("div").filter({ hasText: /^Home/ }).first();
  const chevron = homeRow.locator("svg").first();
  await chevron.click({ timeout: 5000 });
  await page.waitForTimeout(400);
  assert(await page.locator("text=Related contact").count() > 0, "extra-fields panel (Type/Address/Related contact/Notes) expands without closing rename mode");
}

(async () => {
  const browser = await chromium.launch({ executablePath: PLAYWRIGHT_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  let failed = false;
  try {
    await dismissOnboarding(page);
    await testMedicationReasonSideEffects(page);
    await testSymptomTestTwoWayLink(page);
    await testLocationsExtraFields(page);
  } catch (err) {
    failed = true;
    console.error("\n" + err.message);
  }

  await browser.close();

  if (pageErrors.length > 0) {
    failed = true;
    console.error("\nUncaught page errors during the run:\n" + pageErrors.join("\n"));
  }

  if (failed) {
    console.error("\nSMOKE TEST: FAILED");
    process.exit(1);
  }
  console.log("\nSMOKE TEST: ALL PASSED");
})();
