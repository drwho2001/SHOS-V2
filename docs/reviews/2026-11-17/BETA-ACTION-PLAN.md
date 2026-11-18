# SHOS — Consolidated Beta Action Plan

**Generated:** 17 Nov 2026 from three sources:
- `BETA-FEEDBACK-REPORT.md` (Gemini transcript analysis + challenges + full plan + coverage gap)
- `BETA-TESTER-CRITIQUE.md` (module-by-module critique)
- `AUDIT-2026-11-17.md` (live browser audit, 28 screenshots in `audit-2026-11-17/`)

**Status:** findings are from a fresh-install walkthrough (demo data) + code review. Each "didn't save / didn't toggle" observation was re-verified natively and proven to be a tooling artifact — none are real bugs.
**Shipped since:** R13 (No barrier canonical label + search/filter) and R1 (update-banner dismiss fix + APK link removed on web; platform-parity biometric toggle gated). See `docs/HISTORY.md` 17 Nov entries. Everything else remains queued.

**Severity:** 🔴 broken / high · 🟠 inconsistent / medium · 🟡 polish / low · ✅ verified working (do not "fix")
**Effort:** S ≈ 0.5 day · M ≈ 1–2 days · L ≈ 3–5 days (repo conventions: heavy comments, tests, dual i18n, axe, audit-tracker updates — treat as a floor).
**Evidence:** `AUDIT-2026-11-17.md` sections A–R; code refs `file:line` in `C:\Users\kanem\SHOS-V2`.

---

## 0. DECISIONS NEEDED FROM OWNER FIRST (blocking — no code until set)

| ID | Decision | Options | My recommendation | Blocks |
|---|---|---|---|---|
| **D1** | Vaginal health tab | A keep + reframe to observations/treatment/outcome; B remove + migrate data; C freeze, revisit after fuller beta | **C (freeze)** — 13 Nov decision said keep+enrich; the "remove" argument assumed Symptoms/Testing/Episodes were reviewed, which they were not at the time. Now they are (audit N) and removal is viable — but decide with full evidence, not mid-pass | R7 below |
| **D2** | "Restore demo data" semantics | (a) re-seed static demo records; (b) snapshot-on-clear (clear = reversible) | **(b) snapshot-on-clear** — matches "restore in the same place it was deleted", cannot invent records, avoids the repo's two documented demo-data-overwrite incidents | R3 |
| **D3** | hCG / pregnancy logging scope | sample-type only / + quantitative value / + brand field | **all three, one schema pass** — the Testing form already has a Blood sample-type chip; extend the pattern to pregnancy | R5 |
| **D4** | Cosmetic cut list | keep/drop finish animation, prompt sequencing, sub-tab overflow | **drop the "celebratory pulse" transition**; defer sub-tab overflow to BACKLOG 0b; keep prompt sequencing | R8–R10 |

Owner-confirmed correction: **all Settings sub-screens were walked** in the original session — their critique notes were lost to Gemini's context limit, not coverage. Do not treat Settings as untested.

---

## 0b. DECISIONS RESOLVED + OWNER CHALLENGES (17 Nov)

### Decisions — owner set
- **D1 = B (remove + migrate), conditional on review being complete and safe.** Review IS complete: all destination sub-tabs (Symptoms, Testing, Episodes, Measurements, Clinic Visits) were walked in the live audit. **Safety conditions before removal:** the repository has **no seed data** (real clinical history only — `vaginalHealthRepository.js:19-22`), so a fresh demo install loses nothing; but `backupService.js:507` imports the repository to restore old backups (`vaginalHealth` array) — keep a read-only migration shim (or handle the key gracefully) so old backups still import. Map data: `condition`→Episodes/Testing, `treatment`→Medication/Clinic Visits, `outcome`→Episode resolution, `notes`→notes. Note this **overrides** the 13 Nov "keep + enrich" decision — record the override in BACKLOG.
- **D2 = B (snapshot-on-clear).** Clear = reversible snapshot; restore action beside clear in both Home banner + Developer tools.
- **D3 = urine + blood.**Clinical answer to "can hCG be urine tested?": **yes** — urine hCG is the standard qualitative home test; blood is quantitative serum. So the feature must NOT be blood-only. Add sample-type Urine (default, qualitative Positive/Negative/Inconclusive) vs Blood (optional quantitative value in mIU/mL). Reuse the existing `sampleType` option list (already contains Blood/Urine: `customOptionListsRepository.js:65`).
- **D4 — expanded simply:** The final onboarding slide → Get started currently cuts straight to Home. A "celebratory pulse/animation" was suggested but is cosmetic, risks motion sensitivity, and adds little. **Decision: keep a simple short fade only, and honour reduced-motion.** The two other cosmetic asks are deferred: sub-tab overflow → BACKLOG 0b (header standardisation already open); prompt sequencing (App Lock vs toasts) → keep, low-risk. Net: don't spend a build cycle on a "party animation".

### Challenge A — pregnancy testing: female health vs Testing vs Measurements
The gap in R5 is real but its *root* is architectural: pregnancy-test logging is a **separate, thinner form** (`PregnancySheet`: date/result/notes) living in Menstrual & Contraception → Pregnancy, while the **Testing tab already has "Pregnancy" as a "Testing for?" chip AND a sample-type field including Blood/Urine** (`customOptionListsRepository.js:65`, Testing "New test" form). So the app currently logs the same clinical event in two places with different field sets — that is the duplication to resolve.
- **Keep in female health (recommended, lowest risk):** add sample-type + quantitative value to `PregnancySheet`, reusing Testing's option list. Preserves reproductive context (gestational weeks, contraception link, outcome) next to the test, matches the 13 Nov "value is in correlation / deep-link" principle. Cost: small. Risk: two test-logging entry points remain.
- **Move logging to Testing:** Testing already owns sample type, result, linked visits/episodes; Pregnancy tab becomes the *episode* (weeks, trimester, outcome). Removes duplication but splits "log a pregnancy test" away from where users look, and is a bigger refactor with migration.
- **Measurements** is wrong for this: it holds quantitative time-series (weight, BP, glucose, CD4). A one-off qualitative home test does not belong there; only serial quantitative serum hCG would, and that is niche.
- **Recommendation:** do the small fix now (keep in female health, add fields), and log the "one test registry long-term" question as an architectural backlog item rather than blocking R5.

### Challenge B — "No condom" / "No barrier method" (owner asks to think/challenge)
Facts from code:
1. **"No barrier method" is derived, never stored** (`protectionBarrier.js:17-19`); it renders when no barrier-named entry is selected (`Encounters:1250-1251`), with copy "The label is worked out from your selections; nothing extra is stored" (`:2563`).
2. **"No condom" is NOT a default option.** Protection seed is `["Condom","PrEP","PEP","None"]` (`protectionRegistry.js:13`). "No condom" appears only as a *negated-string test case* (`protectionBarrier.test.js:18`) and in comments, so a user-added entry with that name isn't misread as a barrier. There is nothing to "remove as an option" in the default set.
3. **The owner's condition is not currently met:** Encounter search indexes `title, encounterType, notes, attendeeNames, kinkNames` (`Encounters:1428`) — **not** protection names and **not** the derived tag. Filters offer date/archive/session only (`:1348`). So "No barrier method" is **not searchable or filterable today**.
- **On "remove No condom / replace with bareback":** don't. "Bareback" is colloquial, narrower than "no barrier method" (which also covers no dental dam/internal condom), and clashes with the app's "no judgement" register. The derived tag is the better concept. The redundancy the owner noticed is really with the default **"None"** option, not "No condom".
- **Real fix (add as R13):** keep the auto "No barrier method" tag and make it searchable/filterable — add it to the Encounter search index (compute `hasBarrierMethod(protectionNames)` in the memo) and add a "No barrier method" filter chip. Optionally hide/deprecate a user-added "No condom" entry via registry guidance, but do not remove the negation logic (it still prevents false "barrier present" reads).

### R4 addition — allergies state (owner)
Recognise **NKDA / None / N/A / not recorded** as a *positive* state: render the allergies card with a **green outline** (like a clear result), not a neutral/empty one. Only a real allergy entry should use the warning/alert styling. Applies to the Medication "Allergies: None recorded" bar and the My Profile / Clinic Card allergies display (`clinicCardPdfService.js:325` renders "None recorded.").

---

## 1. RANKED FIX LIST

### R1 — 🔴 Update banner never dismisses; spurious on web  [EFFORT M · RISK LOW · no decision needed]
- **Symptom:** "A new version is ready…" reappears after refresh and after ✕; offers "Download APK" to a web user.
- **Root cause (definite):** dismiss writes `sessionStorage.setItem("shos-sw-update-dismissed","1")` (`App.jsx:3319`) but all four guards read **`localStorage` as an epoch timestamp** (`Date.now()-parseInt(d)<86400000`) at `App.jsx:1483, :1505, :1538, :1579`. Storage area AND value format both differ → flag can never satisfy the guard.
- **Why it fires:** three independent triggers — SW `controllerchange` (`:1505`), `version.json` SHA mismatch (`:1537`; deployed `buildSha d75b648` vs About's Build `039ec87`), GitHub release compare (`:1578`). The SHA mismatch means it fires on every load.
- **Fix:** one storage key + one format for write and guards; align deployed `version.json` with the built SHA; hide "Download APK" on web/PWA (or gate on platform).
- **Evidence:** AUDIT A; `App.jsx:1478-1587, 3297-3321`.

### R2 — 🔴 Console errors: 15 missing icons + CSP violations  [EFFORT S–M · RISK LOW]
- ~15 × 404 on `https://drwho2001.github.io/contact-platform-icons/*.png` (grindr, snapchat, whatsapp, telegram, messenger, signal, discord, bumble, feeld, bluesky, fabguys, swingers, sniffies…) — exactly the broken thumbnails on Priya's Contacts card. Missing assets / wrong base path.
- CSP: `frame-ancestors` ignored via `<meta>` (`index.html:14`); `data:font/woff2` loads blocked by `font-src 'self'` — the app's own inline fonts are blocked (may fall back).
- **Fix:** ship the icons under the correct deployed path or remove dead entries; move frame-ancestors to HTTP headers or drop it; allow `data:` in font-src or self-host fonts.
- **Evidence:** AUDIT D/G.

### R3 — 🔴 No "Restore demo data" action (owner's #1 ask)  [EFFORT M–L · RISK HIGH · needs D2]
- Clear lives in Home's first-run banner and Settings → Support → Developer tools (both render the shared `ClearSampleDataConfirm`, `src/components/ClearSampleDataConfirm.jsx:12-16`). No restore action anywhere — "restore" appears only in Developer tools' description text.
- **Fix per D2(b):** clear = snapshot kept in reversible storage; "Restore sample data" button beside "Clear sample data" in **both** surfaces, reusing `ConfirmDeleteCard` semantics. Guard rails (non-negotiable): only restore into empty collections or pure-append of `isSeed` records; never overwrite non-empty user collections; sequential repository writes (per `clearSampleData.test.js`); id-collision check against `seedIdMigration`; tests for user-data-present and partial-restore.
- **Evidence:** AUDIT O; `clearSampleData.js`, `seedIdMigration.js`, `storageAdapter.js:43-101`.

### R4 — 🟠 Repeated summary cards / chrome across tabs  [EFFORT M · RISK MEDIUM]
- Healthcare: "Active symptoms / Overdue vaccinations / Tests this year" identical on every sub-tab, confirmed with live data (new test bumped 7→8 on all). Medication: "Allergies" bar + summary cards repeat across Register/Log/Inventory. `SummaryStat` is shared (`SHOS_Healthcare_Prototype.jsx:358`).
- **Fix:** per-sub-tab stat sets (e.g. Menstrual → cycle stats already in `calculations/`; Vaccinations → doses due). Align with BACKLOG 0b (header/toolbar standardisation). Owner note: also reduce title-banner + sticky-tab + nav vertical footprint app-wide (documented, no immediate fix).
- **Evidence:** AUDIT K/M/N; BACKLOG 0b.

### R5 — 🟠 hCG / pregnancy logging gap  [EFFORT M · RISK MEDIUM · needs D3]
- Pregnancy form has only Test date / Result / Notes — no sample type, no quantitative value, no brand. Testing's "New test" form **already has a "Sample type" chip row including Blood**.
- **SHIPPED 18 Nov 2026.** `sampleType` (Urine default / Blood) + optional `hcgValue` (mIU/mL, Blood only) + `brand` on pregnancy entries; chip pattern in the form, shown on detail. `shapeForSave` clears a stale serum value when switching back to Urine. Additive fields only: `getAll()`'s DEFAULT_PREGNANCY merge means legacy backups read as urine tests, and backup export/import (`getAll` → `replaceAll`/`append`) round-trips them unchanged — no schema-version bump or migration needed. i18n keys in en.json + en-US.json.
- **Scope note:** this is the bounded field fix. The FSRH "Testing is single owner / Pregnancy as projection" refactor remains a separate later item and was NOT done here.
- **Verification:** `pregnancyHcgFields.test.js` (6 tests — defaults, urine/blood, stale-value clearing, legacy record, backup round-trip) pass; jsx guard + eslint + vite build clean.
- **Evidence:** AUDIT Q; `pregnancyRepository.js`, `backupService.js`.

### R6 — 🟠 Dialog-stack accumulation  [EFFORT S–M · RISK MEDIUM · ⚠️ confirm intent]
- Opening Settings sub-screens and Healthcare sub-tabs leaves parents mounted: after several navigations the DOM held Settings, Attachments, Episodes, Calendar, Clinic Card `[role=dialog]` all `display:block; opacity:1`, z 200–220.
- **Fix:** confirm whether intentional back-stack; if not, unmount inactive dialogs or hide with `display:none`/`aria-hidden`. This also explains the "stale screenshot" — it was showing an older stacked dialog, a real visual bug if users see it.
- **Evidence:** AUDIT L/N/Q.

### R7 — 🟠 Vaginal health: diagnosis-led + redundancy  [EFFORT L · RISK HIGH · needs D1]
- Add flow offers diagnoses (PID, Trichomoniasis, BV, Thrush, Pregnancy) with urgency badges — diagnosis belongs in Episodes/Testing, symptoms in Symptoms. Conflicts with the 13 Nov "keep + enrich with treatment/outcome/recurrenceCount" decision.
- **SHIPPED 18 Nov 2026, D1=B (remove + migrate).** Healthcare no longer offers the Vaginal health sub-tab. `vaginalHealthMigration.js` runs once at boot and copies each real record into a **Symptom Log** entry (condition as title, date, and notes/treatment/outcome preserved verbatim) — deliberately NOT fabricating Testing/Medication/Clinic Visit records from free text. The source repository is kept as a **read-only backup shim** for one release: no records deleted, old backups still import/export, and a one-time flag + per-record marker make re-runs/backup-restores duplicate-safe. Old UI module retained (unimported, marked deprecated) for one release. No seed data existed, so a fresh install loses nothing.
- **Scope note:** the finer condition→Testing/Episodes split is left to the person who knows the facts; the migration choices losslessness over guessing. No schema-version bump needed (the shim still accepts the old `vaginalHealth` backup key).
- **Verification:** `vaginalHealthMigration.test.js` (5 tests — fresh install, lossless copy, source retained, idempotent, partial-failure recovery) pass; jsx guard + healthcare guards + eslint + vite build clean.
- **Evidence:** main report M8; AUDIT M; `vaginalHealthRepository.js`, `backupService.js`, BACKLOG 13 Nov decisions.

### R8 — 🟠 Transient all-zero counts on load  [SHIPPED 18 Nov 2026]
- Developer tools' 17 async counts used `useLoadedMemo(..., 0)`, so every row read "0" for the few frames before the read resolved. All now use a `null` fallback and render `…` until loaded (error count renders `…` then "None"/number). `developerToolsCountsGuard.test.js` locks it.
- Developer tools first opens showing "0 B" and every store 0, then async-loads 4.8 KB / real counts. Stats shows "Loading…". Misleading skeleton state.
- **Fix:** show skeleton/spinner or hide counts until loaded.
- **Evidence:** AUDIT O/P.

### R9 — 🟠 Two simultaneous "ongoing" periods allowed  [SHIPPED 18 Nov 2026]
- Created a 17 Nov ongoing period while the DEMO 16 Nov ongoing period existed; both displayed. No overlap guard.
- **Owner decision (not auto-close):** attempting to log a new period while one is open opens that first record's edit sheet with a plain explanation ("A new period can't start until the previous one has ended — add the date it stopped"), then resumes the new-period form once saved. An "I don't remember — estimate duration" escape derives an end date from a remembered duration, flagged `endDateApproximate` and correctable on the detail view. Guard re-checks at save time and waits for the async list load (quick-add previously raced the read).
- **Verification:** `src/modules/menstrualOverlapGuard.test.js` (8 tests), 47 targeted tests pass, eslint clean.
- **Evidence:** AUDIT G.

### R10 — 🟡 Onboarding polish  [SHIPPED 18 Nov 2026]
- Progress dots now have their own non-shrinking row (gap 8, marginTop 12) so they can't be squeezed into the slide text on short viewports, plus a `role="group"` label and `aria-current="step"`. The DoxyPEP slide now says notifications are requested when a reminder is first set up, with a Settings → Notifications route. The abrupt Get-started transition stays out (D4) and "Replay tour" is not rebuilt (already in Guide). `onboardingPolishGuard.test.js` (4 tests) locks it.
- Dots tight on short viewports (`App.jsx:829-833`); DoxyPEP promises "real notifications" but onboarding never calls `Notification.requestPermission()` (`notificationService.js:586` does, elsewhere) — add a sub-note; abrupt Get-started transition (**drop** per D4). "Replay tour" is **already built** (Settings → Guide → Take the interactive tour) — falsified, do not build.
- **Evidence:** AUDIT B/Q; `GuideScreen.jsx:72`, `SHOS_Settings_Prototype.jsx:522,1031`.

### R11 — 🟡 Safety Share polish  [EFFORT S · RISK LOW]
- Toggled-but-empty fields appear as "Address: not provided / Vehicle: not provided" in the shared message — looks broken to a user sharing in a hurry. Consider omitting empty selected fields or labelling them clearly. Actual OS share button not triggered in testing.
- **Evidence:** AUDIT N.

### R12 — 🟡 Consistency nits  [REVIEWED 18 Nov — mostly already fixed / deliberate]
- Colour-blind aria-label: ALREADY UK spelling in both `en.json` and `en-US.json`, matching the heading. No change.
- Anonymise "Turn on/off" card: DELIBERATE — `anonymiseToggleGuard.test.js` requires the visible "Turn on" pill for discoverability, and turning OFF is PIN-gated, so `role="switch"` would falsely promise a two-way toggle on one control. No change (would break the guard and mislead).
- Home 4 header icons vs Encounter 2 vs Healthcare 1: different screens have genuinely different actions; all carry `role="button"` + `aria-label` from the earlier a11y pass. Not a defect. No change.
- Sticky offsets: ALREADY unified behind `--shos-top-banner-h` / `--shos-sticky-header-h` CSS vars plus the `STICKY_SUBHEADING_TOP` token, both locked by `stickySubheadingGuard.test.js` and `settingsStickyHeaderGuard.test.js`. The design-review note predates those guards. No change.
- **Evidence:** AUDIT A/L/Q; DESIGN-TEMPLATE-REVIEW §4.

### R13 — 🟠 "No barrier method" tag not searchable/filterable  [EFFORT S–M · RISK LOW] — NEW (owner Challenge B)
- Keep the auto-derived "No barrier method" tag (`protectionBarrier.js:34`, `Encounters:1250-1251`) — it is correct and never stored. Make it **searchable + filterable**: include `hasBarrierMethod(protectionNames)` in the Encounter search index (`Encounters:1428` currently indexes title/type/notes/attendees/kinks only) and add a "No barrier method" filter chip. Do NOT remove the "No condom" negated-string logic (`protectionBarrier.js:31-32`) — it prevents false positives on user-added entries. Do not replace with "bareback" (colloquial/narrower/off-tone).
- **Evidence:** `protectionBarrier.js`, `protectionRegistry.js:13`, `Encounters_Prototype.jsx:1428,1250`.

---

## 2. VERIFIED WORKING — DO NOT "FIX"

- Deep-links end-to-end: symptom ↔ encounter ↔ test (created a linked symptom and saw RELATED RECORDS in detail); test ↔ clinic visit; encounter → episode; clinic visit → test/vaccination/symptom shortcuts.
- Safety Share: 8 field checkboxes, editable message rebuild, check-in deadline field that changes message wording, clear disclaimer.
- Saves + persistence: test, period, pregnancy, symptom entries all survived reload with correct values.
- Preferences/Notifications toggles persisted; colour-blind palette persisted; Anonymise ON + PIN-gated turn-off works as designed.
- Light mode dark↔light switch clean and legible.
- Add Encounter 3-step form, Add Medication, Add Clinic Visit, New Test, Log Period — all fields reachable, no dead zones.
- Global Search cross-module ("PrEP" → Medication + Test).
- About shows real build/version; Guide has the tour; every Settings sub-screen opens (owner-confirmed walked).

---

## 3. SUGGESTED SEQUENCING

```
Phase 0   DONE — owner set D1=B, D2=B, D3=urine+blood, D4=simple fade (§0b)
FSRH decisions (owner, 17 Nov, see FSRH-ARCHITECTURE-BRAINSTORM.md §7):
  - structure = option 3 cluster inside Menstrual & Contraception (no 6th tab)
  - menopause = BUILD (user-entered status + neutral NICE/FSRH/RCOG-aligned wording; no triage/referral rule — repo excludes clinical decision support; owner sign-off on copy)
  - pregnancy test = move to Testing as single owner; Pregnancy = projection + prefilled deep-link; migrate existing entries
  - cycle-stats context = yes in principle, scope to confirm (owner unsure); small reversible correctness fix
Phase 1   R1, R2, R8, R10, R11, R12, R13    ← quick wins, low risk
Phase 2   R6, R9, R4 (+ allergies green outline) ← structural/layout; confirm intent on R6/R9
Phase 3   R3 (snapshot-on-clear), R5 (urine+blood hCG) ← schema + backup migrations — serialize
Phase 4   R7 (remove vaginal health + migrate, with backup shim) ← largest, last
Out of scope / carry-forward: backup→import round trip, desktop/wide, offline, reduced-motion,
          long-press batch, tap-to-undo, keyboard/focus, quick exit, Biometrics-on-Android.
```

**Ground rules:** log accepted items in `BACKLOG.md`, progress in `PLAN.md`, coverage in `audit-tracker.json`; i18n keys to both `en.json` and `en-US.json`; axe on touched screens; schema changes need backward-compatible import + `backupMigrations` + round-trip test; serialize edits to `App.jsx` and to backup/migration files (R1, R10, R12 all touch App.jsx; R3, R5 both touch backup schema).

**Effort total:** ~8–14 dev-days for Phases 1–3 + the chosen D1 branch.

---

*End of consolidated plan. Every finding is traceable to a section in `AUDIT-2026-11-17.md` or a module in `BETA-FEEDBACK-REPORT.md` / `BETA-TESTER-CRITIQUE.md`.*
