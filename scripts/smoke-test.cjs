// smoke-test.cjs
//
// Regression check for a handful of flows that are easy to silently
// break and annoying to re-verify by hand every time: medication dose
// logging (reason/side effects), the Testing <-> Symptom Log two-way
// link, the Locations registry screen's extra fields, Phase 4's own
// real encryption-at-rest flows (see CLAUDE.md's Known Issues entry
// for the full design) — that raw localStorage is genuinely ciphertext
// and that App Lock's PIN really gates the vault, not just a stored
// flag, and — added 9 Sep 2026, later the same day — that a real
// EXISTING install's own legacy plaintext data actually migrates
// through the real boot sequence, the single highest-stakes one-time
// operation in this whole app that had zero regression coverage until
// now — and, added 9 Sep 2026 (closing the "verified once, covered
// never" backlog item CLAUDE.md logged the same day), three more
// real, shipped features that had each only ever been checked by a
// throwaway script: Resources' clickable links, Encounters' Anonymise
// masking, and the Medication Dashboard's next-reminder clock. This
// file WAS wired into CI the same day it was first written (4 Sep,
// see `.github/workflows/smoke-test.yml`). Still also worth running by
// hand before/after any risky change during a session:
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
  // the banner instead of the real list entry) — dismissed here, same
  // as a real user glancing at it once and moving on, so the rest of
  // this script keeps testing the real medication list, not the
  // banner sitting on top of it. Same reasoning for the Refill/
  // Testing/Clinic-visit parity banners and the service-worker update
  // prompt — all harmless no-ops via .catch() if the seed data/dev
  // session doesn't happen to trigger any of them.
  await dismissTransientBanners(page);
}

// ADDED 9 Sep 2026 — real flakiness found while adding the new tests
// below, which reload the page mid-suite far more than the original
// three ever did: the service-worker update banner (see App.jsx's own
// swUpdateAvailable) isn't only a first-load thing — a genuine SW
// update can land and take over at ANY reload during a long dev-server
// session (a rebuild swaps in a new sw.js). A reload that lands on
// that banner blocks the fixed-coordinate Home/Settings-gear clicks
// several tests below rely on (the gear sits right where the banner's
// own dismiss control is). Pulled out into its own function so every
// reload point in the suite — not just the very first page load — can
// defend against it the same way; every click here is a harmless
// no-op via .catch() if the banner in question isn't actually showing.
async function dismissTransientBanners(page) {
  await page.locator('[aria-label="Dismiss due medications banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss refill banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss testing banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss clinic visit banner"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.locator('[aria-label="Dismiss update notice"]').first().click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(300);
}

async function testMedicationReasonSideEffects(page) {
  console.log("\n[1/9] Medication log — Reason/Side effects (added 1 Sep 2026)");
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
  console.log("\n[2/9] Testing <-> Symptom Log two-way link (added 2 Sep 2026)");
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
  console.log("\n[3/9] Locations registry — extra fields (added 2 Sep 2026)");
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

// ADDED 9 Sep 2026 — real report: "show as hyperlink/click to open"
// on Settings' Resources screen. resourceLinkHref() (see that file's
// own comment) builds a real tappable href for a saved URL/phone
// number instead of rendering plain text — verified once live while
// building it (the Refuge entry, a real https:// URL from the seeded
// list), never given permanent coverage until now.
async function testResourceLinkClickable(page) {
  console.log("\n[4/9] Resources screen — links render as real clickable anchors (added 9 Sep 2026)");
  // Reload first — the previous test (Locations registry) leaves the
  // Manage Lists > Locations sub-screen open, a stacked Settings
  // overlay that would otherwise sit on top of (and intercept clicks
  // meant for) whatever this test opens next. Reload drops back to a
  // real bottom-tab screen via the existing resume-last-tab feature,
  // same trick openSettingsPrivacyScreen below already relies on.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await dismissTransientBanners(page);
  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  await page.locator("text=Resources", { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Search resources"]').fill("Refuge");
  await page.waitForTimeout(500);
  const link = page.locator('a[href="https://refuge.org.uk/"]');
  assert(await link.count() > 0, "the seeded Refuge entry (a real https:// link) renders as an actual anchor, not plain text");
  assert((await link.first().getAttribute("target")) === "_blank", "the anchor opens in a new tab rather than navigating away from the app");
  // Reload rather than hunting for the icon-only back chevron — same
  // trick openSettingsPrivacyScreen below already uses; drops back to
  // the real Home tab via the existing resume-last-tab feature, since
  // Resources (like every Settings sub-screen) is only ever reached
  // from Home's gear icon.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await dismissTransientBanners(page);
}

// ADDED 9 Sep 2026 — real bug report: "contacts anonymised, but not
// encounters." EncounterCard/ActivityDetails both now read
// PrivacySettingsRepository's anonymiseModeActive and mask attendee
// names the same way Contacts already did — verified once live while
// fixing it, never given permanent coverage until now. Uses the seeded
// "Sauna trip" encounter (encounter_002/encounter_012 both list
// contact_003 "Sam" as an attendee, so whichever one a duplicate-title
// match resolves to still carries the name this test checks for) —
// deliberately not one of the "<Name> — ..." titled encounters, since
// the title itself would still show the real name even with masking
// on and make the "real name is gone" half of this check meaningless.
// Runs before the encryption tests below so Anonymise mode's own PIN
// (anonymisePin) is still unset at this point — deactivating needs no
// PIN then (see privacySettingsRepository.js's own deactivate()).
async function testEncountersAnonymiseMasking(page) {
  console.log("\n[5/9] Encounters — Anonymise mode masks attendee names (added 9 Sep 2026)");
  await page.locator("text=Encounter").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Sauna trip").first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  assert(text.includes("Sam"), "before Anonymise mode, the real attendee name shows in the encounter's Attendees section");

  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  await page.locator("text=Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Turn on Anonymise mode").first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  assert((await page.evaluate(() => document.body.innerText)).includes("Anonymise mode is ON"), "Anonymise mode turns on");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await dismissTransientBanners(page);
  await page.locator("text=Encounter").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.locator("text=Sauna trip").first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  assert(text.includes("•••• hidden"), "with Anonymise mode on, the encounter's Attendees section shows the masked placeholder");
  assert(!text.includes("Sam"), "the real attendee name no longer appears anywhere on the encounter detail screen");

  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  await page.locator("text=Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Turn off Anonymise mode")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  assert(!(await page.evaluate(() => document.body.innerText)).includes("Anonymise mode is ON"), "Anonymise mode turns back off cleanly, leaving the suite in a clean state");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await dismissTransientBanners(page);
}

// ADDED 9 Sep 2026 — real ask: "no where to see what time next alarm
// will fire." nextReminderClock (see MedicationCard's own comment)
// shows the real clock time medicationReminderSync.js schedules the
// native reminder from (lockoutEndsAt()), not just a relative "~5h"
// estimate — verified once live against real seed data, never given
// permanent coverage until now. Deliberately logs a BRAND NEW dose for
// Vitamin D3 rather than trusting the seed data's own last-dose
// timestamp: seed log dates are computed as "N days ago" relative to
// whenever the app is actually loaded (see logRepository.js's own
// daysAgo()), and Vitamin D3's own seed dose is only 1 real day old —
// close enough to its own ~19.2h lockout window that whether it reads
// as already-unlocked (no reminder clock, correctly) or still-locked
// (reminder clock already showing) depends on what time of day this
// suite happens to run, which would make an assertion here flaky
// rather than a real regression check either way. Tapping "Log dose"
// twice, rather than once, correctly handles both of those real
// starting states without special-casing which one applies: if it's
// already unlocked, the first tap logs the dose for real and the
// second tap only arms the (harmless, no-op here) lockout confirm
// flash; if it's still locked from the old seed dose, the first tap
// only arms that same flash and the second tap is the real "log
// anyway" confirmation — see MedicationCard's own handleLogTap for
// the exact mechanism. Either path ends with exactly one fresh dose
// logged at the real current time, which always has a real future
// lockoutEndsAt() to check.
async function testMedicationReminderClock(page) {
  console.log("\n[6/9] Medication Dashboard — next-reminder clock time (added 9 Sep 2026)");
  await page.locator("text=Medication").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  // Scoped on "Last dose" rather than the "Log dose" button's own text
  // — that button's label flips to "Already logged" once locked (see
  // below), which would make a filter keyed on "Log dose" resolve to
  // zero elements in that starting state; "Last dose:" renders
  // unconditionally either way.
  const card = page.locator("div").filter({ hasText: "Vitamin D3" }).filter({ hasText: "Last dose" }).last();
  assert(await card.count() > 0, "the seeded Vitamin D3 card is on screen to test against");
  const logButton = card.locator('button:has-text("Log dose"), button:has-text("Already logged")').first();
  await logButton.click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await logButton.click({ timeout: 5000 });
  await page.waitForTimeout(500);
  const cardText = await card.evaluate((el) => el.innerText);
  assert(/Next dose[^)]*\(reminder ~[^)]+\)/.test(cardText), "logging a fresh dose shows a real reminder clock time alongside the relative \"Next dose\" estimate");
}

// ADDED 9 Sep 2026 — the single highest-stakes gap flagged in
// CLAUDE.md's own Phase 4 write-up: every other flow in this suite
// starts from a genuinely fresh install, where cryptoService.js's own
// isMigrationNeeded() is always false (nothing to migrate) — meaning
// the one real, one-time, irreversible operation this whole
// encryption effort exists to run safely (an EXISTING install's real
// legacy plaintext data getting encrypted for the first time) had
// never actually been exercised by anything that survives past a
// single verification session. Needs its own isolated browser
// CONTEXT, not just the shared `page` every other test reuses — the
// seed data has to exist in localStorage BEFORE the app's own first
// script ever runs, which `page.evaluate()` after a normal `page.goto()`
// can't do (the app's own boot sequence, including
// `initializeFreshVault()`'s own fresh-vs-existing-install check,
// would have already run by then). `context.addInitScript()` runs
// before every document load in a context, which is exactly what's
// needed here.
// Seeds two real `shos_`-prefixed keys as plain, un-encrypted JSON —
// `shos_app_preferences` (with a real `lastActiveTab`/`lastActiveAt`
// pair, so a successful migration is provable through actual app
// BEHAVIOR — the Medication tab resuming — not just a raw storage
// shape check) and `shos_contacts` (a second, independent key, kept
// deliberately empty/schema-trivial so it can't itself break
// rendering — the point is proving MULTIPLE keys get walked, not
// exercising Contacts' own UI). `lastActiveAt` is computed live,
// inside the injected script itself (real `new Date()`, not a value
// baked into this file), so it's always within
// `App.jsx`'s own 10-minute resume-grace window regardless of when
// this suite actually runs. No `shos_vault_key_slots` key is seeded —
// its absence alongside real `shos_` data already present is exactly
// the condition `initializeFreshVault()` uses to distinguish "an
// existing install's first Phase 4 boot" from a genuinely fresh
// profile (see that function's own comment).
async function testEncryptionMigratesLegacyData(browser) {
  console.log("\n[7/9] Encryption at rest — an existing install's real legacy data migrates on first boot (added 9 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem("shos_app_preferences", JSON.stringify({
      lastActiveTab: "medication",
      lastActiveAt: new Date().toISOString(),
      hasCompletedOnboarding: true,
    }));
    localStorage.setItem("shos_contacts", JSON.stringify([]));
  });
  const page = await context.newPage();
  const migrationPageErrors = [];
  page.on("pageerror", (err) => migrationPageErrors.push(err.message));

  await dismissOnboarding(page);
  await page.waitForTimeout(500);

  const bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes("Enter PIN to unlock"), "App Lock stayed off (the seeded preferences didn't accidentally enable it) — real content, not a lock screen");
  assert(bodyText.includes("PrEP (Descovy)"), "the app resumed on the seeded lastActiveTab (Medication) without any manual tab click, proving the migrated preferences round-tripped through real decrypt + business logic, not just a raw storage flip");

  const rawShapes = await page.evaluate(() => {
    const out = {};
    for (const key of ["shos_app_preferences", "shos_contacts"]) {
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
  assert(rawShapes.shos_app_preferences, "the seeded legacy shos_app_preferences is genuinely ciphertext after boot, not still plaintext");
  assert(rawShapes.shos_contacts, "the seeded legacy shos_contacts is genuinely ciphertext after boot too — proving the migration walked more than just one key");

  if (migrationPageErrors.length > 0) {
    throw new Error("Uncaught page errors during the migration-from-legacy-data run:\n" + migrationPageErrors.join("\n"));
  }
  await context.close();
}

// ADDED 9 Sep 2026 — Phase 4's own real encryption-at-rest, the actual
// point of the whole multi-session encryption effort (see CLAUDE.md's
// Known Issues entry). This is the one flow class that had ZERO
// permanent test coverage before this — every verification script
// written while building it was thrown away once it passed, so nothing
// would catch a future regression here without this. Run near the end
// of the suite deliberately: by this point tests 1-6 have already
// created real data under several different shos_ keys, giving this
// check broad, real coverage rather than just the vault metadata key
// and whatever the fresh boot itself wrote.
async function testEncryptionPositiveCheck(page) {
  console.log("\n[8/9] Encryption at rest — raw localStorage is genuinely ciphertext (added 9 Sep 2026)");
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
// render. ADDED 9 Sep 2026 — same reasoning as dismissTransientBanners
// above: a reload can also land on a fresh service-worker update
// banner, which sits right where the Home-icon coordinate click below
// needs to land.
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
  await dismissTransientBanners(page);
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
  console.log("\n[9/9] Encryption at rest — App Lock's PIN really gates the vault (added 9 Sep 2026)");
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
    await testResourceLinkClickable(page);
    await testEncountersAnonymiseMasking(page);
    await testMedicationReminderClock(page);
    await testEncryptionMigratesLegacyData(browser);
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
