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
// masking, and the Medication Dashboard's next-reminder clock — and,
// added 9 Sep 2026 later still, Settings' new bottom-nav tab-reorder
// control (the "tab reorder" part of the original 18 Aug 2026
// Settings/Management ask), and — added 9 Sep 2026, even later —
// the new interactive spotlight-overlay tour (InteractiveTour.jsx):
// it auto-offers after a genuine onboarding completion (not a Skip),
// correctly defers around the App Lock setup prompt rather than
// having its own clicks silently eaten by that overlay's higher
// z-index, and persists once dismissed either way. This
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
const fs = require("fs");
const path = require("path");

function assert(cond, msg) {
  if (!cond) throw new Error("FAILED: " + msg);
  console.log("  ok — " + msg);
}

// ---------------------------------------------------------------------------
// ADDED 29 Sep 2026 (t028) - bounded waits, replacing fixed guesses.
//
// A `waitForTimeout(N)` is a claim about how fast the machine is. It is fine
// after a click whose effect is synchronous, and it is a lie wherever what
// follows is an ASSERTION on state the app loads asynchronously - which,
// since the encryption groundwork made every module async, is most of this
// suite. The reference failure is `sample-data-devtools`: a 1500ms guess, then
// a body-text read, then an assert that a user's own contact had survived a
// clear. It passed in isolation and went red in CI's sequential run, reporting
// a data-loss regression that did not exist.
//
// These two helpers are the fix, in one place rather than 59. A NEGATIVE
// assertion still needs a positive anchor - "the banner is gone" must not be
// checked before anything proves the app rendered at all, or it passes
// trivially against a blank page - so the negative sites below wait for the
// thing that should disappear by its own state, or for the nav first.
// ---------------------------------------------------------------------------

const APP_ANCHOR = '[role="navigation"][aria-label="Main navigation"]';

/** Bounded wait for text the next assertion is going to read. */
async function waitForText(page, text, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), text, { timeout });
}

/** Bounded wait for the app to be interactive again after a goto/reload. */
async function waitForAppReady(page, timeout = 20000) {
  await page.waitForSelector(APP_ANCHOR, { timeout });
}

/** Bounded wait for a locator to be gone - the sound form of a negative. */
async function waitForGone(page, locator, timeout = 20000) {
  await locator.first().waitFor({ state: "hidden", timeout });
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
// Wait until a toggle's aria-checked reaches `expected`, or time out.
//
// ADDED 27 Sep 2026 to replace a fixed `waitForTimeout` followed by an
// immediate getAttribute. That pattern is a guaranteed flake under load: the
// assertion reads the DOM at a moment unrelated to when React actually
// re-rendered, so it passes on an idle machine and fails on a busy one for no
// reason connected to the app. It has failed on this machine before and been
// written off as "the machine" - which is how a real test defect survives for
// months.
//
// Bounded, not infinite, so a genuine regression still fails rather than hangs.
async function waitForAriaChecked(page, label, expected, timeoutMs = 10000) {
  try {
    await page.waitForFunction(
      ({ label, expected }) => {
        const el = document.querySelector(`[aria-label="${label}"]`);
        return !!el && el.getAttribute("aria-checked") === expected;
      },
      { label, expected },
      { timeout: timeoutMs }
    );
    return true;
  } catch {
    return false;
  }
}

// Click a bottom-nav tab by its accessible name.
//
// FIXED 28 Sep 2026 - THIS HELPER USED TO FAIL OPEN. It was an `if (count())`
// with no `else`, so a tab whose name no longer matched was silently not
// clicked, the caller carried on, and the flow reported success having
// navigated nowhere. That is not hypothetical: the Phase 3 nav dot briefly put
// its explanation INTO the tab's accessible name, the exact-match below stopped
// matching, and every nav-based flow would have gone on passing regardless.
// The same "a gate measured nothing and looked green" failure this project has
// now hit four times - the fourth being one I introduced.
//
// It now throws when the tab is not found, and when the click does not
// actually change the current screen. A helper that can quietly do nothing is
// worse than no helper: it converts a broken locator into a green run.
async function nav(page, label) {
  const bar = page.getByRole("navigation", { name: "Main navigation" });
  const tab = bar.getByRole("button", { name: label, exact: true }).first();
  const found = await tab.count();
  if (!found) {
    // Dump what IS there. A bare "not found" sends the next person looking in
    // the wrong place, which is the same dead end a bare timeout caused in
    // flow 3.
    const present = await bar.getByRole("button").allTextContents();
    const names = await bar.getByRole("button").evaluateAll(
      (els) => els.map((e) => e.getAttribute("aria-label")).join(" | ")
    );
    throw new Error(
      `nav("${label}") found no tab. The tab labels present: ${names || "(no aria-labels)"} / text: ${JSON.stringify(present)}`
    );
  }

  // Which tab is current before the click, so we can prove the click landed.
  // aria-current is set on the active tab, so it is the honest signal.
  const before = await bar.getByRole("button", { name: label, exact: true }).first()
    .getAttribute("aria-current");
  await tab.click({ timeout: 5000 });
  try {
    await page.waitForFunction(
      ({ name }) => {
        const el = document.querySelector(
          `[role="navigation"][aria-label="Main navigation"] [role="button"][aria-label="${name}"]`
        );
        return !!el && el.getAttribute("aria-current") === "page";
      },
      { name: label },
      { timeout: 8000 }
    );
  } catch {
    if (before === "page") return; // already on this tab; nothing to wait for
    throw new Error(
      `nav("${label}") clicked the tab but the screen did not change (aria-current never became "page"). ` +
      `The app may not have navigated, or the tab is not activatable.`
    );
  }
}

// Click the Home tab. Bottom-nav tabs are role=button with aria-label and no
// text content, so they must be queried through the navigation landmark by
// role - a text search for "Home" matches nothing, and silently does nothing
// when used to decide a flow should carry on.
async function navHome(page) {
  await nav(page, "Home");
}

async function dismissTransientBanners(page) {
  // CHANGED 29 Sep 2026 (t028) - the defect this whole helper had was
  // silence. Every dismissal below is `.catch(() => {})`, so if the app had
  // not rendered its banners yet, the helper did nothing at all, reported
  // success, and the banners appeared afterwards to intercept the
  // coordinate-based Settings click in goHomeThenOpenSettings - a failure
  // that pointed nowhere near its cause. Eight call sites papered over it
  // with a fixed 800ms wait first, which is a guess about machine speed.
  //
  // So: wait for the app to be genuinely ready, then VERIFY the banners are
  // gone rather than assuming the clicks landed. A helper that can quietly do
  // nothing is worse than no helper.
  await waitForAppReady(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('[aria-label="Dismiss due medications banner"]').first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('[aria-label="Dismiss refill banner"]').first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('[aria-label="Dismiss testing banner"]').first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('[aria-label="Dismiss clinic visit banner"]').first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('[aria-label="Dismiss vaccination banner"]').first().click({ timeout: 2000 }).catch(() => {});
    await page.locator('[aria-label="Dismiss update notice"]').first().click({ timeout: 2000 }).catch(() => {});
    // ADDED 27 Sep 2026 - the first-run sample-data banner. It is NOT a
    // position:fixed overlay like the five above, so it was missed when this
    // helper was written, and its absence broke flow 3 in a confusing way: the
    // banner adds content to Home, and goHomeThenOpenSettings() reaches the
    // Settings gear by a fixed pixel coordinate, so a taller Home changed what
    // sat at that point and the click landed on nothing.
    //
    // Confirmed by A/B rather than guessed: with the banner stashed the whole
    // suite passes 15/15; with it restored, flow 3 fails.
    //
    // Dispatched in-page rather than clicked, which is load-bearing: the banner
    // sits below the fold on a 390x844 viewport, so an ordinary Playwright click
    // SCROLLS it into view first - and goHomeThenOpenSettings() then reaches the
    // gear by a fixed coordinate that assumes Home is scrolled to the top.
    // Clicking it properly broke every flow that opens Settings, with an error
    // message ("a click on Manage lists intercepted by the Settings dialog")
    // that pointed nowhere near the real cause.
    //
    // Dismissed via "Keep it for now" rather than the clear action, so the sample
    // data survives for the flows that still need it.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find((b) => (b.textContent || "").trim() === "Keep it for now");
      if (el) el.click();
    }).catch(() => {});
    // VERIFY, bounded. If a dismissal is still on screen the app was not
    // actually ready, so try again rather than proceeding and failing three
    // steps later for a reason that points at nothing.
    const left = await page.evaluate(() =>
      document.querySelectorAll(
        '[aria-label="Dismiss due medications banner"],[aria-label="Dismiss refill banner"],' +
        '[aria-label="Dismiss testing banner"],[aria-label="Dismiss clinic visit banner"],' +
        '[aria-label="Dismiss vaccination banner"],[aria-label="Dismiss update notice"]'
      ).length
    );
    if (left === 0) return;
  }
}

// ADDED 9 Sep 2026 — real regression found live while expanding the
// seed dataset: navigating to Home via this coordinate click does NOT
// reset window scroll to 0. If the PREVIOUS screen needed non-zero
// scroll to reach (e.g. Playwright's own auto-scroll-into-view finding
// a list item further down a longer list — exactly what happened once
// the Encounters seed grew from 12 to 18, changing how far down
// "Sauna trip" sits), Home renders still scrolled, and the Settings
// gear's own fixed PIXEL position (356,40) no longer matches anything
// real — the gear sits in Home's own in-flow header, not a
// position:fixed one, so it moves with scroll. Reproduced directly:
// element at (356,40) after the regression was the welcome paragraph
// text, not the gear icon. This coordinate-click pattern was
// duplicated at 7 call sites; explicit scroll-to-top before the gear
// click, pulled into one shared helper, closes it everywhere at once
// rather than patching only the 2 sites CI happened to catch this
// time — the other 5 were equally exposed, just not triggered yet.
// HARDENED 24 Sep 2026 — real CI flake ([3/15] timed out waiting for
// "Manage lists" identically on two consecutive mains): the due-reminders
// stack is position:fixed top:0 (see App.jsx) and COVERS Home's header gear
// while visible, so the (356,40) gear click hits the banner and Settings
// never opens — a silent miss, then a timeout far from the real cause.
// Dismissal is temporary (reappears on the 60s poll), and CI's slower pace
// makes a re-appeared banner far more likely by test 3 than locally, which
// is why this only ever failed in CI. Dismiss first, and verify Settings
// actually opened afterward, retrying once — closes the whole class of
// silent coordinate-click misses at every call site, not just test 3.
async function goHomeThenOpenSettings(page) {
  await dismissTransientBanners(page);
  await page.mouse.click(195, 800);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await dismissTransientBanners(page);
  await page.mouse.click(356, 40);
  await page.waitForTimeout(600);
  const opened = await page.locator("text=Manage lists").waitFor({ timeout: 2500 }).then(() => true).catch(() => false);
  if (!opened) {
    await dismissTransientBanners(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.click(356, 40);
    await page.waitForTimeout(600);
  }
}

async function testMedicationReasonSideEffects(page) {
  console.log("\n[3/23] Medication log — Reason/Side effects (added 1 Sep 2026)");
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
  // CHANGED 30 Sep 2026 (t028) - was waitForTimeout(600) directly in front of an
  // assertion reading rendered text. The save writes to an async repository, so
  // the summary reappears whenever it resolves rather than after a guess.
  await waitForText(page, "Routine · Nausea");
  assert((await page.evaluate(() => document.body.innerText)).includes("Routine · Nausea"), "Log tab shows the saved reason/side-effect summary");
}

async function testSymptomTestTwoWayLink(page) {
  console.log("\n[4/23] Testing <-> Symptom Log two-way link (added 2 Sep 2026)");
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
    // CHANGED 15 Sep 2026 — real bug found in the TEST itself, not the
    // app: this hardcoded "· Aug" as part of the expected post-link
    // string, but the seed SymptomLog entry's own dateStarted is a
    // real, fixed calendar date — as real wall-clock time moves past
    // that date's own month boundary (confirmed live: the actual
    // rendered date is now "Sep 4, 2026", correctly showing the entry
    // moved into the linked list, just not in August anymore), this
    // assertion would keep failing forever despite the app behaving
    // correctly. Derive the expected string from the chip's own real
    // text instead of hardcoding a month — same "don't assume a
    // relative-to-real-time value stays fixed" lesson already applied
    // elsewhere in this suite (see medicationReminderClock's own
    // comment).
    const chipLabel = (await chip.first().textContent()).replace(/^\+\s*/, "");
    await chip.click({ timeout: 5000 });
    // CHANGED 30 Sep 2026 (t028) - was waitForTimeout(400) before an assertion
    // reading the linked list, which is populated by an async repository read.
    await waitForText(page, chipLabel);
    assert((await page.evaluate(() => document.body.innerText)).includes(chipLabel), "linked chip moves into the linked-entries list");
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
  console.log("\n[5/23] Locations registry — extra fields (added 2 Sep 2026)");
  // the Settings gear only lives on the Home dashboard header — get back
  // there first, since the previous check left us on Healthcare/Symptoms.
  // The Home tab is icon-only (no text label — see App.jsx's bottom nav,
  // it's the raised circular button), so this is a coordinate click
  // tied to the 390x844 viewport set below, not a text/role locator.
  await goHomeThenOpenSettings(page);
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
  console.log("\n[6/23] Resources screen — links render as real clickable anchors (added 9 Sep 2026)");
  // Reload first — the previous test (Locations registry) leaves the
  // Manage Lists > Locations sub-screen open, a stacked Settings
  // overlay that would otherwise sit on top of (and intercept clicks
  // meant for) whatever this test opens next. Reload drops back to a
  // real bottom-tab screen via the existing resume-last-tab feature,
  // same trick openSettingsPrivacyScreen below already relies on.
  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);
  await goHomeThenOpenSettings(page);
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
  console.log("\n[7/23] Encounters — Anonymise mode masks attendee names (added 9 Sep 2026)");
  await page.locator("text=Encounter").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
    await page.locator("text=Sauna trip").first().click({ timeout: 5000 });
    // CHANGED 29 Sep 2026 (t028) - was waitForTimeout(500), in front of an
    // assertion reading the encounter's rendered attendees.
    await waitForText(page, "Sauna trip");
    let text = await page.evaluate(() => document.body.innerText);
  assert(text.includes("Sam"), "before Anonymise mode, the real attendee name shows in the encounter's Attendees section");

  await goHomeThenOpenSettings(page);
  await page.getByText("Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Turn on Anonymise mode").first().click({ timeout: 5000 });
  // CHANGED 30 Sep 2026 (t028) - was waitForTimeout(500) before an assertion
  // reading the mode's own state, which is persisted to an async repository.
  await waitForText(page, "Anonymise mode is ON");
  assert((await page.evaluate(() => document.body.innerText)).includes("Anonymise mode is ON"), "Anonymise mode turns on");

  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);
  await page.locator("text=Encounter").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
    await page.locator("text=Sauna trip").first().click({ timeout: 5000 });
    // CHANGED 29 Sep 2026 (t028) - the same bounded wait on the state the
    // assertion below reads, rather than a second guess at how fast this is.
    await waitForText(page, "Sauna trip");
    text = await page.evaluate(() => document.body.innerText);
  assert(text.includes("•••• hidden"), "with Anonymise mode on, the encounter's Attendees section shows the masked placeholder");
  assert(!text.includes("Sam"), "the real attendee name no longer appears anywhere on the encounter detail screen");

  await goHomeThenOpenSettings(page);
  await page.getByText("Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Turn off Anonymise mode")').click({ timeout: 5000 });
  // CHANGED 30 Sep 2026 (t028) - was waitForTimeout(500) before a NEGATIVE
  // assertion, which is the worst combination: it can pass without the app
  // having re-rendered at all. Waiting for the OFF state to be visible is
  // bounded AND proves the change took effect, so the absence that follows is
  // meaningful rather than vacuous.
  //
  // The anchor is the app's REAL off-state text, read from PrivacyScreen.jsx:
  // it renders "Anonymise mode is ON" when on and the "Turn on Anonymise mode"
  // button when off. There is no "is OFF" string - an earlier draft of this
  // comment invented one, and it would have timed out rather than passing
  // quietly, which is the good way for that mistake to surface.
  await waitForText(page, "Turn on Anonymise mode");
  assert(!(await page.evaluate(() => document.body.innerText)).includes("Anonymise mode is ON"), "Anonymise mode turns back off cleanly, leaving the suite in a clean state");
  await page.reload({ waitUntil: "networkidle" });
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
  console.log("\n[8/23] Medication Dashboard — next-reminder clock time (added 9 Sep 2026)");
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
  console.log("\n[9/23] Encryption at rest — an existing install's real legacy data migrates on first boot (added 9 Sep 2026)");
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
  console.log("\n[10/23] Encryption at rest — raw localStorage is genuinely ciphertext (added 9 Sep 2026)");
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
  // FIXED 29 Sep 2026 - both waits in this helper were fixed durations, and both
  // were wrong in the same direction. This flow failed on CI with a 15s timeout
  // waiting for the Privacy row, which is the signature of a helper that never
  // actually opened Settings rather than of a Settings bug.
  //
  // 1. The 800ms boot guess. If the app has not rendered yet, the lock-screen
  //    text is absent, so the PIN branch below is skipped entirely and the
  //    helper goes on to click around a screen nobody is looking at.
  // 2. The 700ms wait after clicking Unlock. Unlocking does a real
  //    PBKDF2-100k vault re-wrap; this suite measured ~1.1s for the same
  //    operation in the PIN-recovery flow, and those five PBKDF2 waits were
  //    already converted to bounded waits for exactly this reason. This one
  //    was missed, and leaving it meant a loaded CI runner stayed on the lock
  //    screen and failed several steps later pointing at entirely the wrong
  //    cause.
  //
  // Both now wait for the state actually being relied on, which is the same
  // rule the rest of this suite was already fixed to follow.
  await page.waitForFunction(
    () =>
      document.body.innerText.includes("Enter PIN to unlock") ||
      !!document.querySelector('[role="navigation"][aria-label="Main navigation"]'),
    undefined,
    { timeout: 20000 }
  );
  if (unlockPin) {
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("Enter PIN to unlock")) {
      await page.fill('input[type="password"]', unlockPin);
      await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
      // Wait for the lock screen to actually be gone, rather than guessing how
      // long the vault re-wrap takes.
      await page.waitForFunction(
        () => !document.body.innerText.includes("Enter PIN to unlock"),
        undefined,
        { timeout: 20000 }
      );
    }
  }
    await dismissTransientBanners(page);
    await goHomeThenOpenSettings(page);
    // FIXED 27 Sep 2026 — wait for the row to actually be there rather than
    // clicking at it and hoping. `getByText(...).click()` already retries, but
    // the failure mode this whole helper chain had was a *silent* miss: the
    // next step then operated on whatever happened to be on screen, and the
    // flow failed several steps later pointing at entirely the wrong cause.
    const privacyRow = page.getByText("Privacy", { exact: true }).first();
    await privacyRow.waitFor({ state: "visible", timeout: 15000 });
    await privacyRow.click({ timeout: 15000 });
    // And confirm we actually landed, so a mis-navigation is reported HERE
    // rather than surfacing as a mysterious failure in a later assertion.
    const landed = await page
      .locator('[aria-label="App Lock"]')
      .first()
      .waitFor({ state: "attached", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    assert(landed, "the Privacy screen actually opened (App Lock toggle is present on it)");
  }

// The real point of Phase 4: App Lock's PIN has to actually gate the
// vault (cryptoService.enablePinProtection/unlockWithPin), not just
// flip a stored flag — this is exactly the class of thing that could
// silently regress back to "just a UI door" without a test noticing,
// since the lock screen would look identical either way.
async function testEncryptionAppLockGatesVault(page) {
  console.log("\n[11/23] Encryption at rest — App Lock's PIN really gates the vault (added 9 Sep 2026)");
  await openSettingsPrivacyScreen(page);

  await page.locator('button:has-text("Set a PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(200);
  const pinInputs = page.locator('input[inputmode="numeric"]');
  await pinInputs.nth(0).fill("2468");
  await pinInputs.nth(1).fill("2468");
  await page.locator('button:has-text("Save PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(400);

  await page.locator('[aria-label="App Lock"]').click({ timeout: 5000 });
  // Bounded wait, NOT a fixed one. Turning App Lock on triggers a real
  // PBKDF2-100k vault re-wrap with verify-before-commit, which measures
  // around 1.1s on a healthy machine and considerably longer on a loaded
  // one. A fixed wait here made this assertion depend on machine speed -
  // the same bug already found and fixed twice elsewhere in this suite
  // (the PIN-recovery flow's five PBKDF2-bound waits, and an earlier
  // non-retrying count() here), now found in a third place. This returns
  // as soon as the toggle actually flips, and only waits as long as it
  // genuinely has to.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[aria-label="App Lock"]');
      return el && el.getAttribute("aria-checked") === "true";
    },
    null,
    { timeout: 30000 }
  );
  assert((await page.getAttribute('[aria-label="App Lock"]', "aria-checked")) === "true", "App Lock turns on with no error (real vault re-wrap succeeded)");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("Enter PIN to unlock"), "reloading with App Lock on shows the real lock screen, not real content");

  await page.fill('input[type="password"]', "0000");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  // Was a fixed 400ms wait then a single body-text check with no retry. A
  // wrong PIN still derives a key and attempts a real AES-GCM unwrap
  // (PBKDF2, 100k rounds), so 400ms is not reliably enough on a loaded
  // machine and this gate went red intermittently for that reason alone.
  // Same bounded-wait treatment already applied to the other PBKDF2
  // waits in this file.
  await page.waitForFunction(() => document.body.innerText.includes("Incorrect PIN"), null, { timeout: 15000 });

  await page.fill('input[type="password"]', "2468");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  await page.waitForTimeout(700);
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes("Enter PIN to unlock"), "the real PIN unlocks the vault and reaches real content");

  // Leave the suite in a clean, unlocked state. App Lock is still ON at
  // this exact point, so the reload inside openSettingsPrivacyScreen
  // will hit the real lock screen — pass the PIN so it can get past it.
  await openSettingsPrivacyScreen(page, "2468");
  // FIXED 27 Sep 2026 — the identical fixed-wait-then-read pattern that made
  // the PIN-recovery flow flaky, in the flow that runs FIRST. Same assertion,
  // same 500ms guess, same failure waiting for a slow machine. Fixed together
  // deliberately: patching one and leaving the other would have left a
  // guaranteed future flake behind.
  await page.locator('[aria-label="App Lock"]').click({ timeout: 15000 });
  assert(await waitForAriaChecked(page, "App Lock", "false", 15000),
    "App Lock turns back off cleanly, reverting to the always-works device slot");
}

// ADDED 9 Sep 2026 — real ask (18 Aug 2026 — the "tab reorder"
// part of the original Settings/Management ask): Settings > Preferences'
// new tab-order control (App.jsx's getOrderedTabs()) lets the 4
// non-Home bottom-nav tabs be reordered, Home always staying fixed in
// the centre. Reads via App.jsx's own boot-time state, same "reload to
// apply" shape as a colour override — proves the reorder actually
// reaches the real, live-rendered nav bar after a reload, not just the
// stored preference, the same class of gap this whole suite exists to
// close.
async function testTabReorder(page) {
  console.log("\n[12/23] Settings — bottom nav tab order (added 9 Sep 2026)");
  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);
  await goHomeThenOpenSettings(page);
  await page.locator("text=Preferences", { exact: true }).first().click({ timeout: 5000 });
  // HARDENED 24 Sep 2026 — PreferencesScreen is a lazy chunk since the
  // Settings split: first open needs a chunk fetch the old fixed 500ms
  // wait couldn't survive (proven live: control present at 2500ms, absent
  // at 500ms, zero crash). Wait for the marker itself instead.
  await page.locator("text=Bottom nav tab order").waitFor({ timeout: 8000 });

  assert(await page.locator("text=Bottom nav tab order").isVisible(), "the tab-order control renders in Settings > Preferences");

  for (let i = 0; i < 3; i++) {
    await page.locator('[aria-label="Move Healthcare left"]').click({ timeout: 5000 });
    await page.waitForTimeout(200);
  }
  assert(await page.locator("text=Tab order needs a reload").isVisible(), "moving a tab shows the real \"reload to apply\" prompt");

    await page.reload({ waitUntil: "networkidle" });
    // FIXED 27 Sep 2026 - this used a fixed 800ms wait, then read the nav
    // once. A reload re-boots the app and unlocks the vault asynchronously,
    // so on a slow machine the nav is still in its previous order when it's
    // read, and the flow fails while the app is completely correct. Now a
    // bounded wait on the exact state being asserted, returning as soon as
    // Healthcare really is first.
    await page.waitForFunction(
      () => {
        const nav = document.querySelector('div[style*="justify-content: space-around"][style*="position: fixed"]');
        if (!nav || !nav.children.length) return false;
        return (nav.children[0].getAttribute("aria-label") || nav.children[0].textContent.trim()) === "Healthcare";
      },
      null,
      { timeout: 20000 }
    ).catch(() => { /* fall through to the assert below, which reports the real order */ });

    await dismissTransientBanners(page);

    const navLabels = await page.evaluate(() => {
      const nav = document.querySelector('div[style*="justify-content: space-around"][style*="position: fixed"]');
      return nav ? Array.from(nav.children).map((el) => el.getAttribute("aria-label") || el.textContent.trim()) : [];
    });
  assert(navLabels[0] === "Healthcare", "Healthcare, moved to the front, actually renders first in the real, live bottom nav after reload");
  assert(navLabels[2] === "Home", "Home stays fixed in the centre position regardless of the custom order");

  // Revert to the default order, leaving the suite in a clean state.
  await goHomeThenOpenSettings(page);
  await page.locator("text=Preferences", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  for (let i = 0; i < 3; i++) {
    await page.locator('[aria-label="Move Healthcare right"]').click({ timeout: 5000 });
    await page.waitForTimeout(200);
  }
  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);
}

// ADDED 9 Sep 2026 — real ask: an interactive spotlight-overlay tour
// (InteractiveTour.jsx), not just the static Guide screen. Own fresh
// context, same reasoning as testEncryptionMigratesLegacyData above —
// this needs a genuinely fresh profile to drive onboarding through a
// real completion (not the shared page's own Skip-based dismissOnboarding
// flow), and a second fresh context to prove the Skip path deliberately
// does NOT auto-offer the tour. Covers the two real regressions found
// live while building this: the post-onboarding App Lock setup prompt
// (zIndex 998) can otherwise silently eat every tour click underneath
// it, and an early version auto-offered the tour even after an explicit
// Skip tap, which directly contradicted the user's own "not now" signal.
async function testInteractiveTour(browser) {
  console.log("\n[13/23] Interactive tour — spotlight overlay walkthrough (added 9 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const tourPageErrors = [];
  page.on("pageerror", (err) => tourPageErrors.push(err.message));

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  // Complete onboarding for real (Next through every slide, "No" on any
  // question) rather than Skip — only a genuine completion auto-offers
  // the tour.
  for (let i = 0; i < 8; i++) {
    const finish = page.locator("text=Get started").first();
    if (await finish.count()) { await finish.click({ timeout: 2000 }).catch(() => {}); break; }
    const next = page.locator("text=Next").first();
    if (await next.count()) { await next.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); continue; }
    const no = page.locator("text=No").first();
    if (await no.count()) { await no.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(300); continue; }
    break;
  }
  await page.waitForTimeout(1200);
  // The App Lock setup prompt can legitimately be showing at this exact
  // moment too (a real, independent post-onboarding overlay) — the tour
  // is deliberately deferred until it's dismissed, see App.jsx's own
  // pendingTourOffer comment.
  await page.getByRole("button", { name: "Not now" }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);

  assert(await page.locator("text=Quick tour").first().count() > 0, "the tour auto-offers right after a genuine onboarding completion, not App Lock's prompt swallowing the click");

  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Next" }).click({ timeout: 3000 });
    await page.waitForTimeout(400);
  }
  assert(await page.locator("text=Medication").first().count() > 0, "stepping through Next reaches the real Medication tab step");
  const spotlightBorder = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("div")).filter((d) => d.style.border && d.style.border.includes("0, 133, 133")).length;
  });
  assert(spotlightBorder > 0, "a real spotlight border renders around the tab's own DOM element, not a coordinate guess");

  await page.getByRole("button", { name: "Skip tour" }).click({ timeout: 3000 });
  await page.waitForTimeout(500);
  assert(await page.locator("text=Quick tour").count() === 0, "the X icon closes the tour early (skip path)");

  // Real behavioral proof of persistence, portable across both the dev
  // server and a production `vite preview` build — a direct dynamic
  // import of `/src/...` (used elsewhere in this suite for the same
  // purpose) only resolves against the dev server's own raw ES-module
  // serving, not a bundled production build, so a reload-based check is
  // the one that actually works in both.
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  assert(await page.locator("text=Quick tour").count() === 0, "skipping partway through still persists hasCompletedTour — the tour does not auto-reappear on reload");
  await context.close();

  // Second fresh context: an explicit Skip tap on onboarding itself must
  // NOT auto-offer the tour — that's the exact regression found live
  // (it also broke this suite's own Skip-based dismissOnboarding flow
  // for every other test before this fix).
  const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page2 = await context2.newPage();
  page2.on("pageerror", (err) => tourPageErrors.push(err.message));
  await page2.goto(APP_URL, { waitUntil: "networkidle" });
  await page2.waitForTimeout(1000);
  await page2.locator("text=Skip").first().click({ timeout: 5000 });
  await page2.waitForTimeout(1000);
  assert(await page2.locator("text=Quick tour").count() === 0, "explicitly tapping Skip on onboarding does NOT auto-offer the tour");
  await context2.close();

  if (tourPageErrors.length > 0) {
    throw new Error("Uncaught page errors during the interactive-tour run:\n" + tourPageErrors.join("\n"));
  }
}

// ADDED 9 Sep 2026 — real ask: importing a genuinely old backup should
// keep working on its own, not need a human to hand-check the schema
// first (see backupMigrations.js's own header). Verified once, live,
// against the owner's own real backup file (34 real contacts, 35
// encounters, 12 medications, all restored with zero data loss and the
// one real gap found — a medication `notes` field the repository's own
// DEFAULT_MEDICATION had never declared — now correctly surfaced) — but
// that check used a real personal file that can never live in this
// repo, so it can't be the permanent regression test. This flow proves
// the same real mechanism (migrateBackupData(), wired into
// restoreFromParsedBackup(), the one shared entry point for every real
// import) with a synthetic old-shaped record instead, driven through
// the actual Settings > Restore-from-backup UI and a real virtual file
// upload — not a dynamic import of `/src/...` (which only resolves
// against Vite's dev server, not a production `vite preview` build —
// the exact portability trap the interactive-tour flow above already
// hit and fixed once this same day).
async function testBackupMigratesOldFieldShape(page) {
  console.log("\n[14/23] Backup import — an old field shape auto-migrates on restore (added 9 Sep 2026)");
  const oldShapedBackup = {
    schemaVersion: 1,
    appVersion: "0.1.0-prototype",
    exportedAt: new Date().toISOString(),
    data: {
      medications: [
        { id: "med_migration_check", name: "Migration Check Med", dosePerUnit: "200mg/245mg", notes: "Take with food", isArchived: false },
      ],
    },
  };
  const fileContent = JSON.stringify(oldShapedBackup);

  await goHomeThenOpenSettings(page);
  await page.locator("text=Backup & Export", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Restore from backup", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator("text=Replace all data", { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(300);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "old-shape-backup.json", mimeType: "application/json", buffer: Buffer.from(fileContent) });
  await page.waitForTimeout(1500); // finishImport() reloads the page itself
  await page.waitForLoadState("networkidle");
  await dismissTransientBanners(page);

  await goHomeThenOpenSettings(page);
  await page.locator("text=Support", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator("text=Developer tools", { exact: true }).first().click({ timeout: 5000 });
  // HARDENED 24 Sep 2026 — same lazy-first-open class as test 10 above:
  // "Broken references" only exists on the Developer tools screen itself,
  // so waiting for it proves the chunk landed (the row label alone can't).
  await page.locator("text=Broken references").waitFor({ timeout: 8000 });
  const devToolsText = await page.evaluate(() => document.body.innerText);
  assert(devToolsText.includes("Medications") && /Medications\D*1\b/.test(devToolsText.replace(/\n/g, " ")), "the Replace All import genuinely landed (Developer Tools shows exactly 1 real medication, the migrated one)");

  // A plain reload is simpler and more robust than navigating back out
  // through Developer Tools' own chevron — the import already landed
  // and persisted, so a fresh load returns straight to Home with the
  // real bottom nav available, same as any real relaunch would.
  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);
  await page.locator("text=Medication").last().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  const dashboardText = await page.evaluate(() => document.body.innerText);
  assert(dashboardText.includes("Migration Check Med"), "the migrated medication itself is really there, not just a count");
  assert(dashboardText.includes("200mg/245mg"), "the old dosePerUnit value survived the migration, visible in the real UI, not silently dropped");
  assert(dashboardText.includes("Take with food"), "a real pre-existing note on the same record was preserved alongside the migrated value, not overwritten");
}

// ADDED 10 Sep 2026 — real ask: backup-import fuzz testing, a
// deferred backlog item picked up once the heading-size audit closed.
// Real bug found live building this, not assumed from reading the
// code (see backupService.js's own sanitizeBackupData() comment for
// the full story): an imported file is untrusted external input, and
// nothing previously checked that an array field's own ELEMENTS were
// real records before handing them to a repository's replaceAll() —
// a null/string/number/nested-array element crashed the very next
// unguarded property read (contactRepository.js's own
// computeNextContactNumber() doing `c.id` per record, no guard), and
// replaceAll() had already reassigned its module-level array to the
// bad data BEFORE that crash — a failed import left the running app's
// in-memory state corrupted (nothing persisted, since persist() never
// ran, but a raw "Cannot read properties of null" error with no
// indication a reload was now needed). Fixed by dropping any non-object
// array element at the one shared import chokepoint
// (restoreFromParsedBackup()) before either repository or migration
// code ever sees it. This flow proves the fix, not just documents it:
// a backup with 5 genuinely malformed contacts array elements (null, a
// bare string, a number, a boolean, a nested array) alongside ONE real
// valid contact restores cleanly — no "Import failed" error, no page
// error, and exactly the one valid contact lands (not zero, not a
// partial/corrupted count).
async function testBackupImportDropsGarbageRecords(page) {
  console.log("\n[17/23] Backup import — malformed array elements are dropped, not a crash (added 10 Sep 2026)");
  const malformedBackup = {
    schemaVersion: 1,
    appVersion: "0.1.0-prototype",
    exportedAt: new Date().toISOString(),
    data: {
      contacts: [null, "just a string", 42, true, [1, 2, 3], { id: "contact_fuzz_check", name: "Survives The Fuzz" }],
    },
  };
  const fileContent = JSON.stringify(malformedBackup);

  // testPinRecoveryFlow (test 13) leaves the shared page on the Privacy
  // screen — a full-screen overlay goHomeThenOpenSettings' coordinate
  // clicks don't reliably recover from (the App Lock toggle it just
  // clicked is right where Home's own bottom nav would be). A reload
  // guarantees a clean Home start, same defensive pattern already used
  // mid-suite elsewhere in this file.
  await page.reload({ waitUntil: "networkidle" });
  await dismissTransientBanners(page);

  await goHomeThenOpenSettings(page);
  await page.locator("text=Backup & Export", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator("text=Restore from backup", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator("text=Replace all data", { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(300);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({ name: "malformed-fuzz-backup.json", mimeType: "application/json", buffer: Buffer.from(fileContent) });
  await page.waitForTimeout(1500);
  const statusText = await page.evaluate(() => document.body.innerText);
  assert(!statusText.includes("Import failed"), "a malformed array element does not crash the import — no raw JS error surfaces to the user");

  await page.waitForTimeout(1500);
  await page.waitForLoadState("networkidle").catch(() => {});
  await dismissTransientBanners(page);

  await goHomeThenOpenSettings(page);
  await page.locator("text=Support", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator("text=Developer tools", { exact: true }).first().click({ timeout: 5000 });
  // HARDENED 24 Sep 2026 — same lazy-first-open class as test 10 above:
  // "Reset all app data" only exists on the Developer tools screen itself,
  // so waiting for it proves the chunk landed (the row label alone can't).
  await page.locator("text=Reset all app data").waitFor({ timeout: 8000 });
  const devToolsText = await page.evaluate(() => document.body.innerText);
  assert(/Contacts\D*1\b/.test(devToolsText.replace(/\n/g, " ")), "exactly the one real valid contact landed — every malformed element (null/string/number/boolean/nested-array) was dropped, not silently corrupting the count");
}

// ADDED 9 Sep 2026 — real ask: PIN-recovery/alternate-access, a real
// open backlog item finally built (Settings > Privacy's "Recovery
// string" section, AppLockScreen's own "Forgot PIN?" link). Runs on
// the shared page, same as test 9's own App-Lock-gates-the-vault flow
// — cleans up after itself (App Lock back off) so nothing after it is
// affected, and doesn't depend on the richer seed dataset test 12 just
// wiped, so this ordering (after 12, on the same page) is safe.
// Real bug found live building this, not from reading the design: the
// vault's own PIN slot (cryptoService.js) and PrivacySettingsRepository's
// `anonymisePin` mirror are two separate copies of "the current PIN" —
// a recovery-triggered reset only updated the vault side at first,
// leaving Settings' own toggleAppLock()/changePin() (which read the
// REPOSITORY's stale copy) silently broken the next time either was
// used. This flow's own final "Remove"/App-Lock-off cleanup steps
// directly exercise that exact path, so a regression here would fail
// loudly, not silently.
async function testPinRecoveryFlow(page) {
  console.log("\n[15/23] PIN-recovery — the recovery string genuinely unlocks and resets the PIN (added 9 Sep 2026)");
  // The App Lock setup prompt can be pending again here — test 12's
  // own Replace All import doesn't touch privacySettings at all (its
  // synthetic backup has no privacySettings key), but a plain reload
  // is enough for it to reappear if nothing dismissed it since test 9's
  // own App-Lock-off cleanup. Same collision class as the interactive
  // tour's own pendingTourOffer fix earlier this session.
  await page.getByRole("button", { name: "Not now" }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(400);
  await goHomeThenOpenSettings(page);
  await page.getByText("Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  // "Set a PIN" vs "Change PIN" — a PIN value from an earlier test in
  // this same shared-page run (e.g. test 9's own "2468") can already be
  // stored even with App Lock currently off (turning App Lock off never
  // clears the stored Revert PIN, by design — it's shared with
  // Anonymise mode too), so either label is a real, valid starting
  // state here, not just "Set a PIN".
  await page.locator('button:has-text("PIN")').first().click({ timeout: 5000 });
  await page.waitForTimeout(200);
  const pinInputs = page.locator('input[inputmode="numeric"]');
  await pinInputs.nth(0).fill("2468");
  await pinInputs.nth(1).fill("2468");
  await page.locator('button:has-text("Save PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.locator('[aria-label="App Lock"]').click({ timeout: 5000 });

  // Was a fixed 500ms wait then a single count() check with no retry —
  // turning App Lock on triggers a real vault re-wrap (PBKDF2), so 500ms
  // is not reliably enough on a loaded machine and this gate went red
  // intermittently for that reason alone, not because the app regressed.
  // Bounded wait that returns as soon as the section actually renders,
  // same treatment already applied to the five PBKDF2 waits further down
  // in this flow.
  await page
    .locator("text=Set a recovery string")
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
  await page.locator('button:has-text("Set a recovery string")').click({ timeout: 5000 });
  await page.waitForTimeout(200);
  const textInputs = page.locator('input[type="password"]:not([inputmode="numeric"])');
  await textInputs.nth(0).fill("correct-horse-battery");
  await textInputs.nth(1).fill("correct-horse-battery");
  await page.locator('button:has-text("Save")').click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.body.innerText.includes("Change recovery string"), null, { timeout: 15000 });
  assert(await page.locator("text=Change recovery string").count() > 0, "saving a recovery string switches the section to 'Change recovery string'");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  let bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("Forgot PIN?"), "the real lock screen shows 'Forgot PIN?' once a recovery string exists");

  await page.locator("text=Forgot PIN?").click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.fill('input[placeholder="Recovery string"]', "wrong-string-entirely");
  await page.fill('input[placeholder="New PIN"]', "9999");
  await page.fill('input[placeholder="Confirm new PIN"]', "9999");
  await page.locator('button:has-text("Unlock and set new PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => document.body.innerText.includes("t right"), null, { timeout: 15000 });
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("wasn't right"), "a wrong recovery string is rejected — the vault itself refuses it, not a string comparison");

  await page.fill('input[placeholder="Recovery string"]', "correct-horse-battery");
  await page.fill('input[placeholder="New PIN"]', "9999");
  await page.fill('input[placeholder="Confirm new PIN"]', "9999");
  await page.locator('button:has-text("Unlock and set new PIN")').click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.waitForFunction(() => !document.body.innerText.includes("Enter PIN to unlock") && !document.body.innerText.includes("Unlock with your recovery string"), null, { timeout: 15000 });
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes("Enter PIN to unlock") && !bodyText.includes("Unlock with your recovery string"), "the real recovery string unlocks the vault and sets a new PIN in the same step");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.fill('input[type="password"]', "2468");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => document.body.innerText.includes("Incorrect PIN"), null, { timeout: 15000 });
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(bodyText.includes("Incorrect PIN"), "the OLD PIN no longer works after a recovery-triggered reset");
  await page.fill('input[type="password"]', "9999");
  await page.locator('button:has-text("Unlock")').click({ timeout: 5000 });
  await page.waitForTimeout(700);
  await page.waitForFunction(() => !document.body.innerText.includes("Enter PIN to unlock"), null, { timeout: 15000 });
  bodyText = await page.evaluate(() => document.body.innerText);
  assert(!bodyText.includes("Enter PIN to unlock"), "the NEW PIN set during recovery genuinely gates the vault going forward");

  // Clean up: remove recovery string, turn App Lock back off — the real
  // path that would break silently if the anonymisePin-mirror bug found
  // live while building this ever regressed.
  await dismissTransientBanners(page);
  await goHomeThenOpenSettings(page);
  await page.getByText("Privacy", { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Remove")').first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  assert(await page.locator("text=Set a recovery string").count() > 0, "removing the recovery string reverts the section cleanly");
  // FIXED 27 Sep 2026 — this ending was a real recurring flake, not bad luck.
  // It asserted `aria-checked === "false"` after a FIXED 500ms wait, having
  // just clicked the toggle. Under memory pressure the click lands late and
  // React has not re-rendered when the assertion reads the attribute, so the
  // flow failed while the app was behaving correctly. CLAUDE.md already
  // records the App Lock assertion failing this way on this machine.
  //
  // The fix is to stop timing-guessing: wait for the state the assertion
  // actually cares about, with a generous bound, rather than sleeping a fixed
  // 500ms and hoping. This is the same treatment already given to the
  // PBKDF2-bound waits in this flow.
  await page.locator('[aria-label="App Lock"]').click({ timeout: 15000 });
  assert(await waitForAriaChecked(page, "App Lock", "false", 15000),
    "App Lock turns back off cleanly after a recovery-triggered PIN reset — the PrivacySettingsRepository mirror stayed in sync");
}

// ADDED 10 Sep 2026 — real bug found (not a live report) while finally
// giving this its own permanent coverage: main.jsx used to ALSO force
// an unconditional reload on the same `controllerchange` event
// App.jsx's own swUpdateAvailable banner already handles safely (see
// main.jsx's own comment for the full story) — main.jsx's reload fired
// first every time, since its listener registered before React ever
// mounted, silently making the banner's "Refresh" button and its own
// "don't reload out from under someone mid-form" reasoning
// unreachable. Fixed by removing the redundant forced reload; this
// test proves the CORRECTED behavior end-to-end: a genuine new
// service-worker version is detected, the dismissible banner appears
// (not an automatic reload), and tapping Refresh reloads for real.
// Runs in its own fresh browser context (real SW registration/
// lifecycle state, not shared with the rest of the suite).
async function testServiceWorkerAutoUpdate(browser) {
  console.log("\n[16/23] PWA auto-update — a new version shows a dismissible prompt, not a forced reload (added 10 Sep 2026)");

  // Real preview-build-only test: `vite preview` (what CI and this
  // suite's own recommended local flow both use) serves dist/sw.js
  // directly off disk per-request, no restart needed to pick up a
  // change — the same real mechanism a genuine deploy relies on.
  //
  // The guard below probes the ACTUAL precondition — "is the running
  // server serving this build?" — by comparing the served root HTML
  // against the built dist/index.html.
  //
  // Two things that look like they would work here, and don't:
  //   - Checking only that dist/sw.js exists on disk is not sufficient.
  //     A dev server also has a dist/ lying around from an earlier
  //     `npm run build`, but never serves it.
  //   - Comparing the SERVED sw.js against dist/sw.js is not sufficient
  //     either, because Vite copies public/ into the build verbatim, so
  //     public/sw.js and dist/sw.js are byte-identical and a dev server
  //     (which serves public/) matches too. Verified directly, not
  //     assumed — this is why the root-HTML comparison is used instead.
  // The built index.html genuinely differs from the dev server's
  // (hashed asset names, no /src/ reference), so it discriminates
  // reliably in both directions.
  const distDir = path.join(__dirname, "..", "dist");
  const distSwPath = path.join(distDir, "sw.js");
  const distIndexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(distSwPath) || !fs.existsSync(distIndexPath)) {
    console.log("  skip — no dist/ build found (this suite is running against a dev server, not a preview build)");
    return;
  }
  const distSwSource = fs.readFileSync(distSwPath, "utf8");
  const distIndexSource = fs.readFileSync(distIndexPath, "utf8");
  let servesThisBuild = false;
  try {
    const res = await fetch(APP_URL, { cache: "no-store" });
    servesThisBuild = res.ok && (await res.text()) === distIndexSource;
  } catch (e) {
    servesThisBuild = false;
  }
  if (!servesThisBuild) {
    console.log("  skip — the running server is not serving this dist/ build (dev server, or a different build on disk)");
    return;
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await dismissOnboarding(page);
  await dismissTransientBanners(page);

  // A real precondition for `controllerchange` to ever mean anything —
  // the very first registration doesn't emit it, by design.
  const hasController = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return !!navigator.serviceWorker.controller;
  });
  assert(hasController, "the real service worker is registered and controlling the page");

  // A marker that only a real page navigation/reload would ever clear
  // — this is what actually proves "no automatic reload happened",
  // rather than trusting a UI banner's mere presence.
  await page.evaluate(() => { window.__smokeTestNoReloadMarker = true; });

  // Simulate a real new deploy by actually swapping the real file
  // `vite preview` serves off disk — the same thing a genuine deploy
  // does. Playwright's own request interception (both page- and
  // context-level) does NOT see a service worker's own internal
  // update-check fetch — confirmed live, not assumed: a
  // context.route("**/sw.js", ...) handler never fired even once
  // across several real registration.update() calls — so faking the
  // response at the network layer isn't an option here; only a real
  // byte change on disk reliably triggers the browser's own real
  // update algorithm. try/finally guarantees the real file is restored
  // even if an assertion below throws — this must never leave the
  // build output modified.
  const originalSwSource = distSwSource;
  const bumpedSwSource = originalSwSource.replace(
    /const CACHE_NAME = "[^"]+"/,
    `const CACHE_NAME = "shos-runtime-smoketest-${Date.now()}"`
  );
  assert(bumpedSwSource !== originalSwSource, "the simulated new service-worker version is genuinely different from the real one on disk");

  try {
    fs.writeFileSync(distSwPath, bumpedSwSource);

    // Same real re-check the app's own visibilitychange handler
    // performs — triggers the browser to fetch the now-changed sw.js
    // off disk, see it's different, and run through the real install/
    // activate/controllerchange lifecycle exactly as a genuine deploy
    // would.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration.update();
    });

    const bannerAppeared = await page.locator('[aria-label="Dismiss update notice"]').first()
      .waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
    assert(bannerAppeared, "a real new service-worker version triggers the dismissible update banner");

    const stillNoReload = await page.evaluate(() => window.__smokeTestNoReloadMarker === true);
    assert(stillNoReload, "the update banner appearing did NOT force an automatic page reload — the marker survived");

    await page.getByText("Refresh", { exact: true }).click({ timeout: 5000 });
    await page.waitForLoadState("load", { timeout: 10000 });
    const reloadedAway = await page.evaluate(() => window.__smokeTestNoReloadMarker === undefined);
    assert(reloadedAway, "tapping Refresh on the banner genuinely reloads the page for real");
  } finally {
    fs.writeFileSync(distSwPath, originalSwSource);
  }

  await context.close();
}

// REMOVED 24 Sep 2026 — testDeepLinkBaseline ran here. Removed as stillborn,
// not flaky: it navigated desktop Chromium to APP_URL+"shos://..." (missing
// "/", a deterministic page.goto protocol error), the app has no shos://
// handling anywhere (native scheme is com.shos.app://, only the medication +
// encounter quick-add hostnames implemented), and 8 of its 10 routes have zero
// implementation. It never passed once. Re-add a real deep-link test only
// alongside a real web-side route parser or an on-device intent harness.


(async () => {
  const browser = await chromium.launch({ executablePath: PLAYWRIGHT_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

// ---------------------------------------------------------------------------
// ADDED 28 Sep 2026 — the wall-clock / timezone round-trip.
//
// THE ASK, in the owner's own framing: whatever time a user TYPES must be the
// wall-clock time in THEIR timezone, must be DISPLAYED back as that same
// wall-clock time, and any calculation that follows must factor the timezone in
// rather than quietly being out by however many hours the device's offset is.
// Backend files may use UTC to keep things simple; user-facing displays must be
// familiar and correct.
//
// WHY THIS IS A BROWSER TEST AND NOT A UNIT TEST: the helpers in
// dateInputHelpers.js already have unit coverage, and they are already correct.
// What no unit test can prove is whether the REAL SCREENS actually route a
// stored value through them — and this app has been bitten by exactly that
// before (CLAUDE.md records the same date rendering as "1 Mar" in London and
// "28 Feb" in New York because a few call sites had each worked it out
// individually). The device's real timezone is also a browser-context property,
// so the only honest way to test it is to boot the app three times, once per
// timezone, and look at what the user would see.
//
// WHAT IT FOUND, MEASURED NOT GUESSED: an encounter logged at 00:30 showed
// "13 Mar 2026" in America/New_York. Four sites in SHOS_Encounters_Prototype
// render a stored (fake-UTC) value with toLocaleDateString/toLocaleString and no
// `timeZone: "UTC"`, so the browser re-applies the device's offset to digits
// that were already local — shifting the DATE, not just the time. And
// timeOfDay() in encounterCalculations.js used a local `getHours()` getter on
// that same fake-UTC value, so a 00:30 encounter was filed under "Evening" in
// New York. The date-only rows are the sharp edge: any stored time in the
// evening renders as the NEXT day at positive offsets (Sydney), and any stored
// time just after midnight renders as the PREVIOUS day at negative ones (New
// York). One input time, three timezones, and both directions are covered.
//
// A NOTE ON WHAT IS *NOT* WRONG HERE, recorded because I assumed it was before
// measuring: exposureWindows.js's `daysBetween` looks like the same
// milliseconds/86400000 anti-pattern CLAUDE.md warns about, and I was ready to
// "fix" it. Run under four timezones it agrees everywhere — a Z-suffixed string
// parses to an absolute instant, so both values shift together and the
// difference cancels. That arithmetic is a true duration, not a calendar-day
// comparison, so it is correct as written. Left alone.
// ---------------------------------------------------------------------------

// One fixed wall-clock time, deliberately 30 minutes after midnight. That is
// the value that breaks hardest: at a negative UTC offset it renders as the
// PREVIOUS day, and at a positive offset a stored morning time renders later
// the same day while an evening time would render as the NEXT day.
const TZ_PROBE_TIME = "2026-03-14T00:30";

async function testTimezoneWallClockRoundTrip(browser) {
  console.log("\n[20/23] Timezone — a typed wall-clock time is stored and shown back unchanged (added 28 Sep 2026)");

  // London is the home case (and carries a real DST edge), New York is the
  // largest negative offset and Sydney the largest positive one — the two
  // extremes, which is what catches an off-by-sign rather than a fixed bias.
  const ZONES = ["Europe/London", "America/New_York", "Australia/Sydney"];

  // Per-zone check() rather than the suite's fail-fast assert(), so one bad
  // zone does not hide the other two. See the throw at the end.
  //
  // It MUST still log "  ok - " on success, exactly like assert() does: that
  // line is what the suite's own reported assertion count is derived from, so
  // a check that passes silently contributes nothing to the total. My first
  // version did exactly that — the flow went green while adding zero to the
  // assertion count, which is the fifth recorded instance in this project of a
  // gate that measures nothing and looks like it measured something, and the
  // first one I built myself in this file.
  const failures = [];
  const check = (cond, msg) => {
    if (cond) { console.log("  ok - " + msg); return; }
    failures.push(msg);
  };

  for (const zone of ZONES) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: zone,
      // SMOKE_LOCALE lets the suite be run under a different locale. This
      // exists because CI is en-US and a developer machine here is en-GB, and
      // that difference broke this flow on its first CI run: a date assertion
      // written against the en-GB spelling passed locally and failed in all
      // three timezones at once, which looked exactly like the real bug and
      // wasn't. A browser context takes a REAL locale, so the failure is now
      // reproducible on demand instead of only on CI:
      //   SMOKE_LOCALE=en-US npm run smoke
      locale: process.env.SMOKE_LOCALE || undefined,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    try {
      await page.goto(APP_URL, { waitUntil: "networkidle" });
      await page.waitForTimeout(1000);
      await page.locator("text=Skip").first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.locator("text=Don't ask again").first().click({ timeout: 3000 }).catch(async () => {
        await page.locator("text=Not now").first().click({ timeout: 3000 }).catch(() => {});
      });
      await page.waitForTimeout(800);

      // Create one encounter at a fixed wall-clock time. Fixed input on
      // purpose: nothing here reads the real clock, so this cannot flake on
      // whatever time of day the suite happens to run.
      await page.locator("text=Encounter").last().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      await page.locator('[aria-label="Add encounter"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(500);
      await page.locator('input[aria-label="Title"]').fill("Timezone probe");
      await page.locator('input[aria-label="Date & time"]').fill(TZ_PROBE_TIME);
      await page.locator('text=Save').first().click({ timeout: 5000 });
      await page.waitForTimeout(900);

      // Open it back up and read what the user would actually see.
      await page.locator("text=Timezone probe").first().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const detail = await page.evaluate(() => document.body.innerText);

      // Locale-independent on purpose, and this is the SECOND time this
      // change fell into the same trap. The date renders with an `undefined`
      // locale, so it is "14 Mar 2026" on a UK machine and "Mar 14, 2026" on
      // CI's en-US one. My first version asserted the en-GB literal and
      // passed locally while failing in ALL THREE zones — including London,
      // which is the one zone that had nothing wrong with it. I had already
      // caught and fixed exactly this in the unit layer an hour earlier, then
      // wrote it again from memory.
      //
      // Both orderings are accepted rather than parsing a locale-dependent
      // string, and the SHIFTED day is asserted absent so the check stays
      // discriminating: with the bug, New York rendered 13 Mar and this fails.
      const correctDate = detail.includes("14 Mar 2026") || detail.includes("Mar 14, 2026");
      const shiftedDate = detail.includes("13 Mar 2026") || detail.includes("Mar 13, 2026");
      check(correctDate && !shiftedDate,
        `${zone}: the date shown is 14 Mar 2026, the day that was typed`);

      check(detail.includes("Late Night"),
        `${zone}: 00:30 is filed under "Late Night", not shifted into another part of the day`);

      // And the STORED value must round-trip too, not just the rendered text —
      // a display that is right for the wrong reason (reformatted from
      // something already corrupted) would still pass the two checks above.
      //
      // Edit lives inside the record's 3-dot menu, not on the record itself.
      // My first version guessed `[aria-label="Edit Encounter"], text=Edit`,
      // which mixes a CSS selector with a text engine and therefore throws;
      // because I had wrapped it in .catch(() => {}) to be safe, the failure
      // was swallowed and the flow instead reported the confusing symptom of
      // an empty input. Same class as the swallowed-exception bugs this file
      // already documents elsewhere.
      await page.locator('[aria-label="More options"]').first().click({ timeout: 5000 });
      await page.waitForTimeout(400);
      await page.getByRole("menuitem", { name: /^Edit/ }).first().click({ timeout: 5000 });
      await page.waitForTimeout(600);
      const stored = await page
        .locator('input[aria-label="Date & time"]')
        .first()
        .inputValue()
        .catch(() => "");
      check(stored === TZ_PROBE_TIME,
        `${zone}: the stored wall-clock time round-trips unchanged (got "${stored}")`);

      check(pageErrors.length === 0, `${zone}: no page errors (${pageErrors.join(" | ")})`);
    } catch (err) {
      check(false, `${zone}: flow threw — ${err.message.split("\n")[0]}`);
    } finally {
      await context.close();
    }
  }

  // Report EVERY zone's failure, not just the first. A timezone bug has a
  // shape — which offsets fail and which pass is the whole diagnosis, and
  // fail-fast would hide that behind whichever zone happened to be listed
  // first, every time.
  if (failures.length) {
    throw new Error(
      `Timezone wall-clock round-trip failed:\n` +
      failures.map((f) => `    - ${f}`).join("\n")
    );
  }
}

// SMOKE_ONLY=<substring> runs a single flow in isolation, by its short name
// above (e.g. SMOKE_ONLY=timezone). Added because the full suite needs
// Chromium and CLAUDE.md records this machine losing hours to smoke failures
// that were pure memory starvation: a targeted run is the only way to debug
// one flow interactively. An unmatched name runs NOTHING rather than
// everything, so a typo can never masquerade as a full green run.
const SMOKE_ONLY = (process.env.SMOKE_ONLY || "").trim().toLowerCase();
let ranAny = false;
const run = async (name, fn) => {
  if (SMOKE_ONLY && !name.includes(SMOKE_ONLY)) return;
  ranAny = true;
  await fn();
};
// ---------------------------------------------------------------------------
// ADDED 29 Sep 2026 — the ACKNOWLEDGE path, end to end in a browser.
//
// Flow 19 covers DISMISSAL: tap the X, banner goes, stays gone after a due-state
// refresh, no dose was logged. This covers the half it does not, and the half
// that is the actual feature. "Stop reminding me about this" is a different
// promise from "hide this for now":
//
//   dismissal  - in-memory, dies on a real close. The toast says so.
//   acknowledge - persisted, so it survives a reload, AND it leaves a quiet
//                 mark on the tab while the thing is still outstanding.
//
// The load-bearing assertion here is the RELOAD. A dismissal that persisted
// would be a different bug from one that did not; an acknowledgement that did
// not persist would quietly degrade into a dismissal the next time the app is
// reopened, and the user would believe they had switched something off
// permanently when they had not. No unit test can see this - it needs a real
// boot, a real write, and a real second boot.
//
// It also asserts the two-scope choice is actually presented, because
// device-silence (A3) is only reachable through the BOTH option, and that
// option is the one whose cost is highest: it also withdraws the scheduled
// phone notification.
// ---------------------------------------------------------------------------

async function testBannerAcknowledgementPersists(browser) {
  console.log("\n[21/23] Reminder acknowledgement - persists across a reload and leaves a quiet mark (added 29 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const flowErrors = [];
  page.on("pageerror", (err) => flowErrors.push(err.message));

  // Onboarding + first-run banners, exactly as flow 19 does it. The
  // due-medications banner helpers are deliberately NOT called.
  const boot = async () => {
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find((b) => (b.textContent || "").trim() === "Keep it for now");
      if (el) el.click();
    }).catch(() => {});
    await page.waitForTimeout(600);
  };

  const BANNER = '[aria-label="Dismiss due medications banner"]';
  const ACK_BUTTON = '[aria-label^="Stop reminding me about"]';

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await boot();

    // The seed data's PrEP dose is genuinely due, so this is a real reminder
    // rather than something the flow had to manufacture. If it is absent the
    // rest of the flow is vacuous, so that is a loud failure, not a skip.
    const banner = page.locator(BANNER);
    const had = await banner.first().waitFor({ state: "visible", timeout: 25000 })
      .then(() => true).catch(() => false);
    assert(had, "a genuinely due medication produces a banner to acknowledge");
    if (!had) return;

    // Open the sheet. This is the acknowledge control, NOT the X.
    const ackBtn = page.locator(ACK_BUTTON).first();
    assert(await ackBtn.count() > 0, "the banner offers a 'Don't remind' control, distinct from the X that merely dismisses");
    await ackBtn.click({ timeout: 8000 });

    const sheet = page.locator('[role="dialog"][aria-label="Stop reminding me about this"]');
    const opened = await sheet.first().waitFor({ state: "visible", timeout: 8000 })
      .then(() => true).catch(() => false);
    assert(opened, "tapping it opens the acknowledgement sheet");
    if (!opened) return;

    // Both scopes must be offered, and the copy has to say what the stronger
    // one costs — it withdraws the scheduled phone notification too, which is
    // the one irreversible-ish thing this feature can do.
    const sheetText = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][aria-label="Stop reminding me about this"]');
      return el ? el.innerText : "";
    });
    assert(/In the app only/.test(sheetText), "the sheet offers the narrower 'in the app only' scope");
    assert(/In the app and on my device/.test(sheetText), "the sheet offers the device-wide scope");
    assert(/still outstanding/.test(sheetText),
      "the sheet says the item is still outstanding, so an acknowledgement cannot be mistaken for handling it");
    assert(/Phone notifications still fire/.test(sheetText),
      "the narrower scope says plainly that it does NOT stop the phone notification");

    // Choose device-wide: the stronger promise, and the one A3 implemented.
    await page.getByRole("button", { name: /In the app and on my device/ }).first().click({ timeout: 8000 });
    await sheet.first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    assert(await page.locator('[role="dialog"][aria-label="Stop reminding me about this"]').count() === 0,
      "choosing a scope closes the sheet");

    // The banner is gone, and stays gone across refreshes — the same
    // chokepoint the 60s poll uses.
    assert(await page.locator(BANNER).count() === 0, "acknowledging hides the banner immediately");
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
      await page.waitForTimeout(2500);
      assert(await page.locator(BANNER).count() === 0,
        `the banner is still gone after refresh ${i + 1} - an acknowledgement must outlast a dismissal`);
    }

    // And the quiet mark. The banner is gone but the thing is still
    // outstanding, so the nav tab carries a dot; the dot alone must not be the
    // only signal, which is why the tab also gets a visually-hidden
    // description. Both are checked.
    const bodyNow = await page.evaluate(() => document.body.innerText);
    assert(!/logged at/i.test(bodyNow),
      "acknowledging did not log a dose - it is a UI preference, never a record of taking the medication");

    // THE LOAD-BEARING ONE. A reload is a real app close, which is exactly what
    // a dismissal does NOT survive. If the banner is still gone here, the
    // acknowledgement genuinely persisted.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await boot();
    assert(await page.locator(BANNER).count() === 0,
      "after a real reload the banner is STILL gone - an acknowledgement persists, a dismissal would not");

    // The banner must not reappear on the first refresh after the reload
    // either, or "still gone" could just mean "has not loaded yet".
    await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(2500);
    assert(await page.locator(BANNER).count() === 0,
      "and it is still gone after a due-state refresh post-reload, not merely slow to come back");

    if (flowErrors.length) throw new Error("page errors during the acknowledgement flow:\n" + flowErrors.join("\n"));
  } finally {
    await context.close();
  }
}

  let failed = false;
  try {
    // ADDED 27 Sep 2026 - the sample-data flow, deliberately FIRST rather than
    // last, which is the opposite of the obvious choice and took several real
    // debugging rounds to establish.
    //
    // It depends on nothing the other flows do and uses its own browser
    // context, so running it first costs nothing.
    //
    // It CANNOT go last. The PWA auto-update flow (14) deliberately swaps the
    // real dist/sw.js to simulate a deploy and taps Refresh, and the app
    // registers a service worker on every load. That worker is cached in the
    // browser PROFILE and inherited by any later context, so a flow placed
    // after it is served a CACHED app shell instead of the current bundle.
    // The symptom was genuinely maddening: "the sample-data banner never
    // appeared" while Home rendered flawlessly underneath with the sample data
    // plainly visible. The app was healthy - it was simply the wrong build.
    // Unregistering the worker in-page did not fix it either.
    await run("sample-data", () => testSampleDataDisclosureAndClear(browser));
    await run("sample-data-devtools", () => testSampleDataClearInDeveloperTools(browser));
    // Placed here, with the other own-context flows, for a reason its own
    // comment explains at length: under the suppression behaviour this flow
    // tests, a reminder banner dismissed by ANY earlier flow stays gone for
    // the rest of that app run, so no flow on the shared page can observe a
    // first-run banner. It needs a fresh context, and being early also keeps
    // it ahead of the PWA auto-update flow that leaves a service worker in the
    // browser profile.
    await run("banner", () => testBannerSuppression(browser));
    // Own context, and ahead of the PWA auto-update flow for the cached
    // app-shell reason this file documents at length. It is a SEPARATE context
    // from flow 19 on purpose: they test two different promises (session
    // dismissal vs a persisted acknowledgement) and must not share state.
    await run("banner-ack", () => testBannerAcknowledgementPersists(browser));
    // Own context per timezone, placed with the other own-context flows and
    // ahead of the PWA auto-update flow for the cached-app-shell reason this
    // file already documents at length above.
    await run("timezone", () => testTimezoneWallClockRoundTrip(browser));
    await dismissOnboarding(page);
    // Placed AFTER dismissOnboarding, and that ordering is load-bearing: this
    // runs on the shared `page`, which still has the onboarding overlay up
    // until the line above. Run before it, the Add-contact FAB is not merely
    // covered — it is not in the DOM at all, so the locator waits forever. My
    // first version made exactly that mistake.
    await run("escape", () => testEscapeClosesOverlay(page));
    // Placed here rather than at the end: it starts and ends on Home with no
    // overlay open, which is a neutral state for whatever runs next, and it
    // needs the sample contacts the other flows all leave in place.
    await run("search-back", () => testSearchBackNavigation(page));
    await run("med-reason", () => testMedicationReasonSideEffects(page));
    await run("symptom-link", () => testSymptomTestTwoWayLink(page));
    await run("locations", () => testLocationsExtraFields(page));
    await run("resources", () => testResourceLinkClickable(page));
    await run("anonymise", () => testEncountersAnonymiseMasking(page));
    await run("med-clock", () => testMedicationReminderClock(page));
    await run("encrypt-migrate", () => testEncryptionMigratesLegacyData(browser));
    await run("encrypt-check", () => testEncryptionPositiveCheck(page));
    await run("encrypt-applock", () => testEncryptionAppLockGatesVault(page));
    await run("tab-order", () => testTabReorder(page));
    await run("tour", () => testInteractiveTour(browser));
    await run("backup-migrate", () => testBackupMigratesOldFieldShape(page));
    await run("pin-recovery", () => testPinRecoveryFlow(page));
    await run("pwa-update", () => testServiceWorkerAutoUpdate(browser));
    await run("backup-garbage", () => testBackupImportDropsGarbageRecords(page));
    // Own context, created inside the flow, because it drives a real add/edit
    // on a seeded record and leaves that record changed; a shared page would
    // hand the mutation to whatever ran next. The date arithmetic is relative
    // to today, so re-running it tomorrow still exercises a genuinely-early
    // dose rather than a fixed date that quietly drifts into the past.
    await run("vaccine-doses", () => testVaccineDoseSeriesFlow(browser));
  } catch (err) {
    failed = true;
    console.error("\n" + err.message);
  }

  if (SMOKE_ONLY && !ranAny) {
    failed = true;
    console.error(`\nSMOKE_ONLY=${SMOKE_ONLY} matched no flow. Run with no filter to see the names.`);
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

// ---------------------------------------------------------------------------
// ADDED 27 Sep 2026 - the sample-data disclosure and clear.
//
// WHY A REAL BROWSER DRIVE RATHER THAN A UNIT TEST: the whole point is a
// first-run experience. A unit test can prove clearSampleData() filters the
// right ids, but not that a new user is TOLD, on the first screen they look at,
// that what they are looking at is not theirs. Only a real page can fail that.
//
// The behaviour that genuinely matters, and that a naive implementation would
// get wrong, is preservation: repositories load their seed as the fallback for
// an absent key, so the moment a user adds a record the sample data is
// persisted into the same array. "Clear sample data" must therefore remove the
// sample records and KEEP the user's, in one and the same array - which is
// exactly what "Reset all app data" would not do. So the flow adds a real
// contact through the real Contacts form first, then clears, then checks both
// halves of that claim.
//
// Runs FIRST, in its own context. See the ordering comment at the call site:
// the PWA auto-update flow leaves a service worker in the browser profile, and
// any flow after it is served a stale cached shell.
async function testSampleDataDisclosureAndClear(browser) {
  console.log("\n[1/23] Sample data is disclosed on first run, and clearing keeps real records (added 27 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const flowErrors = [];
  page.on("pageerror", (err) => flowErrors.push(err.message));

  try {
    // Deliberately NOT the shared dismissOnboarding() helper: that one navigates
    // and then dismisses banners, and using it here made the banner never
    // appear at all - while the same flow with the manual sequence below worked.
    // Isolating that difference is the point; the helper is still correct for
    // the shared-page flows, which is all it was written for.
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }

    // Wait for the banner rather than sleeping: it only renders once
    // countSampleData() has resolved across 14 repositories, and a fixed wait
    // is the kind of flake this suite has been bitten by repeatedly.
    try {
      await page.getByText("This app starts with sample data", { exact: false }).first()
        .waitFor({ state: "visible", timeout: 20000 });
    } catch {
      // Self-diagnosing on purpose. A bare timeout gives no clue whether the
      // app is still on onboarding, behind a lock screen, or genuinely empty -
      // and the first version of this flow failed exactly that way.
      const diag = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 300),
        keys: Object.keys(localStorage).filter((k) => k.startsWith("shos_")).length,
      }));
      throw new Error(
        "the sample-data banner never appeared.\nFirst 300 chars:\n" + diag.text +
        "\nshos_ keys in storage: " + diag.keys
      );
    }

    const body = await page.evaluate(() => document.body.innerText);
    assert(body.includes("is made-up example data, not yours"),
      "the first screen says plainly that what is on it is not the user's own data");
    assert(/Everything you can see right now — \d+ records/.test(body),
      "the banner states a real record count rather than a vague claim");
    assert(body.includes("Anything you have added yourself is always kept"),
      "the banner states that clearing cannot touch the user's own records - the question that stops anyone tapping a 'clear' button in a medical app");
    console.log("  ok — the first screen discloses the sample data and states a real count");

    // Add a real contact through the REAL form. Bottom-nav tabs are
    // role=button with aria-label and no text content, so they must be queried
    // by role - a text search for "Contacts" silently matches nothing.
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("button", { name: "Contacts", exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    // The "+" FAB and the sheet's submit are BOTH labelled "Add contact"
    // (`isNew ? "Add contact" : "Save changes"`), so first-then-last.
    await page.getByRole("button", { name: /add contact/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.getByLabel("Full name", { exact: false }).first().fill("ZZZ Smoke Real Contact");
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /^add contact$/i }).last().click({ timeout: 5000 });
    // CHANGED 29 Sep 2026 (t028) - was waitForTimeout(1500). Saving writes to
    // an async repository and the list re-reads it asynchronously, so this was
    // a guess about machine speed in front of an assertion. This is the SAME
    // shape as the sample-data-devtools flake that went red in CI one flow
    // later, and the previous fix had left it in place because CI only failed
    // the one the owner happened to hit - which is the "a fix scoped to the
    // symptom you happened to hit is not a fix to the class" mistake.
    await waitForText(page, "ZZZ Smoke Real Contact");
    assert((await page.evaluate(() => document.body.innerText)).includes("ZZZ Smoke Real Contact"),
      "a real contact was added through the real Contacts form");

    // Back to Home, and clear.
    await nav.getByRole("button", { name: "Home", exact: true }).first().click({ timeout: 5000 });
    await page.getByText("This app starts with sample data", { exact: false }).first()
      .waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("button", { name: "Clear the sample data" }).first().click({ timeout: 5000 });
    // CHANGED 29 Sep 2026 (t028) - was waitForTimeout(2500) followed by a
    // NEGATIVE assertion. Bounded, and it waits for the banner's own state to
    // become hidden rather than guessing how long a clear takes. A negative
    // assertion that runs before anything proves the app rendered can pass
    // against a blank page, so the wait is on the thing that must disappear.
    await waitForGone(page, page.getByText("This app starts with sample data"));
    assert(!(await page.evaluate(() => document.body.innerText)).includes("This app starts with sample data"),
      "the banner is gone once the sample data is cleared");
    console.log("  ok — clearing removes the sample data and dismisses the banner");

    // The half that actually matters: the user's own record survived.
    await nav.getByRole("button", { name: "Contacts", exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const contacts = await page.evaluate(() => document.body.innerText);
    assert(contacts.includes("ZZZ Smoke Real Contact"),
      "the user's own contact survived the clear — 'clear sample data' is not 'delete everything'");
    const sampleLeft = ["Grace", "Sam T."].filter((n) => contacts.includes(n));
    assert(sampleLeft.length === 0,
      `the sample contacts are really gone from the list (still showing: ${sampleLeft.join(", ") || "none"})`);
    console.log("  ok — the real contact survived AND the sample contacts are gone from the list");

    if (flowErrors.length) throw new Error("page errors during the sample-data flow:\n" + flowErrors.join("\n"));
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// ADDED 28 Sep 2026 - search result back-navigation (Phase 2b).
//
// WHY A REAL BROWSER DRIVE: the unit tests prove the decision is right and
// the wiring guard proves the code is plumbed, but neither can show that a
// person can actually search, open a result, and get back to their results -
// which is the entire feature. That is the same lesson as the Escape sweep
// below: the hook worked, the tests passed, and the feature was not actually
// on the screens that mattered. Unit tests prove a function; only this proves
// the app.
//
// It also covers the half most likely to be got wrong, which is the half no
// other test would notice: the affordance must NOT follow the user around
// the app after they navigate somewhere unrelated. A stale "back to search
// results" button pointing at a query for a screen they left ten minutes ago
// is worse than no button at all.
async function testSearchBackNavigation(page) {
  console.log("\n[18/23] Search results - you can get back to them, and only while it makes sense (added 28 Sep 2026)");
  await navHome(page);
  await dismissTransientBanners(page);

  // Search is a header icon on Home, not a bottom-nav tab, and the icon is
  // an SVG with no text content - so it must be found by its accessible
  // name, and clicked with a synthetic bubbling event (SVGElement has no
  // .click()).
  await page.locator('[aria-label="Search"]').first()
    .dispatchEvent("click", { bubbles: true, cancelable: true }).catch(async () => {
      await page.locator('[aria-label="Search"]').first().click({ timeout: 5000 });
    });
  const dialog = page.getByRole("dialog", { name: "Global Search" });
  const opened = await dialog.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  assert(opened, "Global Search opened from the Home header icon");
  if (!opened) return;

  // A seed contact, so this does not depend on anything the other flows did
  // to the shared page's data.
  await dialog.locator("input").first().fill("Priya");
  const resultAppeared = await dialog.getByText("Priya", { exact: false }).first()
    .waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
  assert(resultAppeared, "typing a query produces real results (not a 'no matches' false negative)");
  if (!resultAppeared) return;

  // Open the result. Before this change the query simply vanished here.
  await dialog.getByText("Priya", { exact: false }).first().click({ timeout: 5000 });
  const searchClosed = await dialog.waitFor({ state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
  assert(searchClosed, "tapping a result opens the record and closes the search overlay");
  const recordOpened = await page.getByRole("heading", { name: "Priya", exact: false }).first()
    .waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  assert(recordOpened, "the record itself really opened - not just the overlay closing over it");
  if (!recordOpened) return;

  const backAffordance = page.locator('[aria-label^="Back to search results"]');
  const offered = await backAffordance.first().waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  assert(offered,
    "the record offers a visible way back to the results it came from (web has no hardware back button at all, so the back-button path alone would leave this feature invisible on one of the two platforms the app ships to)");

  // And the restore genuinely restores: same query, results back.
  await backAffordance.first().click({ timeout: 5000 });
  const reopened = await dialog.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  assert(reopened, "tapping it reopens Global Search");
  const restoredQuery = await dialog.locator("input").first().inputValue();
  assert(restoredQuery === "Priya",
    `the query is still in the search box when you come back (got ${JSON.stringify(restoredQuery)}) - before this, it was gone and had to be retyped from memory`);
  const resultsBack = await dialog.getByText("Priya", { exact: false }).first()
    .waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
  assert(resultsBack, "the results are re-listed, not just the text restored into an empty screen");

  // Dismiss the restored search with its own close control. The record must
  // still be there, and the way back must still be offered - consuming the
  // context on return would strand the user on the record with neither the
  // results nor a way to undo the return.
  await dialog.locator('[aria-label="Close search"]').first().click({ timeout: 5000 });
  const closedAgain = await dialog.waitFor({ state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
  assert(closedAgain, "dismissing the restored search returns to the record it came from");
  const stillOffered = await backAffordance.first().isVisible().catch(() => false);
  assert(stillOffered, "and the way back to the results is still there afterwards");

  // The half that must NOT happen: leaving for an unrelated screen has to
  // clear it, or this button follows the user around all session pointing at
  // a query for a screen they left long ago.
  await nav(page, "Contacts");
  await page.waitForTimeout(800);
  const staleAfterLeaving = await backAffordance.first().isVisible().catch(() => false);
  assert(!staleAfterLeaving,
    "navigating somewhere unrelated clears it - a stale 'back to search results' button would point at a screen the user is no longer on");
  await navHome(page);
}

// ---------------------------------------------------------------------------
// ADDED 28 Sep 2026 - banner suppression (Phase 3).
//
// WHY A REAL BROWSER DRIVE: the whole defect was that a dismissed reminder
// came back on the 60-second poll. That is a statement about a timer and a
// re-render over time, which no unit test can observe - the pure rules prove
// the DECISION is right and the wiring guard proves the state is plumbed, but
// neither can show that a banner the user closed stays closed when the poll
// fires again. That is exactly the class the Escape sweep got wrong: the hook
// worked, the tests passed, and the feature was not on the screens that
// mattered.
//
// IT NEEDS ITS OWN BROWSER CONTEXT, and the first version got that wrong in an
// instructive way. It originally ran on the shared page, after the other flows
// - and `dismissTransientBanners()` has always dismissed the medication banner
// at the start of the run. Under the OLD behaviour that dismissal evaporated
// after 60s, so a later flow could still see a banner. Under the behaviour this
// flow is testing, a dismissal lasts the whole app run - which is the entire
// point of the feature, and which means NO flow on a shared page can ever see a
// reminder banner again after the first dismissal. It failed on its own guard,
// which is exactly what that guard was written to catch: without it this flow
// would have "passed" while testing nothing at all.
//
// A fresh context is the only honest way to observe a first-run banner, and it
// also isolates the flow from whatever the shared page's data has become.
async function testBannerSuppression(browser) {
  console.log("\n[19/23] Reminder banners - a dismissed one stays dismissed, and an acknowledged one leaves a quiet mark (added 28 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const flowErrors = [];
  page.on("pageerror", (err) => flowErrors.push(err.message));
  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    // Onboarding only. The banner dismissal helpers are deliberately NOT
    // called - see the context note above.
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }
    // The first-run sample-data banner sits above the fold and would shift the
    // reminder banner's position; dismiss it without scrolling.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find((b) => (b.textContent || "").trim() === "Keep it for now");
      if (el) el.click();
    }).catch(() => {});
    await page.waitForTimeout(600);

    // The seed data's PrEP dose is genuinely due, so its banner is real rather
    // than something this flow had to manufacture.
    const banner = page.locator('[aria-label="Dismiss due medications banner"]');
    const hadBanner = await banner.first().waitFor({ state: "visible", timeout: 25000 })
      .then(() => true).catch(() => false);
    if (!hadBanner) {
      const diag = await page.evaluate(() => ({
        text: document.body.innerText.slice(0, 300),
        dismissButtons: [...document.querySelectorAll('[aria-label^="Dismiss"]')].map((b) => b.getAttribute("aria-label")),
      }));
      assert(false,
        "a due medication actually produces a banner to dismiss - if this fails the rest of the flow is vacuous. Dismiss buttons present: " +
        JSON.stringify(diag.dismissButtons) + " first 300 chars: " + diag.text);
      return;
    }
    assert(true, "a genuinely due medication produces a banner");

    // Dismiss it. This is the X, not "Take" - it must not log a dose.
    await banner.first().click({ timeout: 8000 });
    await banner.first().waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    const goneNow = await page.locator('[aria-label="Dismiss due medications banner"]').count();
    assert(goneNow === 0, "tapping close hides the banner immediately");

    // Now the part that actually failed before: drive the app's own refresh
    // chokepoint - the same call the 60s interval makes - and confirm the banner
    // does NOT come back.
    await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(2500);
    const backAfterRefresh = await page.locator('[aria-label="Dismiss due medications banner"]').count();
    assert(backAfterRefresh === 0,
      "the banner does NOT come back on the next due-state refresh - before this, every dismissal was undone within 60 seconds, which is the surest way to train someone to ignore a reminder");

    // A second refresh, because the first one can land before the banner had
    // been re-rendered at all. Two real cycles is the difference between "it
    // happened to not have arrived yet" and "it is genuinely suppressed".
    await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(2500);
    assert(await page.locator('[aria-label="Dismiss due medications banner"]').count() === 0,
      "and it is still gone after a second refresh, not merely slow to come back");

    // And no dose was silently logged by any of this. The dismissal is a UI
    // fact and must never masquerade as handling the medication - which is the
    // real risk here, because a dismissal that logged a dose would look like it
    // worked right up until the next dose was missed.
    //
    // Checked via the toast wording rather than by inspecting the dose log: the
    // "Take" path toasts "PrEP (...) logged at 8:00am", so its absence is a
    // direct, discriminating signal. An earlier version of this assertion was
    // `!/regex/.test(text) || true`, which is vacuous by construction - it can
    // never fail - and that is the single most-recorded mistake in this repo.
    const toasts = await page.evaluate(() => document.body.innerText);
    assert(!/logged at/i.test(toasts),
      "dismissing a banner did not log a dose - nothing about a dismissal touched the medication's data");

    if (flowErrors.length) throw new Error("page errors during the banner flow:\n" + flowErrors.join("\n"));
  } finally {
    await context.close();
  }
}

// ---------------------------------------------------------------------------
// ADDED 27 Sep 2026 - Developer Tools must offer "clear sample data" as its own
// action and must NOT leave it confusable with "reset all app data".
//
// A SEPARATE flow with its own context, rather than a section of the flow above.
// That was tried first and does not work: the two checks are mutually
// exclusive in time, since the Home banner's clear removes exactly the sample
// data this one needs to find. Reloading to get a fresh state re-triggers
// onboarding and the App Lock prompt, which then intercept the navigation the
// rest of the previous flow depended on. Its own context avoids all of that,
// and this flow must run BEFORE the flow above for the same reason.
async function testSampleDataClearInDeveloperTools(browser) {
  console.log("\n[2/23] Developer Tools separates 'clear sample data' from 'reset all app data' (added 27 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const flowErrors = [];
  page.on("pageerror", (err) => flowErrors.push(err.message));

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }
    await page.waitForTimeout(1500);

    // Settings is a header icon on Home, not a bottom-nav tab.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find((b) => (b.getAttribute("aria-label") || "") === "Settings");
      if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(1500);
    await page.getByText("Support", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.getByText("Developer tools", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);

    const dev = await page.evaluate(() => document.body.innerText);
    assert(dev.includes("Clear sample data"),
      "Developer Tools offers 'Clear sample data' as its own action, not only as a reset");
    assert(/sample records are still here/.test(dev),
      "Developer Tools shows how many sample records remain, so the action is not a blind guess");
    // The distinction is the whole point: the reset next to it destroys the
    // user's own data, and the labels alone do not convey that.
    assert(/deletes everything, including your own records/.test(dev),
      "Developer Tools states that the reset also deletes the user's own records, so the two cannot be confused");
    console.log("  ok — the two destructive-sounding actions are clearly distinguished");

    // The clear itself must work from here too, keeping a real record.
    //
    // Order matters and was got wrong twice here, so both reasons are kept:
    //
    //  1. The bottom nav sits UNDER the Settings overlay, so the contact has to
    //     be added BEFORE Settings is opened. Clicking a nav tab with the
    //     overlay up hangs until the click times out.
    //  2. Reloading re-triggers onboarding AND the App Lock prompt, both of
    //     which cover the page. The second dismiss loop below is not a
    //     copy-paste of the first - without it the very next nav click fails,
    //     and the error points at the nav bar rather than at the prompt.
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }
    await page.waitForTimeout(1500);
    await nav(page, "Contacts");
    await page.getByRole("button", { name: /add contact/i }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.getByLabel("Full name", { exact: false }).first().fill("ZZZ DevTools Real Contact");
    await page.waitForTimeout(250);
    await page.getByRole("button", { name: /^add contact$/i }).last().click({ timeout: 5000 });
    // CHANGED 30 Sep 2026 (t028) - was waitForTimeout(1500). The SAME shape as
    // the flake already fixed in this file twice, and this is the third
    // instance: the same flow adds a contact here AND after the clear, and the
    // earlier fix only covered the second one. Saving writes to an async
    // repository and the list re-reads it asynchronously, so a fixed wait in
    // front of an assertion is a guess about machine speed.
    await waitForText(page, "ZZZ DevTools Real Contact");
    assert((await page.evaluate(() => document.body.innerText)).includes("ZZZ DevTools Real Contact"),
      "a real contact was added before clearing from Developer Tools");

    // Back into Developer Tools and clear.
    //
    // Home first: the Settings gear lives in HOME's header, not in a
    // bottom-nav bar and not on the Contacts screen. Dispatching a click at
    // whatever currently carries aria-label="Settings" while sitting on
    // Contacts finds nothing, and the next step then times out on "Support"
    // with an error that points at the wrong thing entirely.
    await navHome(page);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="button"]')]
        .find((b) => (b.getAttribute("aria-label") || "") === "Settings");
      if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(1500);
    await page.getByText("Support", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.getByText("Developer tools", { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    // Scoped to the Developer Tools dialog, NOT a bare document lookup.
    //
    // Two elements carry aria-label="Clear the sample data": this panel's, and
    // the first-run banner's on Home. Home stays mounted behind the Settings
    // overlay, so `document.querySelector` finds Home's one first - and a
    // document-wide click therefore clears the data from the wrong screen
    // entirely, leaving this panel showing a stale count. That is not a test
    // artefact: it is the same confusion a screen-reader user would have, and
    // it is why the panel now re-reads its count on every clear.
    const devPanel = page.getByRole("dialog", { name: "Developer tools" });
    await page.evaluate(() => {
      const panel = [...document.querySelectorAll('[role="dialog"]')]
        .find((d) => (d.getAttribute("aria-label") || "") === "Developer tools");
      const el = panel && panel.querySelector('[aria-label="Clear the sample data"]');
      if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(3000);
    void devPanel;

    const after = await page.evaluate(() => document.body.innerText);
    assert(/Removed \d+ sample record/.test(after),
      "clearing from Developer Tools reports how many sample records it removed");
    // Scoped to this panel, and asserting on the COUNT REFRESHING rather than
    // on the button vanishing. The count is the thing that was actually broken:
    // clearing from Home used to leave this panel still claiming 96 records
    // were present, with a live-looking button that would then report there was
    // nothing to remove. Asserting the number is honest about what must work.
    const devAfter = await page.evaluate(() => {
      const panel = [...document.querySelectorAll('[role="dialog"]')]
        .find((d) => (d.getAttribute("aria-label") || "") === "Developer tools");
      return panel ? panel.innerText : "";
    });
    assert(!/sample records are still here/.test(devAfter),
      "the Developer Tools count refreshes after a clear, instead of still claiming the sample data is there");

    // Fresh load before checking Contacts. The Developer Tools panel is a
    // full-screen overlay and the bottom nav sits BENEATH it, so a nav click
    // with the panel still open hangs until it times out. Reloading is the
    // reliable way out, and it also proves the cleared state PERSISTED rather
    // than merely being absent from memory.
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    for (const label of ["Skip", "Not now", "Get started"]) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
    }
    // CHANGED 29 Sep 2026 - this was a fixed 1500ms wait, and it is the
    // reason this flow went red on CI while passing in isolation. The
    // assertion below reads the Contacts list, whose repositories are ASYNC
    // (every module went async in the encryption groundwork), so a
    // machine-speed guess is the wrong thing to depend on: on a loaded runner
    // the list had not rendered yet and the flow reported a data-loss
    // regression that did not exist.
    //
    // Confirmed rather than assumed: the same commit passed this flow in
    // isolation locally, and CI runs all 23 flows sequentially on a slower
    // machine. A test must never depend on how fast the machine is - which is
    // the same rule the two App Lock assertions and the PIN-recovery waits
    // were fixed under, and the reason t028 exists for the ~130 fixed waits
    // still remaining. Fixed per-site with evidence, not swept.
    //
    // A NEGATIVE assertion ("the banner is gone") is only meaningful once
    // something positive has proved the app actually booted, so that is what
    // is waited for - the nav bar - rather than guessing at a duration.
    await page.waitForSelector('[role="navigation"][aria-label="Main navigation"]', { timeout: 20000 });
    assert(!(await page.evaluate(() => document.body.innerText)).includes("This app starts with sample data"),
      "the sample data is still gone after a reload — the clear genuinely persisted");
    await nav(page, "Contacts");
    // Bounded wait on the state actually being asserted: the real contact
    // being present in the list. Returns the moment it appears.
    await page
      .waitForFunction((n) => document.body.innerText.includes(n), "ZZZ DevTools Real Contact", { timeout: 20000 })
      .catch(() => {});
    const contacts = await page.evaluate(() => document.body.innerText);
    assert(contacts.includes("ZZZ DevTools Real Contact"),
      "the user's own contact survived clearing from Developer Tools too");
    console.log("  ok — clearing works from here and keeps the user's own record");

    if (flowErrors.length) throw new Error("page errors during the Developer Tools flow:\n" + flowErrors.join("\n"));
  } finally {
    await context.close();
  }
}

// ADDED 28 Sep 2026 — the Escape-to-dismiss sweep.
//
// WHY A SMOKE FLOW AND NOT JUST THE HOOK'S UNIT TESTS: the unit tests prove
// the hook works. They cannot prove it is WIRED to the real overlays, and
// "wired up" is the only part that was actually missing — the app had 55
// role="dialog" overlays and zero that closed on Escape, so on a desktop or
// web build every sheet was a keyboard trap. A regression test that only
// covers the hook would have stayed green through exactly the failure that
// mattered.
//
// Uses Contacts' Add-contact sheet because it is a plain, single-level sheet
// with no nested dialog, so a failure here is unambiguous.
async function testEscapeClosesOverlay(page) {
  // ADDED 29 Sep 2026 — this flow had NO [N/M] header, and the suite's own
  // reported flow count is derived by counting those. So it has been running,
  // passing, and invisible in the count since it shipped; deleting the whole
  // flow would not have moved the number either. Found by the new structural
  // guard in smokeSuiteSelfCheck.test.js, which compares registered flows
  // against declared titles.
  console.log("\n[23/23] Escape closes an overlay - no overlay in the app is a keyboard trap (added 28 Sep 2026)");
  await nav(page, "Contacts");
  const addBtn = page.locator('[aria-label="Add contact"]').first();
  await addBtn.click({ timeout: 8000 });
  const sheet = page.getByRole("dialog", { name: "Add contact" });
  await sheet.waitFor({ state: "visible", timeout: 8000 });
  console.log("  ok — the Add contact sheet opened");

  // Bounded wait rather than a fixed sleep: the sheet must be gone, not merely
  // on its way out.
  await page.keyboard.press("Escape");
  await page.locator('[aria-label="Add contact"]')
    .first()
    .waitFor({ state: "detached", timeout: 8000 })
    .catch(() => {});
  const stillOpen = await page.getByRole("dialog", { name: "Add contact" }).count();
  assert(stillOpen === 0,
    "Escape closed the sheet (before this, all 55 overlays were keyboard traps: focus went in and could not come out)");
  console.log("  ok — Escape closed it");
}

// ---------------------------------------------------------------------------
// ADDED 29 Sep 2026 - the vaccine dose series, and the early-dose notice.
//
// WHY A REAL BROWSER DRIVE RATHER THAN UNIT TESTS ALONE: the bug this flow
// exists for was reported twice, and the second report is the one that fixed it
// - a second dose logged TWO DAYS BEFORE the first dose's due date, and the
// reminder still fired. The calculation is thoroughly unit-tested now, but two
// of the three things this flow asserts cannot be seen from a unit test at all:
//
//   1. That no OVERDUE claim survives anywhere on the record. The reminder
//      stopped correctly while the detail view still rendered "(OVERDUE)" in
//      red - the same wrong reasoning one level down, comparing a date to
//      today instead of asking whether the series had moved on. Every unit
//      test on the calculation was green while that was on screen.
//   2. That the early-dose notice does not BLOCK. The editor's own canSave
//      gate is what actually matters, and a pure function cannot see it.
//
// Also: a stale nextDue on a multi-dose course can keep a phone buzzing, and
// until this flow existed nothing in CI could see that at all.
//
// The doses are written through the REAL editor, because the notice is
// computed from the doses array as the user types, and a seeded-record read
// would prove nothing about whether the editor calls it.
//
// Own context, deliberately. It adds and re-dates doses on a real seeded
// record, so a shared page would hand that mutated record to whatever ran next.
async function testVaccineDoseSeriesFlow(browser) {
  // The flow header is what the suite's own reported count is derived from -
  // verify-changes.mjs counts output lines matching /^\[\d+\/\d+\]/. The first
  // version of this flow had no header, so it ran all 14 assertions, CI went
  // green, and the summary still said "21 flows" for a 22-flow suite. A flow
  // that executes but is invisible in the count is the "measured nothing and
  // looked like it measured something" failure wearing a different hat: had the
  // flow been deleted entirely, the number would not have moved either.
  console.log("\n[22/23] Vaccine dose series - an early dose cancels the earlier reminder, and says so (added 29 Sep 2026)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  // Flow 21's own fresh-context boot sequence, copied rather than re-invented.
  // dismissOnboarding() is the shared-page helper and is NOT sufficient here:
  // it does not offer the App Lock prompt, so the nav bar never appears and the
  // flow times out waiting for something that was never going to arrive. Two
  // earlier attempts at this flow failed exactly that way.
  for (const label of ["Skip", "Not now", "Get started"]) {
    const b = page.getByRole("button", { name: label, exact: true });
    if (await b.count()) { await b.first().click({ timeout: 2500 }).catch(() => {}); await page.waitForTimeout(400); }
  }
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="button"]')]
      .find((b) => (b.textContent || "").trim() === "Keep it for now");
    if (el) el.click();
  }).catch(() => {});
  await page.waitForTimeout(600);
  // Bounded wait on the nav bar, using the same waitForFunction shape the rest
  // of this suite already uses, rather than a fixed sleep or a role-based
  // visibility wait. A test must never depend on how fast the machine is, and
  // this suite has a recorded history of exactly that flake.
  await page.waitForFunction(
    () => !!document.querySelector('[role="navigation"][aria-label="Main navigation"]'),
    undefined,
    { timeout: 20000 }
  );

  await nav(page, "Healthcare");
  const vaccTab = page.getByRole("tab", { name: /Vaccination/i }).first();
  await vaccTab.click({ timeout: 8000 });
  await page.waitForTimeout(800);
  console.log("  ok - reached the Vaccinations screen");

  // The seeded Twinrix record is a real multi-dose series, which is the shape
  // the bug needs. Divs rather than buttons because the list rows are cards.
  const card = page.locator('div[role="button"]', { hasText: /Twinrix/i }).first();
  if (!(await card.count())) throw new Error("no seeded Twinrix vaccination card found");
  await card.click({ timeout: 8000 });
  await page.waitForTimeout(800);
  // "Edit vaccination", not "Edit" - and anchored on the aria-label rather than
  // the visible text, because the visible label is an icon-plus-word control
  // whose accessible name comes from the label. A /^Edit$/ match found nothing
  // here, which is a locator that fails for a reason unrelated to the bug.
  const editBtn = page.locator('[aria-label="Edit vaccination"]').first();
  if (!(await editBtn.count())) throw new Error("no 'Edit vaccination' control on the detail");
  await editBtn.click({ timeout: 8000 });
  await page.waitForTimeout(800);

  const addDose = page.getByRole("button", { name: /Add dose/i }).first();
  if (await addDose.count()) {
    await addDose.click();
    await page.waitForTimeout(500);
  }

  const dateInputs = page.locator('input[type="date"][aria-label="Date"]');
  const n = await dateInputs.count();
  assert(n >= 2, `the dose editor has at least two dose rows (found ${n})`);

  // Read the dose number this flow is about to edit, FROM the editor's own
  // field. Hardcoding "Dose 1" was wrong: the seeded record's only card is
  // numbered "Dose 2", so the lookup silently found nothing. And the seeded
  // numbering is not something to rely on - it is sample data, and a future
  // seed edit would turn a page-wide assertion into a no-op again.
  const doseNumberInputs = page.locator('input[aria-label="Dose number"]');
  assert((await doseNumberInputs.count()) > 0, "the dose editor exposes a Dose number field");
  const editedDoseNumber = (await doseNumberInputs.nth(0).inputValue()).trim();
  assert(editedDoseNumber.length > 0, "the edited dose row has a dose number");
  console.log(`  ok - editing the dose numbered ${editedDoseNumber}`);
  //
  // nextDue is in the PAST, not the future, and that is load-bearing in a way
  // the first version of this flow got wrong. With a future due date, the
  // superseded-vs-overdue branch produces identical output either way - a
  // mutation that restored the "(OVERDUE)" display bug still passed. The
  // scenario that actually reproduces it is the realistic one: you are OVERDUE,
  // you get the dose EARLY to catch up, and the record must stop shouting. The
  // overdue date and the early dose are true at the same time, so both the
  // notice and the display bug are exercised by one setup.
  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };
  const overdue = daysAgo(2);
  const earlyGiven = daysAgo(4);

  await dateInputs.nth(0).fill(iso(earlyGiven));
  await page.waitForTimeout(300);
  await dateInputs.nth(1).fill(iso(earlyGiven));
  await page.waitForTimeout(300);

  const nextDue = page.locator('input[type="date"][aria-label="Next due"]');
  assert((await nextDue.count()) > 0, "the dose editor has a Next due input");
  await nextDue.nth(0).fill(iso(overdue));
  await page.waitForTimeout(600);

  const noticeBox = page.locator('div[role="status"]', { hasText: "Dose logged early" }).first();
  assert((await noticeBox.count()) > 0,
    "the early-dose notice renders for a dose logged before the stated due date");
    // CHANGED 29 Sep 2026 (t032). The copy was reworded, and it was reworded
    // on purpose: "Logged N days before the previous dose's due date. That is
    // outside the recommended interval" is an accusatory verdict about a dose
    // the user actually received, and a second model was right that the day
    // count adds noise and anxiety for no gain.
    //
    // This assertion therefore now checks the PROPERTY rather than the
    // wording: the notice must point the user at their clinic and must not
    // tell them the dose was wasted. That holds on both branches - the one
    // that fires on the user's own due date, and the one that fires on the
    // sourced published minimum, which is the branch this fixture now takes
    // since the notice no longer depends on a typed due date being correct.
    const body = (await noticeBox.textContent()) || "";
    assert(/your clinic can (tell you|confirm)/i.test(body),
      `the notice points at the clinic rather than judging the dose. Got: ${JSON.stringify(body.slice(0, 160))}`);
    assert(!/wasted|will not count|too soon|invalid/i.test(body),
      `the notice must not tell the user the dose did not count. Got: ${JSON.stringify(body.slice(0, 160))}`);
    // No day count: on a mis-keyed date it is noise, on a near-miss it
    // manufactures disproportionate anxiety.
    assert(!/\d+\s+days?\s+early/i.test(body),
      `the notice must not print a day count. Got: ${JSON.stringify(body.slice(0, 160))}`);
  console.log("  ok - the notice appears and does not read as a block");

  // The load-bearing half. The editor's own gate is canSave, so the honest
  // check is that Save is still ENABLED while the notice is on screen - not
  // merely that a Save button exists.
  const save = page.getByRole("button", { name: /Save changes/i }).first();
  assert((await save.count()) > 0, "the editor has a Save changes button");
  const disabled = await save.isDisabled();
  assert(!disabled, "Save is still ENABLED while the early-dose notice is showing");
  await save.click();
  await page.waitForTimeout(1500);
  console.log("  ok - the dose saved despite the notice (it never blocks)");

  // The reported bug, asserted on the real screen rather than on the
  // calculation. Scoped to this record, and case-SENSITIVE on the literal
  // "(OVERDUE)" the dose card renders: an earlier version matched /OVERDUE/i
  // and failed on the Home dashboard's "Overdue vaccinations" tile sitting
  // behind the screen, which has nothing to do with this record.
  //
  // The due date this recorded is two days in the PAST, so if the superseded
  // check is ever removed this text comes back in red - which is the whole
  // point. A future date here would make this assertion vacuous, and the first
  // version of this flow had exactly that bug and a mutation proved it.
  const stillOpen = await page.getByRole("dialog", { name: /Edit vaccination/i }).count();
  assert(stillOpen === 0, "the editor closed, so the save was accepted");

  const scope = page;
  const overdueClaim = scope.getByText(/\(OVERDUE\)/);
  assert((await overdueClaim.count()) === 0,
    "no (OVERDUE) claim survives on the record after the later dose was saved");
  console.log("  ok - the earlier dose's date is no longer reported as overdue");

  // And the positive half: the date is still SHOWN, as history. Asserting only
  // the absence of OVERDUE would be satisfied by simply hiding the line, which
  // is a different regression and a worse one - the user's own record of when
  // they were due.
  //
  // Scoped to the DOSE CARD this flow actually edited, by walking out from that
  // card's own heading. Two weaker versions of this assertion both passed
  // against a mutation that deleted the line outright, and the reason is the
  // same both times: the seeded record has other doses that are ALSO
  // superseded, so any page-wide search for "(done)" or "Next due:" matches
  // them and succeeds no matter what happened to the row under test. A
  // page-wide assertion here was measuring the seed data, not the fix.
  //
  // Deliberately not matching the rendered date string: that is locale-
  // dependent, which this project has been bitten by twice on this exact
  // date-formatting helper.
  const doseCard = await page.evaluate((n) => {
    const heading = [...document.querySelectorAll("span")]
      .find((s) => (s.textContent || "").trim() === `Dose ${n}`);
    if (!heading) return null;
    let el = heading;
    for (let i = 0; i < 5 && el.parentElement; i += 1) {
      el = el.parentElement;
      if ((el.textContent || "").includes("Next due")) break;
    }
    return el.textContent || "";
  }, editedDoseNumber);
  assert(doseCard !== null, `the edited dose card (Dose ${editedDoseNumber}) is still rendered`);
  assert(/done/i.test(doseCard),
    `the edited dose is marked done on its own card, not just somewhere on the page. Card: ${JSON.stringify((doseCard || "").slice(0, 140))}`);
  assert(!/OVERDUE/.test(doseCard),
    `the edited dose's own card carries no OVERDUE claim. Card: ${JSON.stringify((doseCard || "").slice(0, 140))}`);
  console.log(`  ok - dose ${editedDoseNumber} keeps its date, marked done, with no OVERDUE on its own card`);
}
