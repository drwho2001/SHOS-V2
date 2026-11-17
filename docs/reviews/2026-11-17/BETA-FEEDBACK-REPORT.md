# SHOS Beta Feedback — Per-Module Report, Challenges & Plan

**Source:** Gemini beta-test session (https://gemini.google.com/app/41668532d3e2cec4), transcript saved as
`Documents/SHOS Beta Test Feedback - Gemini Chat History.md`
**Repo:** `C:\Users\kanem\SHOS-V2` (live: https://drwho2001.github.io/SHOS-V2/)
**Date:** 17 Nov 2026

**How to read this document**
- **Part 1** — findings per module, each grounded against the actual code (file:line), with suggested changes.
- **Part 2 — Challenge 1** — adversarial review of Part 1: what is wrong, already built, conflicting, or risky.
- **Part 3** — the full implementation plan (phases, work items, acceptance criteria, tests, sequencing).
- **Part 4 — Challenge 2** — adversarial review of the plan itself.

**Verdict legend:** ACT (build) · REVISE (build, but changed) · REJECT (do not build) · DECIDE (owner decision first)

| # | Module / Finding cluster | Verdict |
|---|---|---|
| M1 | Onboarding: dots, permission note, finish transition, tour replay | ACT (revised; tour replay already exists — Part 5.7) |
| M2 | Home: App Lock prompt stacking, biometrics mention | REVISE (copy + sequencing only) |
| M3 | Encounter: update banner overlap, backup→refresh chain | REVISE (banner already has Backup) |
| M4 | Healthcare nav: sub-tab wrapping, generic summary cards | DECIDE (tied to BACKLOG 0b) |
| M5 | Add Contraception: form height, side-effect severity | REVISE (severity → SymptomLog) |
| M6 | Log Period: scroll depth, cycle-day badge | ACT (badge already has calculations) |
| M7 | Pregnancy test: padding, brand field, urine/blood hCG | ACT (schema work required) |
| M8 | Vaginal health: diagnosis framing, removal question | DECIDE (conflicts with 13 Nov decision) |
| M9 | Developer tools: restore demo data where deleted | DECIDE (highest technical risk) |
| M10 | Untested coverage: Contacts, Medication, Episodes, Calendar, Clinic Card | ACT (second beta pass; Settings confirmed walked — Part 5.4) |

---

# Part 1 — Findings & Suggested Changes (per module)

## M1 — Onboarding

**Feedback findings**
1. Carousel progress dots are "tightly sandwiched" between body text and buttons on small viewports.
2. The DoxyPEP & reminders slide should pre-warn that a notification permission prompt will follow.
3. Transition from the final slide into the app is abrupt — add a brief finish animation.
4. After completion, a "Replay tour" / "Help & Tips" entry point should remain reachable (suggested: Settings).

**Code grounding**
- `src/App.jsx:771-859` — `OnboardingScreen`. Five slides (`ONBOARDING_SLIDES`, `src/App.jsx:738-768`), matching the feedback's "five dots".
- Dots row: `src/App.jsx:829-833` — 6px dots, gap 6, `paddingBottom: 20`, body text `marginBottom: 14`. The content column is `flex: 1`, so on tall screens dots float free; crowding only manifests on short viewports where content shrinks.
- Notification permission is requested only via `Notification.requestPermission()` in `src/storage/notificationService.js:586` — onboarding never requests it. The slide copy ("both real notifications, not just in-app banners") implies a prompt that onboarding itself never triggers.
- Tour replay: `showOnboarding` is set once at boot from `!prefs.hasCompletedOnboarding` (`src/App.jsx:1186`). No Settings entry point exists anywhere in `src/`.
- The interactive tour is already auto-offered after genuine (non-Skip) completion (`skipped` flag threading, `src/App.jsx:792-797`).

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M1.1 | Increase dots row top spacing (`paddingTop`) so short-viewport layout breathes; keep 6px dot size | S | None |
| M1.2 | DoxyPEP slide: append sub-note "If you turn reminders on, your browser/device will ask permission to show notifications." Copy-only | S | None |
| M1.3 | Finish transition: fade/scale-out of onboarding root before unmount, gated on `prefers-reduced-motion` | S | Low (a11y) |
| M1.4 | ~~Settings row "Replay the tour"~~ **FALSIFIED by Part 5 sweep: already built** — Settings → Guide → Start tour (`SHOS_Settings_Prototype.jsx:522,1031`, `GuideScreen.jsx:72`). Remaining work: verify discoverability only | S | Low |

## M2 — Home dashboard & App Lock prompt

**Feedback findings**
1. App Lock card stacks with the notification banner and recent-activity rows on first load — sequence prompts instead of competing.
2. The prompt should mention biometric unlock ("PIN or biometrics"), not just PIN.

**Code grounding**
- App Lock offer: `src/App.jsx:701-726` — bottom-sheet `role="dialog"` with `Set up App Lock` / `Not now` / `Don't ask again`. Copy: "Optional, and off by default… Settings → Privacy".
- **Biometrics already exist**: `src/storage/biometricAuthService.js` (`checkBiometryAvailable`, `authenticateWithBiometrics`), wired into the lock screen at `src/App.jsx:16, 333-471`, including graceful fallback to PIN on cancel/failure/unavailability. Only the *offer* copy omits it.
- Prompt stacking: `showAppLockPrompt` fires on first-run Home; the SW-update banner (`src/App.jsx:3297`) and notifToast share the bottom region with a deliberate 60px stacking offset.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M2.1 | Copy change: title → "Lock the app with a PIN or biometrics?", body adds "if your device supports it". No behaviour change | S | None |
| M2.2 | Prompt sequencing: defer the App Lock offer until no toast/banner is visible (reuse the measured-banner-height state already in App.jsx) or to the second Home visit | M | Medium (boot-state interactions) |

## M3 — Encounter hub & update banner

**Feedback findings**
1. Update banner overlaps the bottom nav bar and floating action button — anchor top or pad the nav.
2. Allow tapping Backup directly in the banner and chain it into the refresh action.

**Code grounding**
- Banner: `src/App.jsx:3297-3321` — `position: fixed; bottom: calc(76px + env(safe-area-inset-bottom))`, `zIndex: 300`, `pointerEvents: none` with auto/refresh/apk/dismiss set to `auto`.
- **The banner already has a Backup button** (`src/App.jsx:3316`) that opens Settings → export. The "one-tap backup in banner" finding is already implemented; what is missing is only the *chain* (backup → then refresh).
- Bottom placement is a recorded, deliberate decision (`src/App.jsx:3281-3296`): top is reserved for the due-meds/due-reminders banner stack; bottom offset was already bumped 60px to stack rather than collide with notifToast. "Move it to the top" contradicts that decision.
- The banner text spans the width with 4 actions (Backup, Refresh, Download APK, ✕) — on narrow phones the row is genuinely crowded; the overlap claim should be verified on a real device before re-anchoring.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M3.1 | Verify overlap against bottom nav/FAB in a real viewport (Playwright at 360×640 + one physical device) before moving anything | S | None |
| M3.2 | Chain: after Backup completes (export success), keep the banner and swap the Backup label to "Done — refresh now?" so refresh is one tap away | M | Low |
| M3.3 | Narrow-viewport layout: collapse "Download APK" into the existing overflow pattern or wrap to a second row instead of re-anchoring the banner | S | Low |

## M4 — Healthcare hub navigation & summary cards

**Feedback findings**
1. Sub-tab pill row (Symptoms, Testing, Clinic Visits, Vaccinations, Measurements, Menstrual & Contraception, Vaginal health, Episodes, Attachments, Calendar, Clinic Card) overflows / wraps on mobile.
2. Top summary cards (Active symptoms, Overdue vaccinations, Tests this year) repeat identically on every sub-tab — they should be context-aware.
3. "Show pregnancy tracking anyway" link feels disconnected above the empty state.

**Code grounding**
- Summary cards: `src/modules/SHOS_Healthcare_Prototype.jsx:183, 358` — shared `SummaryStat` row rendered per sub-tab.
- **BACKLOG `0b`** already records an open, undecided standard for module banner / tab-header controls — the sub-tab row question belongs to that decision, not a one-off fix.
- Pregnancy link: `src/modules/SHOS_MenstrualHealth_Prototype.jsx:1229` (and `SHOS_MyProfile_Prototype.jsx:1070` for the gender-based default rule).

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M4.1 | Per-sub-tab summary card sets (e.g., Menstrual → cycle stats already computed in `calculations/`; Vaccinations → doses due). Reuse `SummaryStat`; no new components | M | Medium (per-tab data plumbing) |
| M4.2 | Sub-tab row: "More ▾" overflow past N tabs (suggest 6 visible) — implement only as part of the BACKLOG 0b decision | M | Medium (churn risk) |
| M4.3 | Move "Show pregnancy tracking anyway" into the Settings/profile rule it belongs to, or directly under the tab row; keep one-tap visibility | S | Low |

## M5 — Add Contraception modal

**Feedback findings**
1. Form too tall — collapse side effects and renewal interval into an "Advanced" accordion.
2. Side-effect chips should carry Mild/Moderate/Severe severity tags.
3. (Praise, no action) method chips, renewal logic, sticky footer, date defaults.

**Code grounding**
- Sheet: `ContraceptionSheet` in `src/modules/SHOS_MenstrualHealth_Prototype.jsx` (rendered at :944-945).
- **Recorded decision (BACKLOG, DESIGN DECISIONS 13 Nov 2026):** "Contraception side effects: Link to SymptomLog (sideEffectIds), not standalone." Severity belongs on the SymptomLog record, not as chip decoration inside this modal.
- Also already decided and *not yet built*: "Contraception reason stopped" field — a real gap the beta pass did not surface.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M5.1 | Collapsible "Advanced — schedule & side effects" section, default collapsed, first field visible without scroll | M | Low |
| M5.2 | Severity: when a chip is tapped, deep-link/create a SymptomLog entry with severity (per the 13 Nov decision), not an in-chip badge | M | Medium (linkage integrity) |
| M5.3 | (Carry-over) Build the already-decided "reason stopped" field in the same pass over this sheet | S | Low |

## M6 — Log Period modal

**Feedback findings**
1. Scroll depth before reaching the [Add] button — condense spacing.
2. Dynamic "Cycle Day N" badge inside the modal.
3. (Rejected by challenge, see Part 2) "Estimated ovulation window" preview.

**Code grounding**
- Modal: `LogPeriod` sheet in `src/modules/SHOS_MenstrualHealth_Prototype.jsx`.
- **Cycle-day maths already exists**: `getCycleDay()` / `getCyclePhase()` in `src/calculations/menstrualCalculations.js`, already consumed by `src/calculations/cycleWidgetSync.js`. A badge is read-only reuse.
- BACKLOG 13 Nov: "Cycle prediction: Show average + variability + next predicted… Surface existing data" — a cycle-day badge fits; "Fertile window: EXCLUDE (medical liability, dedicated apps exist)" — ovulation claims are excluded by prior decision.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M6.1 | Tighten vertical rhythm of primary fields so date/flow/pain/Add are one screen at 640px height | S | Low |
| M6.2 | "Cycle Day N" badge from `getCycleDay()`; null-safe (no badge when no prior cycle). No phase/fertility claims in copy | S | Low |
| M6.3 | REJECT the "estimated ovulation window" suggestion — conflicts with the recorded liability exclusion | — | — |

## M7 — Log Pregnancy Test modal

**Feedback findings**
1. Sparse layout leaves an awkward gap above the footer — auto-size.
2. Optional brand/type of test field ("Digital clearblue", "Early detection strip").
3. **Urine vs. blood sample type toggle; if blood, quantitative hCG value** (owner confirmed this is a deliberate backlog item, not a tangent).

**Code grounding**
- `PregnancySheet`: `src/modules/SHOS_MenstrualHealth_Prototype.jsx:953-984`. Fields: `testDate`, `testResult` (`TEST_RESULT_OPTIONS = ["Positive","Negative","Inconclusive"]`, `src/repositories/pregnancyRepository.js:46`), conditional due-date/outcome/mask block, notes.
- Schema is persisted through `pregnancyRepository` and exported via `src/storage/backupService.js` (dataKey `pregnancies`, date-sort at :215 region) with migrations in `src/storage/backupMigrations.js` — new fields must be optional with defaults, or the backup gains a version bump.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M7.1 | Auto-height bottom sheet content (remove fixed min-height on this sheet only) | S | None |
| M7.2 | Optional `brand` text field | S | Low |
| M7.3 | `sampleType: "urine" \| "blood"` (default urine); when blood, optional `hcgValue` number + unit mIU/mL shown as "quantitative serum hCG". Affects: repository defaults, backup export/import, backupMigrations backward-compat, list/detail rendering, i18n (`en.json` **and** `en-US.json`) | M | Medium (schema/backup) |

## M8 — Vaginal health tab

**Feedback findings**
1. The Add flow presents *diagnoses* (PID, Trichomoniasis, BV, Thrush, Pregnancy) as triage cards — diagnosis framing belongs in Episodes/Symptoms, not a tab of its own.
2. Consider removing the tab entirely; gap analysis says Symptoms / Testing / Episodes / Medication cover everything it does.

**Code grounding — this is a direct conflict with a recorded decision**
- **BACKLOG, DESIGN DECISIONS 13 Nov 2026 (4 days ago, agreed with owner):** "Vaginal health: Treatment field, outcome field (resolved/recurring/chronic), recurrenceCount (derived), link to Testing." That decision *keeps and enriches* the module.
- Removing it is not a UI edit: `src/repositories/vaginalHealthRepository.js` (own storage key `shos_vaginal_health`), wired into `src/repositories/resetAllData.js:53,87`, `src/storage/backupService.js:93,156,215,317,483,507,642`, i18n (`en.json:451,961-973`, `en-US.json` same), seed demo data ("fresh install demonstrates the feature" — repository header), plus existing user records.
- The triage/preset UI lives in the vaginal-health add flow (red/amber/green urgency badges).

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M8.1 | DECIDE first: **(A)** keep + reframe away from diagnosis labels toward observations/treatment/outcome (matches 13 Nov decision), **(B)** remove + migrate data, **(C)** keep UI frozen, revisit after second beta pass | — | — |
| M8.2 | If A: replace diagnosis-preset cards with observation-first fields (discharge, odour, irritation, pH) + treatment/outcome/recurrence per the 13 Nov decision; move the urgency-badge triage out | L | Medium |
| M8.3 | If B: data migration mapping (records → SymptomLog / Testing / Episodes), repository retained read-only for one release for export safety, backup schema version bump, seed data removal, i18n cleanup, `resetAllData`/`backupService` reference cleanup | L | **High** |

## M9 — Developer tools: restore demo data where it was deleted

**Feedback finding (owner's own words):** "need to be able to restore demo data in same place it was deleted."

**Code grounding**
- Deletion happens in exactly two surfaces, both rendering the shared `ClearSampleDataConfirm` (`src/components/ClearSampleDataConfirm.jsx:12-16`): **Home first-run banner** and **Settings → Support → Developer tools**. So "same place" = both surfaces, one shared component.
- `src/repositories/clearSampleData.js` removes records identified as sample data (`isSeed` flag, shared with `src/storage/seedIdMigration.js`).
- **Repo history makes this the riskiest item in the report:** `src/storage/storageAdapter.js:43-101` and `src/storage/backupService` comments document real incidents where demo data was written over user records and where cleared demo data became permanently indistinguishable from real records. Any restore must obey those hard-won rules.

**Suggested changes**
| ID | Change | Size | Risk |
|---|---|---|---|
| M9.1 | DECIDE restore semantics: **(a)** re-seed static demo records (fresh-install seed data, `isSeed: true`), or **(b)** snapshot-on-clear (clear = move to a restorable snapshot; restore = un-snapshot). Recommendation: **(b)** — it restores *the exact records that were deleted*, matches the owner's wording ("same place it was deleted"), and cannot invent records the user never had | M–L | High either way |
| M9.2 | "Restore sample data" button beside "Clear sample data" in Developer tools and in the Home banner's cleared-state, rendered by the same shared component, with the same `ConfirmDeleteCard` semantics | M | High (guard rails) |
| M9.3 | Guard rails (non-negotiable): restore only into empty collections or as pure append of `isSeed` records; never overwrite non-empty user collections; sequential (not `Promise.all`) repository writes per `clearSampleData.test.js` note; id-collision check against `seedIdMigration`; explicit tests for "user data present" and "partial restore" states | M | — |

## M10 — Coverage gap: views never walked through

**Feedback finding:** Contacts, Medication, Episodes, Calendar, Clinic Card, and Settings/Backup/Export were never reviewed.

**Suggested change:** a second beta pass with the same critique format over the untested surfaces (Part 5.7 script). Settings was walked in session (owner-confirmed) — its critique *notes* were lost to Gemini's context limit, not its coverage (see Part 5.4). Findings must land in `BACKLOG.md`/`AUDITS.md` per repo convention rather than a one-off document.

---

# Part 2 — Challenge 1: attacking the findings

> Every item in Part 1 was tested against three questions: *Is it true? Is it already built? Does it conflict with a recorded decision?*

**1. Evidence quality is the biggest problem.** The findings are AI-generated from screenshots of a live app, not from code or a human click-through. Several claims are already falsified by the code:
- "Allowing users to tap Backup directly inside the update banner" — **already exists** (`App.jsx:3316`).
- "Biometric Authentication Alternative" as a missing edge case — **already implemented** (`biometricAuthService.js`, wired at `App.jsx:333-471`); only the offer copy is stale.
- The banner "sits directly on top of the bottom navigation bar" — it is positioned at `bottom: 76px + safe-area`, deliberately chosen and already offset once for toast stacking. The claim may be true on a specific device/viewport, but it is **unverified**, and the proposed fix (anchor to top) directly contradicts the recorded reason it is at the bottom (top belongs to the due-meds banner stack).
- The dots "sandwiched between text and buttons" — the content column is `flex: 1`; on normal viewports the dots are not adjacent to the text at all. Real only on short screens. The fix is still cheap, so ACT, but the finding as written is wrong.
**Consequence:** Part 1 items M3.1 and a re-verification pass are mandatory *before* any layout work. Building from screenshot claims is how the "Settings → Design" onboarding bug (`App.jsx:762-766`) happened in the first place — instructions pointing at screens that don't exist.

**2. Three findings collide with decisions made by the owner within the last four days.**
- **Vaginal health removal (M8)** vs. the 13 Nov decision to keep it with treatment/outcome/recurrenceCount. The beta analysis (gap mapping to Symptoms/Testing/Episodes) is sound *analysis* but it is not the owner's current decision. Recommend neither A nor B yet: freeze the tab's UI (no investment), run the second beta pass, then decide with both inputs.
- **Side-effect severity chips (M5.2)** vs. "side effects link to SymptomLog, not standalone". Building severity into chips would create a second, competing severity store. Route it through SymptomLog or drop it.
- **"Estimated ovulation window" badge (M6)** vs. "Fertile window: EXCLUDE (medical liability)". In a sexual-health app, an ovulation estimate is precisely the liability the owner already excluded. **REJECT.**

**3. Prioritization in the feedback is inverted.** The transcript spends most of its length on cosmetic polish (dot spacing, animation pulses, card padding) and little on the three items that touch data: hCG sample type, demo restore, vaginal health. A "celebratory pulse or fade" on Get started is the lowest-value item in the entire report and the only one with an accessibility trap (`prefers-reduced-motion`). If scope is cut — and it should be — cut there first.

**4. The restore-demo-data ask is underspecified and dangerous as stated.** The owner said "restore demo data in the same place it was deleted". Two readings: (a) *recreate the built-in demo records*, (b) *undo my clear*. They need different machinery, and (a) has burned this repo twice already (demo data overwriting real records; cleared demo data becoming un-identifiable). The wording "restore" plus "same place" reads closer to (b). Plan M9.1 must settle this before a line is written; if (b), snapshot-on-clear is strictly safer than re-seeding.

**5. "Form too tall" is asserted, not measured.** M5.1/M6.1 assume scrolling is a problem; the sheets already have sticky footers with the primary action pinned (the feedback itself praises this in two entries — its own critique and praise contradict). An accordion *hides* fields, which in a clinical entry form has its own cost (invisible required fields, discoverability). Keep the accordion opt-in (collapsed "Advanced"), never hide required fields, and measure first at 360×640.

**6. M4.2 (sub-tab overflow) is scope duplication.** BACKLOG 0b is an open design question about exactly this control row. Fixing it ad hoc now guarantees re-work when 0b is decided. It stays in the plan only as "align with 0b", not as an independent build.

**7. What the feedback missed** (equal weight to what it found):
- The already-decided-but-unbuilt **"reason stopped" contraception field** (13 Nov decision).
- No finding about data export/backup correctness — the highest-stakes surface in the app — despite "Settings & Backup" being on the untested list.
- No accessibility findings at all, though this repo has an axe-core history of real bugs (contrast at `App.jsx:3304-3315`, landmark at :3331). Every Phase 1/2 item gets an axe check precisely because the feedback source cannot produce these.

**Challenge 1 verdict:** 6 items ACT, 5 REVISE, 3 REJECT/defer, 3 DECIDE-before-code. The report is usable as an input, not as a spec.

---

# Part 3 — Full Plan

**Ground rules (from repo conventions)**
- Record every accepted finding in `BACKLOG.md`; progress tracked in `PLAN.md`; coverage in `audit-tracker.json` / `AUDITS.md`. This report is a source document, not a third tracker.
- Every UI change: axe-core clean on the touched screen; i18n keys added to **both** `en.json` and `en-US.json` where strings are translated (onboarding/App Lock strings are hard-coded English by precedent — follow the local pattern of the file you touch).
- Every schema change: backward-compatible import, `backupMigrations.js` entry, round-trip test in `backupService.test.js`.
- Every phase ends with the existing suite green: `vitest` + touched Playwright specs.

## Phase 0 — Decisions & verification (no code, ~1–2 days)

| ID | Item | Output |
|---|---|---|
| D1 | Vaginal health: A (keep+reframe) / B (remove+migrate) / C (freeze, decide after Phase 5) | Owner decision recorded in BACKLOG |
| D2 | Restore demo data: re-seed (a) vs snapshot-on-clear (b) | Owner decision + chosen semantics |
| D3 | hCG scope: sampleType only, or sampleType + quantitative value + brand (recommend all three, one schema pass) | Scope line |
| D4 | Cosmetic cut list: drop or keep the Get-started transition (M1.3), prompt sequencing (M2.2), sub-tab overflow (M4.2) | Scope line |
| V1 | Verify M3 banner overlap at 360×640 + physical device; verify M1 dot crowding at 568px height; verify M5/M6 sheet scroll depth | Screenshots into `AUDITS.md` |
| V2 | Re-verify every ACT/REVISE item in Part 1 against the live app; strike falsified claims | Amended Part 1 |

**Exit criteria:** D1–D4 decided, V1/V2 done. No Phase 1+ work starts against unverified claims.

## Phase 1 — Copy & quick wins (low risk, ~2–3 days)

| ID | Work item | Depends | Acceptance |
|---|---|---|---|
| 1.1 | M1.1 dots spacing | V1 | Dots ≥24px from body and buttons at 568px height |
| 1.2 | M1.2 permission sub-note on DoxyPEP slide | — | Copy matches actual permission trigger; no permission requested during onboarding |
| 1.3 | M1.4 Settings → "Replay the tour" | D4 | Replay works twice in a row; no double tour auto-offer; `hasCompletedOnboarding` stays true |
| 1.4 | M2.1 App Lock copy mentions biometrics | — | Copy reflects `biometricAuthService` availability logic ("if your device supports it") |
| 1.5 | M7.1 pregnancy sheet auto-height | — | No dead gap; footer still pinned; positive/negative/inconclusive paths all verified |
| 1.6 | M3.3 banner narrow-viewport layout (per V1 outcome; default = keep bottom anchor) | V1 | All 4 actions tappable at 360px; no overlap with nav/FAB; axe clean |
| 1.7 | M6.1 period sheet spacing tightening | — | Date/flow/pain/Add visible at 640px height |
| 1.8 | M1.3 finish transition (only if D4 keeps it) | D4 | Respects `prefers-reduced-motion`; no unmount race with the `onAnswer` await logic (`App.jsx:776-791`) |

**Serialization rule:** items 1.1–1.4 all touch `App.jsx` — land them as sequential small PRs, never one mixed change.

## Phase 2 — Form & view ergonomics (~3–4 days)

| ID | Work item | Depends | Acceptance |
|---|---|---|---|
| 2.1 | M5.1 collapsible "Advanced — schedule & side effects" in ContraceptionSheet | V1 | Required fields never hidden; open state persists per session; save validation unchanged |
| 2.2 | M5.3 build the decided "reason stopped" field in the same sheet | — | Matches 13 Nov decision options; backup-compatible (optional field) |
| 2.3 | M6.2 Cycle Day badge from `getCycleDay()` | — | Null-safe with zero prior cycles; no phase/fertility wording; no badge when `null` |
| 2.4 | M4.1 context-aware summary cards per sub-tab | D1 | Each sub-tab shows ≥1 relevant stat; no stat shows stale data from another tab; reused `SummaryStat` |
| 2.5 | M4.3 relocate "Show pregnancy tracking anyway" | — | Still one tap from the empty state; gender-rule behaviour (`SHOS_MyProfile_Prototype.jsx:1070`) unchanged |
| 2.6 | M4.2 sub-tab overflow | D1 + BACKLOG 0b | Only if 0b is decided in the same window; otherwise skip |
| 2.7 | M5.2 severity via SymptomLog deep-link | — | One severity store only; linkage survives export/import |

## Phase 3 — Schema & data work (~4–6 days, highest care)

| ID | Work item | Depends | Acceptance |
|---|---|---|---|
| 3.1 | M7.3 hCG sampleType (+ D3 extras: brand, quantitative value) | D3 | Defaults preserve existing records; export→import round-trip on old *and* new backups; `backupMigrations` entry; i18n both files; unit tests for urine-only, blood+value, legacy record |
| 3.2 | M9 restore demo data | D2 | Per chosen semantics: (b) snapshot-on-clear → clear is reversible bit-for-bit; (a) re-seed → only into empty collections. Guard-rail tests: user-data-present, partial restore, id collision, sequential writes. Same shared component in Home + Developer tools |
| 3.3 | Guard-rail regression suite for 3.2 | 3.2 | Explicit tests mirroring the `storageAdapter.js:43-101` incident scenarios |

## Phase 4 — Vaginal health (per D1, ~2–5 days)

- **D1 = A:** M8.2 reframe (observation-first fields, treatment/outcome/recurrence per 13 Nov, triage badges removed from this flow). Repository untouched → no migration.
- **D1 = B:** M8.3 full removal: migration map (record → SymptomLog/Testing/Episodes), one-release read-only repository for export safety, backup schema version bump, seed-data removal, `resetAllData`/`backupService`/i18n cleanup, migration test on a fixture containing vaginal-health records.
- **D1 = C:** nothing this cycle; tab frozen (no M4.1 stats investment for this tab).

## Phase 5 — Second beta pass (~2 days, before committing to Phase 2/3 backlog refinements)

Walk Contacts, Medication, Episodes, Calendar, Clinic Card, Settings/Backup with the same critique format, plus an axe-core sweep each. Feed results into `BACKLOG.md`. **Run this before Phase 2 starts** so a discovered structural issue can still reorder the plan.

## Test plan (applies throughout)

- `vitest`: repositories, migrations, calculations touched items (`menstrualCalculations` for 2.3, `pregnancyRepository` for 3.1, `clearSampleData`/seed for 3.2).
- Playwright: onboarding flow, contraception/period/pregnancy sheets, developer-tools clear/restore, update-banner actions — the repo already has `playwright.config.js` + `audit-toggle-exercise.spec.js` precedent.
- axe-core on every touched screen (repo precedent: `App.jsx:3304` contrast fix, `:3331` landmark fix).
- Manual: physical device pass for V1 items; backup export/import on both APK and web build.

## Sequencing summary

```
Phase 0 (decisions + verification)
   ├─► Phase 1 (copy/quick wins, App.jsx serialized)
   ├─► Phase 5 (second beta pass) ──┐
   └─► Phase 2 (forms/views) ◄──────┘  (5 can reorder 2/3)
Phase 3 (schema: hCG, restore)   ← only after D2/D3
Phase 4 (vaginal health)         ← only after D1, ideally last
```

**Effort total:** ~11–17 dev-days for Phases 1–3 + D1 branch, excluding Phase 5 beta time.

---

# Part 4 — Challenge 2: attacking the plan

**1. The plan's riskiest dependency is invisible in the Gantt: `App.jsx` is a ~3,300-line single file** holding onboarding, App Lock, the update banner, toasts, and boot logic. Phase 1 items 1.1–1.4 all edit it, and this file's history (the `onAnswer` await race at `:776-791`, the boot-on-sample-data refusal at `:1253`) shows how subtle its state interactions are. "Sequential small PRs" is necessary but not sufficient — each PR must re-run the boot/onboarding/app-lock state tests, and two of the four items (1.3 replay, 1.4 sequencing) mutate the same `showOnboarding`/prompt state machine. **Correction:** merge 1.3 and the M2.2 sequencing work into one state-machine change reviewed together, or drop M2.2 to Phase 2.

**2. Phase ordering is still wrong in one respect.** Phase 5 (second beta pass) is drawn as a side branch that "can reorder 2/3", but Phases 2 and 3 contain the largest spend (schema + migrations). If the second pass surfaces a structural problem in, say, Medication or Episodes, that discovery is worth more than any Phase 2 polish. **Correction:** make Phase 5 a hard gate before Phase 2, accepting ~2 days of delay. The plan currently lets schedule pressure skip it.

**3. D2 (restore semantics) may be the wrong question.** The challenge in Part 2 recommended snapshot-on-clear, but the plan keeps (a) re-seed as a live option. Given this repo's two documented demo-data incidents, option (a) should be **struck unless the owner explicitly wants fresh demo records after having real data** — a case that mostly doesn't exist for a single-user app. Worse, the plan's acceptance criterion for (a) ("only into empty collections") makes the feature useless in exactly the scenario the owner asked for (restore *after* clearing, in an app that then has other real records). **Correction:** default D2 to (b); treat (a) as requiring a written owner override.

**4. Effort estimates ignore this repo's actual cost structure.** Every item here inherits: heavy explanatory comments (repo convention), tests for storage/backup paths, i18n dual-file updates, axe checks, Playwright coverage, and audit-tracker updates. The "S" sizes are UI-sized, not repo-sized — M7.3 "M" touches repository + backup export/import + migrations + two i18n files + detail/list render + tests, which in this codebase is closer to L. **Correction:** treat totals as ±50%; the 11–17 day figure is a floor, not a range midpoint.

**5. Phase 3 sequencing has a hidden coupling.** 3.1 (hCG schema) and 3.2 (restore/snapshot) both write to backup/migration infrastructure. Running them in parallel risks two migration entries landing in the same `backupMigrations.js` release window with round-trip tests written against each other's fixtures. **Correction:** serialize 3.1 → 3.2 (schema first, restore second), and pin one backup schema version per release.

**6. The plan has no rollback story.** Web (GitHub Pages) + APK ship from the same repo; an APK in the field cannot be downgraded, and a bad backup migration is unrecoverable data loss in a *medical record* app. Nothing in Phases 3–4 says what happens when a migration misbehaves on a real device. **Correction:** add per-schema-item rollback criteria (old app reads new backup = forward-compat test; new app reads old backup = migration test) and require the vaginal-health removal (if chosen) to keep one release of read-only export before hard deletion — the plan says this once, in passing, but it must be a release gate.

**7. Success measurement is absent.** The plan defines acceptance per item but no answer to "did the beta feedback improve the product?" No re-test of the same screens, no before/after on the specific complaints. **Correction:** after Phase 2, re-run the original beta critique on the same screens (onboarding, contraception, period, pregnancy, encounter banner) and record deltas in `AUDITS.md`; otherwise this whole exercise is unverifiable.

**8. Scope still isn't cut.** Part 2 flagged cosmetics as the cut candidates; the plan keeps them behind D4 but carries all ten modules forward. With schema work (Phase 3) and a high-risk architecture decision (Phase 4) on the table, the honest plan cuts M1.3 (transition animation) outright, defers M4.2 to BACKLOG 0b, and treats M2.2 as optional. **Correction:** baseline scope = Phase 0 + Phase 1 (minus 1.8) + 2.1–2.3 + Phase 3 + Phase 5; everything else is stretch.

**Challenge 2 verdict:** the plan is sound in structure but optimistic in three places — ordering (Phase 5 must gate Phase 2), restore semantics (default to snapshot), and effort (repo discipline doubles "small" items). Fix those three and it is executable as written.

---

---

# Part 5 — Coverage gap: what was never shown to the beta tester

> The session's final Gemini message listed six unexplored views — then ran out of context. That list is
> a last gasp, not an inventory. This section supersedes it with a systematic sweep from three sources:
> **(a)** the transcript itself (what was actually walked), **(b)** the screen inventory
> (`src/modules/*.jsx` = 22 modules, `src/modules/settings/*.jsx` = 22 settings screens),
> **(c)** `git log --since=2026-11-10` for features shipped but never surfaced, cross-referenced against
> `audit-tracker.json` — which tracks *visual* QA (dark/light/toggles), a different axis entirely:
> a screen can be visually verified and still never have had a fresh-eyes functional critique.

## 5.1 What the transcript actually walked (9 surfaces)

1. Onboarding: DoxyPEP slide + final "Make it yours" slide (2 of 5 slides)
2. Home dashboard + App Lock offer modal
3. Encounter tab (empty state + update banner + LIVE SESSION bar)
4. Healthcare → Menstrual & Contraception (Cycle/Contraception toggles, metric cards)
5. Add contraception modal (+ scrolled)
6. Log period modal (+ scrolled)
7. Log pregnancy test modal
8. Healthcare → Vaginal health (empty view + triage selector)
9. Discussion-only: demo data restore, hCG sample type, tab architecture

That is **one** module's sub-tabs (2 of 11) and **zero** other top-level modules in the recorded transcript. Settings sub-screens were also walked (owner-confirmed) but never recorded — see 5.4.

## 5.2 Tier A — newest features, never surfaced (git evidence, highest priority)

| Feature | Built | Why it matters |
|---|---|---|
| **Safety Share** (`SHOS_Contacts_Prototype.jsx:369,2863` — contact detail → "Share for safety") | 14 Nov (`84ee456`, device-verified `b47a5fa`) | **Exactly the owner's hunch.** Field selection (name/address/vehicle/photo/phone), Google Maps live link, check-in deadline parsing (`calculations/safetyShareFields.js`), system share sheet, and a **one-shot check-in reminder notification** (`notificationService.js:106`, added 16 Nov). Safety-critical, brand-new, never beta-walked |
| **Partner Notification checklist** (`SHOS_PartnerNotification_Prototype.jsx`) | recent | Clinic-handover checklist builder with per-contact notified tracking + text export. Sensitive flow, zero walkthrough |
| **Interactive Tour rework** (`InteractiveTour.jsx`, 12-step, demo-session spotlight, settings steps, tour exits in place) | 13–17 Nov (`c3dfb97`, `a5b60b4`, `47c9685`, `e937e25`) | Heavily reworked in the days *around* the session; transcript never shows the tour running at all |
| **Home quick-adds rework** (shared lockout, feedback, ghosting, new order) | 17 Nov (`e937e25`) | Home was seen only as a freshly-reset dashboard; the reworked quick-add interactions were not exercised |
| **Share My Profile per-field granularity overlay** | `8ed2c96`, `14238de`, `99148fe` | New overlay + opt-in fields surviving export — never shown |
| **Manual folder export re-prompt**, **settings search keyword jump** | `01e5487`, `eb12999` | Small but user-facing, never shown |
| **App Lock instant-relock fix** | `a611e4c` | The one App Lock screen that was shown predates this fix |

**Rule for the second pass:** re-run `git log --since=<session date>` at pass time and treat every user-facing commit as an automatic walkthrough item.

## 5.3 Tier B — whole modules never opened (0 of these appeared in the transcript)

- **Contacts** (list, detail, duplicates panel, select mode) — *also the host of Safety Share*
- **Medication** (registry / log / inventory, due-meds banner, Take all / Skip / Snooze actions)
- **Symptoms** (SymptomLog — the destination module for two of the transcript's own recommendations)
- **Testing**, **Clinic Visits**, **Vaccinations**, **Measurements**, **Attachments**, **Timeline**, **Clinic Card**
- **Global Search**, **My Profile** (including the share-profile flow), **Option List Editor / Registry Management** (the long-press batch tool the onboarding copy advertises)

**Healthcare sub-tabs: 9 of 11 never opened** — Symptoms, Testing, Clinic Visits, Vaccinations, Measurements, Episodes, Attachments, Calendar, Clinic Card. The transcript only saw the *row of names*, then dove into Menstrual and Vaginal health. Note the feedback's own gap analysis (M8) recommended folding vaginal health into Symptoms/Testing/Episodes — **modules the tester never actually looked at**. The M8 decision should not be taken before that pass.

## 5.4 Settings — owner-confirmed walkthrough (transcript gap, not coverage gap)

**Correction (owner, 17 Nov): all Settings sub-screens were walked in session** — the transcript simply doesn't record them, consistent with the session ending in Gemini's context limit. Settings is therefore **not** an untested surface; what's missing is the *record* of those critiques.

Consequences:
- The Settings findings died with the context window. Decide: re-capture cheaply (one fast critique pass over Settings, format per Part 5.7) or accept the loss and lean on the existing `audit-tracker.json` visual QA (`settings_subscreens: complete`).
- The screens behind this round's biggest decisions still need **flow-level** verification, which is different from having viewed them: `BackupExport`/`AutomaticBackups` (backup→restore round trip, Tier D #1), `Privacy` (App Lock lifecycle, Tier D #5), `DeveloperTools` (demo clear/restore, M9/D2). Viewing ≠ exercising.

## 5.5 Tier D — flows that no screen-walk covers (need scripted exercise, not viewing)

1. **Backup → clear/restore → import round trip** (the app's highest-stakes flow; pairs with D2/M9)
2. Trash → undo/redo (`DeleteToast`), archive → restore
3. Long-press batch archive/delete/export across lists
4. Notification permission grant/deny → due-meds banner actions (the M1.2 permission note only makes sense if this flow is verified end-to-end)
5. App Lock: set PIN → background → relock → biometric → fallback → wrong-PIN path
6. Live session: start → add activities → **wrap up** (transcript saw only the pending banner)
7. Update banner: Backup → export → refresh chain (M3.2)
8. Onboarding: question-slide answer paths (menstrual toggle actually gating the tab), Skip vs Get-started (the `skipped` flag path), replay from Guide
9. Vault/wrong-key refusal path (`App.jsx:309`) and import-conflict/migration paths
10. Dark mode + colour scheme actually applied across a walked screen (copy was advertised, never demonstrated)

## 5.6 Amendments to Parts 1–2 (third round of falsified claims)

- **M1.4 "Replay tour" — already built** (Settings → Guide → Start tour). Downgraded to discoverability check.
- The M8 vaginal-health removal recommendation is now **downgraded pending 5.3**: its gap analysis assumed Symptoms/Testing/Episodes coverage without opening them.
- Two more of the feedback's "missing edge cases" likely have the same shape as biometrics/Backup — the second pass must start with a "is this already built?" grep before any item reaches the plan.

## 5.7 Recommended second-pass script (replaces the ad-hoc list in Phase 5)

**Order = risk × recency × dependency on pending decisions:**
1. **Safety Share** (new, safety-critical, owner-flagged)
2. **Backup/restore/export full round trip** (pairs with D2/M9 — do before Phase 3)
3. Contacts + Partner Notification
4. Medication (banner actions included)
5. The 9 unopened Healthcare sub-tabs — *then* revisit the M8 decision
6. Settings: already walked (5.4) — skip the screen tour; exercise only the Tier D flows behind it (backup round trip, App Lock lifecycle, clear/restore)
7. Tier D scripted flows (at least #1, #4, #5, #6)
8. Guide/Interactive Tour + Home quick-adds rework + Share My Profile overlay (Tier A leftovers)

Each surface gets the same three-part critique format (works / polish / edge cases) **plus** an axe-core pass **plus** a "already built?" verification. Findings land in `BACKLOG.md`/`AUDITS.md`, and `audit-tracker.json` gains a `beta_walkthrough` axis so this coverage survives the next compaction.

---

*End of report. Next action: owner decisions D1–D4 and verification pass V1–V2 (Phase 0), then the Part 5.7 second-pass script (Phase 5).*
