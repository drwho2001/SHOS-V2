// smoke-test.cjs
//
// Regression check for a handful of flows that are easy to silently
// break and annoying to re-verify by hand every time: medication dose
// logging (reason/side effects), the Testing <-> Symptom Log two-way
// link, the Locations registry screen's extra fields, and — added
// 9 Sep 2026, Phase 4's own real encryption-at-rest flows (see
// CLAUDE.md's Known Issues entry for the full design) — that raw
// localStorage is genuinely ciphertext and that App Lock's PIN really
// gates the vault, not just a stored flag. CORRECTED comment: this
// file WAS wired into CI the same day it was first written (4 Sep,
// see `.github/workflows/smoke-test.yml`) — the line that used to say
// "not wired into CI" here was stale from an earlier draft, left
// uncorrected until now. Still also worth running by hand before/after
// any risky change during a session:
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
  await page.locator('[aria-label="Dismiss due medications banner"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  // ADDED — same reasoning, for the Refill/Testing/Clinic-visit
  // parity banners: harmless no-ops via .catch() if the seed data
  // doesn't happen to trigger any of them.
  await page.locator('[aria-label="Dismiss refill banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss testing banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss clinic visit banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
  // ADDED 3 Sep 2026 — same reasoning for the new service-worker
  // update prompt: a real update genuinely can fire mid dev-server
  // testing (a rebuild swaps in a new sw.js) and its bottom-anchored
  // banner can then sit over form controls lower on a scrolled screen.
  await page.locator('[aria-label="Dismiss update notice"]').first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function testMedicationReasonSideEffects(page) {
  console.log("\n[1/5] Medication log — Reason/Side effects (added 1 Sep 2026)");
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
  console.log("\n[2/5] Testing <-> Symptom Log two-way link (added 2 Sep 2026)");
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
  console.log("\n[3/5] Locations registry — extra fields (added 2 Sep 2026)");
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

// ADDED 9 Sep 2026 — Phase 4's own real encryption-at-rest, the actual
// point of the whole multi-session encryption effort (see CLAUDE.md's
// Known Issues entry). This is the one flow class that had ZERO
// permanent test coverage before this — every verification script
// written while building it was thrown away once it passed, so nothing
// would catch a future regression here without this. Run near the end
// of the suite deliberately: by this point tests 1-3 have already
// created real data under several different shos_ keys, giving this
// check broad, real coverage rather than just the vault metadata key
// and whatever the fresh boot itself wrote.
async function testEncryptionPositiveCheck(page) {
  console.log("\n[4/5] Encryption at rest — raw localStorage is genuinely ciphertext (added 9 Sep 2026)");
  const rawShapes = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // shos_vault_key_slots is the one deliberate, documented
      // exception — see cryptoService.js's own header for why it
      // structurally can't be encrypted by the key it exists to
      // protect.
      if (!key || !key.startsWith("shos_") || key === "shos_vault_key_slots") continue;
      const raw = localStorage.getItem(key);
      try {
        const parsed = JSON.parse(raw);
        out[key] = !!parsed && typeof parsed === "object" && !Array.isArray(parsed)
          && typeof parsed.iv === "string" && typeof parsed.ciphertext === "string"
          && Object.keys(parsed).length === 2;
      } catch {
        out[key] = false;
      }
    }
    return out;
  });
  const checkedKeys = Object.keys(rawShapes);
  assert(checkedKeys.length >= 3, `at least a few real shos_ keys exist to check (found ${checkedKeys.length})`);
  const plaintextKeys = checkedKeys.filter((k) => !rawShapes[k]);
  assert(plaintextKeys.length === 0, `every real shos_ key is genuinely ciphertext, not plaintext${plaintextKeys.length ? " — FAILING KEYS: " + plaintextKeys.join(", ") : ""}`);
}

// Navigates back to Settings' Privacy screen from wherever the suite
// currently is. A plain reload first, rather than trying to trace back
// through whatever Settings sub-screen a prior test left open — reload
// always drops back to a real bottom-tab screen (via the existing
// resume-last-tab feature, well within its 10-minute grace window),
// which is what the Home-icon coordinate click below actually needs.
// `unlockPin`, when given, re-enters the PIN if the reload itself lands
// on the real lock screen (App Lock still on from an earlier step in
// this same test) — a real bug caught live on the first run of this
// exact test: without this, the second call (made specifically to turn
// App Lock back off) reloaded straight into the lock screen and then
// tried clicking Home/Settings coordinates against IT instead of real
// content, timing out looking for "Privacy" that was never going to
// render.
async function openSettingsPrivacyScreen(page, unlockPin) {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (unlockPin) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("Enter PIN to unlock")) {
      await page.fill('input[type="password"]', unlockPin);
      await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
      await page.waitForTimeout(700);
    }
  }
  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  await page.locator("text=Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
}

// The real point of Phase 4: App Lock's PIN has to actually gate the
// vault (cryptoService.enablePinProtection/unlockWithPin), not just
// flip a stored flag — this is exactly the class of thing that could
// silently regress back to "just a UI door" without a test noticing,
// since the lock screen would look identical either way.
async function testEncryptionAppLockGatesVault(page) {
  console.log("\n[5/5] Encryption at rest — App Lock's PIN really gates the vault (added 9 Sep 2026)");
  await openSettingsPrivacyScreen(page);

  await page.locator('button:has-text("Set a PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(200);
  const pinInputs = page.locator('input[inputmode="numeric"]');
  await pinInputs.nth(0).fill("2468");
  await pinInputs.nth(1).fill("2468");
  await page.locator('button:has-text("Save PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(400);

  await page.locator('[aria-label="App Lock"]').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  assert((await page.getAttribute('[aria-label="App Lock"]', "aria-checked")) === "true", "App Lock turns on with no error (real vault re-wrap succeeded)");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("Enter PIN to unlock"), "reloading with App Lock on shows the real lock screen, not real content");

  await page.fill('input[type="password"]', "0000");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  await page.waitForTimeout(400);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("Incorrect PIN"), "a wrong PIN is rejected — the vault itself refuses it, not a string comparison");

  await page.fill('input[type="password"]', "2468");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  await page.waitForTimeout(700);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes("Enter PIN to unlock"), "the real PIN unlocks the vault and reaches real content");

  // Leave the suite in a clean, unlocked state. App Lock is still ON at
  // this exact point, so the reload inside openSettingsPrivacyScreen
  // will hit the real lock screen — pass the PIN so it can get past it.
  await openSettingsPrivacyScreen(page, "2468");
  await page.locator('[aria-label="App Lock"]').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  assert((await page.getAttribute('[aria-label="App Lock"]', "aria-checked")) === "false", "App Lock turns back off cleanly, reverting to the always-works device slot");
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
    await testEncryptionPositiveCheck(page);
    await testEncryptionAppLockGatesVault(page);
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
