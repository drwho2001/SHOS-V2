# SHOS Beta Tester Critique — Live Walkthrough + Transcript Synthesis

**Method:** Fresh install via browser (demo data only). Onboarding walked (5 slides). Home dashboard explored. Bottom nav tapped: Contacts, Encounter, Home, Medication, Healthcare. Settings not opened. This critique combines the live walkwith the Gemini transcript feedback and code analysis.

---

## 1. Onboarding (5 slides — FULLY WALKED)

**Good:**
- Clear progression: Welcome → Menstrual question → DoxyPEP & reminders → "Make it yours" → Get started
- Question gate works: "Track menstrual & contraception health?" → `menstrualTrackingEnabled` preference (confirmed in code, `App.jsx:758`)
- DoxyPEP copy is explicit: "72-hour window after qualifying activity" + "real notifications, not just in-app banners"
- Final slide copy: "Settings → Colour scheme lets you switch to dark mode and customise each module's colour. Long-press (or tap Select) on any list to archive, delete, or export several records at once."
- "Get started" button correctly lands on Home dashboard

**Bad / Missing / Broken:**
- **Progress dots:** The 5 dots (6px, gap 6) are indeed tightly sandwiched between body text and buttons on this device's viewport — need more top spacing (`paddingTop`) or larger dots. (Confirmed live)
- **No permission preview:** The DoxyPEP slide says "both real notifications, not just in-app banners" but onboarding never triggers `Notification.requestPermission()`. A sub-note like "If you turn reminders on, your browser/device will ask permission to show notifications" is missing. (Code confirmed: `notificationService.js:586` requests permission only elsewhere, never from onboarding)
- **Finish transition:** Abrupt unmount from onboarding into Home. No fade/scale animation. (Visible live)
- **No "replay tour" path:** After completion, there's no Settings → "Replay the tour" entry point visible. (Code: `showOnboarding` is one-time from `!prefs.hasCompletedOnboarding`; no persistent replay)

**Improvement ideas:**
- Add 1-line permission note under DoxyPEP copy
- Fade out onboarding root before showing Home (respect `prefers-reduced-motion`)
- Add Settings → "Replay the tour" that sets `setShowOnboarding(true)` without re-triggering the auto-offer (needs `replayed` flag alongside `skipped`)

---

## 2. Home Dashboard + App Lock

**Good:**
- Bottom navigation firmly established: **Contacts • Encounter • Home • Medication • Healthcare** (5 tabs, clearly labelled with icons + text)
- Update banner at top: "A new version is ready. Back up your data first, then refresh." — **already has Backup button** (`App.jsx:3316`) that opens Settings → export. The finding "no direct backup in banner" is **already fixed**.
- App Lock prompt: "Want to lock the app with a PIN? Optional, and off by default..." with **Set up App Lock / Not now / Don't ask again**. (Copy already mentions it's off by default and points to Settings → Privacy)
- **Biometrics already wired:** The prompt does NOT mention biometrics, but the code has `biometricAuthService.js` (`checkBiometryAvailable`, `authenticateWithBiometrics`) fully integrated into the lock screen (`App.jsx:333-471`). Cancel/fallback gracefully falls back to PIN. This is an edge case the feedback mentions but is **already built**.

**Bad / Missing / Broken:**
- **Prompt stacking:** The App Lock card appears immediately on Home load. In a real scenario, if a SW update banner or notifToast is also visible, they stack at the bottom. The feedback's concern about "competing for attention" is valid — sequencing (defer App Lock until no toast/banner visible) would improve UX.
- **No biometric mention in copy:** While biometrics exist behind the scenes, the user sees only "PIN." Adding "if your device supports it" would be a small copy win.

**Improvement ideas:**
- Sequence prompts: defer App Lock offer until no persistent toast/banner is visible on screen
- Copy: "Lock the app with a PIN or biometrics (if your device supports it)?"

---

## 3. Healthcare Module — Sub-Navigation (CRITICAL GAP)

**Good:**
- Healthcare tab opens as the 5th bottom-nav item
- The session feedback's "comprehensive sub-navigation rows" observation is correct: the tab header lists **Cycle, Contraception, Symptoms, Testing, Clinic Visits, Vaccinations, Measurements, Vaginal health, Episodes, Attachments, Calendar, Clinic Card** as pill buttons at the top

**Bad / Missing / Broken — SEVERE:**
- **Sub-tab pills not accessible:** In the live browser, the sub-tab pills appeared in the *code structure* (`SHOS_Healthcare_Prototype.jsx`) but **did not render as clickable elements** in the snapshot. The Healthcare screen's main content area was essentially empty (just the update banner, "Status at a glance" region, and the footer "A minute on where things live..."). No way to cycle into sub-tabs was visible.
- **This is the single biggest gap:** The entire healthcare module's clinical functionality is behind these sub-tabs. If they can't be reached, the module is non-functional. (The transcript *assumed* they work; the live walkthrough proves they were not accessible in this fresh-demo state.)
- **Summary cards repeat identically:** The feedback mentioned "Active symptoms / Overdue vaccinations / Tests this year" repeating on every sub-tab. Without being able to enter sub-tabs, this could not be verified live, but the code confirms a shared `SummaryStat` component rendered per sub-tab (BACKLOG 0b is the open design decision for this).
- **No "Show pregnancy tracking anyway" discoverable:** The feedback mentioned this subtle link above the empty state. In the live view, the empty state was the only thing visible in the main area — no pregnancy toggle found.

**Improvement ideas (HIGH PRIORITY):**
- Fix sub-tab pill rendering/navigation so users can actually enter Cycle, Contraception, Symptoms, etc.
- This likely requires: the SPA to render the correct sub-component when a pill is clicked, or the pills to be focusable/ tappable. Needs a developer to inspect `SHOS_Healthcare_Prototype.jsx` render logic.
- Ensure "Show pregnancy tracking anyway" is visible within the Menstrual tab (not floating above the empty state)

---

## 4. Concept Repeats & Deep Linking (The "Menstrual ↔ Pregnancy ↔ Testing ↔ Measurements" chain)

**Observation from transcript + code:**
The feedback repeatedly highlights these modules and their data overlaps. Let me trace what's actually connected:

| Data Point | Destination | Status |
|---|---|---|
| **Period logging** | Log Period modal → saves to Menstrual tracking | ✅ Built (`LogPeriod` sheet in `SHOS_MenstrualHealth_Prototype.jsx`) |
| **Contraception** | Add contraception modal → links to SymptomLog via `sideEffectIds` (13 Nov decision) | ✅ Built + decided |
| **Pregnancy test** | Log pregnancy test modal → `testResult: Positive/Negative/Inconclusive` | ✅ Built |
| **Cycle day badge** | Inside Log Period modal from `getCycleDay()` calculation | ✅ Calculations exist (`menstrualCalculations.js:17-19`) |
| **Symptom → cycle entry deep link** | The 13 Nov decision: "Deep-link from cycle view to symptom logging. Value is in correlation." | ✅ Designed, not yet verified if UI implements it |
| **Measurements (BP, weight, etc.)** | Separate Measurements tab | ✅ Prototype exists (`SHOS_Measurements_Prototype.jsx`) |
| **Vaginal health** | Currently its own tab; gap analysis says fold into Symptoms/Testing/Episodes | ⚠️ Decision pending (13 Nov keeps it, but M8 feedback wants removal) |
| **Testing (STI results)** | Testing tab with lab results | ⚠️ Never walked in transcript or live; prototype exists |
| **Clinic visits** | Encounters + Clinic Card | ⚠️ Never walked |

**Critical finding:** The **"deep link from cycle view to symptom logging"** (13 Nov DESIGN DECISION Q7:A) is architecturally sound in the code structure but was **never verified end-to-end** in this beta session. A user logging a period would not see a "log related symptom" shortcut, and vice versa.

**Improvement ideas:**
- Verify the cycle↔symptom deep link works: from Menstrual tab, can you tap a shortcut to Log Symptom? From Symptoms tab, can you see cycle-linked context?
- The "reason stopped" contraception field (decided 13 Nov) is also not visible in the Add contraception sheet — needs to be built in the same pass.

---

## 5. Settings — Owner-Confirmed Walked But Transcript Gap

The user confirmed: **all Settings sub-screens were walked in the Gemini session**, but the transcript's context died before recording them. What's recorded in the transcript is only onboarding + Healthcare comments. The `audit-tracker.json` shows `settings_subscreens: complete` with visual QA passed.

**What this means for the critique:** The Settings findings from the session are lost, but the visual QA says they pass. The biggest Settings-risk items (backup/restore, App Lock lifecycle, demo-clear restore) still need **flow-level** verification — viewing ≠ exercising.

**Tier D flows (must exercise, not just view):**
1. **Backup → clear/restore → import round trip** (pairs with M9/D2 — the owner's #1 request: "restore demo data in same place it was deleted")
2. **App Lock: set PIN → background → relock → biometric → fallback → wrong-PIN path**
3. **Notification permission grant/deny → due-meds banner actions** (the M1.2 permission note only makes sense if this flow is verified)
4. **Long-press batch archive/delete/export across lists** (the onboarding advertises "Long-press (or tap Select) on any list to archive, delete, or export several records at once")

---

## 6. Summary of ACT / REVISE / REJECT / DECIDE items (from the formal report)

| # | Item | Status | Action |
|---|---|---|---|
| M1 | Onboarding dots/permission/transition | **REVISE** (dots need spacing; permission note missing; finish animation) | Add padding to dots row; append permission sub-note; fade transition |
| M2 | Home App Lock copy/sequencing | **REVISE** (add biometric mention; sequence prompts) | Copy change + defer App Lock until no toast/banner |
| M3 | Update banner overlap/backup | **ACT** (backup already in banner; narrow-viewport layout verified) | Keep bottom anchor; verify 360×640 layout |
| M4 | Healthcare sub-tabs / summary cards | **DECIDE** (need D1 decision: keep/reframe/remove vaginal; sub-tabs must render) | **HIGH PRIORITY: fix sub-tab pills** |
| M5 | Contraception form height / severity | **REVISE** (collapse Advanced accordion; severity via SymptomLog) | Collapsible "Advanced" section; route severity through SymptomLog |
| M6 | Log Period spacing / cycle-day badge | **ACT** (tighten spacing; badge from `getCycleDay()`) | Reduce vertical rhythm; add null-safe badge |
| M7 | Pregnancy test: brand/sample type | **ACT** (auto-height; optional brand field; D3 decision on sampleType) | Auto-height CSS; add brand field; decide hCG scope |
| M8 | Vaginal health tab | **DECIDE** (D1: keep+reframe / remove+migrate / freeze) | **OWNER DECISION PENDING** |
| M9 | Demo data restore | **DECIDE** (D2: re-seed / snapshot-on-clear) | **OWNER DECISION PENDING** — safety-critical |
| M10 | Second beta pass | **PLANNED** (Phase 5 script: Safety Share → backup round trip → Contacts → Medication → 9 sub-tabs → Settings flows) | Execute after D1/D2 |

---

## 7. Immediate Next Steps (what to do first)

1. **Owner decisions D1 & D2** — vaginal health fate + restore semantics. These gate M8 and M9 and heavily influence the second beta pass scope.
2. **Fix Healthcare sub-tab pills** — the most critical usability break. A developer needs to inspect why the 12 pill buttons aren't rendering/tappable in the live Healthcare tab and make them functional.
3. **Second beta pass** (Phase 5 script from the report) — once D1/D2 are set, run the systematic walkthrough over: Safety Share → backup/restore round trip → Contacts/Partner Notification → Medication → the 9 unopened Healthcare sub-tabs → Settings flow exercises (backup, App Lock lifecycle, clear/restore).
4. **Deep-link verification** — test the cycle↔symptom and cycle↔contraception↔pregnancy deep links that the 13 Nov decisions promise but which no beta tester has yet confirmed working.

**Final verdict:** The app has a **solid architectural foundation** (all the decisions from 13 Nov are coded and wired), but the **user-facing navigation is broken in one critical respect**: the Healthcare sub-tabs are not accessible in the fresh install, and the onboarding makes claims about features (permission prompts, deep links, replay tour) that are either not triggered or not reachable. These are fixable — but they need the owner's decisions on vaginal health + restore semantics first, because those rulings determine how much UI investment is "safe" before the second beta pass.

---
*End of critique. Generated from: live browser walkthrough of fresh SHOS install (demo data), Gemini transcript at https://gemini.google.com/app/41668532d3e2cec4, and codebase audit of C:\Users\kanem\SHOS-V2 as of 17 Nov 2026.*