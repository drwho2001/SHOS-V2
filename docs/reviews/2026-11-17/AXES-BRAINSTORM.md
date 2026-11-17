# Axes brainstorm — what else we never looked at (17 Nov 2026)

**OWNER APPROVED all axes items (17 Nov).** Treat §1–§6 as accepted work; the ranked fixes are in `BETA-ACTION-PLAN.md`. Priority correction from the approval: lifecycle/data-recovery (§2–§3) ranks ABOVE cosmetic R10–R12. Guarding principle for §6: no clinical decision support.

Brutal, constructive, honest. The audit was thorough on *screens and forms*, but "thorough on screens" ≠ "complete product review". Here are the axes genuinely under-covered, with a verdict on each.

## 1. Platform parity — partly covered now, but the list is longer
Just fixed: biometric toggle on web (was offered and failed on tap). Still open:
- **Calendar write-sync on web** — 4 toggles in `CalendarScreen.jsx` call `@capacitor/calendar` which no-ops on web. Are they reachable in the deployed build? I only saw the read-only month grid in this browser. **Unverified — do not assume.**
- **"Download APK" link on web** — irrelevant (web auto-updates via Pages). Queued R1.
- **Screen security / FLAG_SECURE** — native-only (`screenSecurityService.js`), and the "Allow screenshots" toggle's availability on web was not checked.
- **Native share sheet / folder export / install prompt** — fallbacks exist in code but were not exercised on web.
- **Verdict:** one platform fix shipped; four unverified. Do not claim platform parity.

## 2. Lifecycle / state transitions — essentially untested
- Cold start with an **unlocked vault** vs **locked** vs **wrong key** refusal (`App.jsx:309`) — never triggered.
- **App re-lock after background/timeout**, "Skip re-verification briefly" timer — never exercised.
- **Upgrade/migration across versions** — `backupMigrations.js`, seed-id migration, old backups containing `vaginalHealth` — only reasoned about, never run.
- **Storage quota exhausted** — `save()` returns a boolean; the repo's own history says call sites fire-and-forget. No test of the user-visible failure path.
- **Verdict:** these are higher-risk than most R-items because they are about data loss, not layout. Rank them above cosmetic R10–R12.

## 3. Data integrity — partly covered by code, not by live testing
- **Backup → export → import round trip** — the highest-stakes flow, deliberately not triggered (external action). Owner must do this on-device.
- **Restore from backup on a fresh install** — untested end-to-end.
- **Undo / trash restore** — the Trash screen says "30 days"; the restore action was never used.
- **Long-press batch archive/delete/export** — never exercised.
- **Orphan references / "records worth a look"** — Developer tools showed 3 flagged records; I did not inspect them.
- **Verdict:** the audit's strongest claim ("app works") is weaker than it sounds: writes persisted, but the full recovery path is unproven.

## 4. Accessibility — only touched via a11y tree, not assistive tech
- Screen reader labels/roles were read from the tree, but no actual screen-reader pass.
- **Focus order** in dialogs, keyboard-only navigation — never tested.
- **Reduced motion** — never toggled at OS level.
- **Font scale** (native `MainActivity` wires it) — never tested; large text will break the dense cards.
- **Colour-blind palette** — toggled on web, never visually verified across screens.
- **Light mode** — one Home + Colour scheme screenshot only; the rest of the app in light mode was not re-reviewed.
- **Verdict:** "axe-core wasn't run" is the honest headline. The repo has axe findings in its history; this audit added none because it didn't run axe.

## 5. Responsive / fit-to-screen — one viewport only
- Everything viewed at 742×620. **No wide/desktop viewport** (no resize tool), no landscape (405dp — manual warns cards overflow), no phone-small (360px).
- The owner's new question: "which pages should not need scrolling, e.g. calendar?" — the Calendar dialog is `overflowY:auto` with a `maxHeight:80vh` sub-sheet and a month grid; on a short viewport it scrolls. A month grid should ideally fit; but forcing `overflow:hidden` would hide the event list. This needs a responsive rule, not a blanket.
- **Verdict:** one viewport was tested. Claiming "responsive" would be dishonest.

## 6. Clinical / safety — deliberately not given
- Menopause wording alignment (NICE/FSRH/RCOG) is **planned**, not written or reviewed.
- No clinical advice was given anywhere in this audit; that boundary held.
- DoxyPEP 72h window, PrEP coverage inference, retest-date suggestions — all displayed but never fact-checked against current guidance in this pass.
- **Verdict:** fine to defer, but be explicit that "aligned with guidelines" is a *plan*, not a shipped property.

## 7. Documentation / process — now cleaned
- Eight root-level report files were an artifact sprawl mistake; consolidated to `docs/reviews/2026-11-17/`.
- Docs gate, negative-status guard, and the other session's half-finished i18n edit all surfaced real defects — fixed (i18n suffix spacing, two negative-status lines).
- **Verdict:** the repo's own gates caught more real bugs than my visual walkthrough did. Respect them.

## 8. Tests / verification discipline
- New barrier code has 12 new unit tests, verified non-vacuous by reasoning; a literal revert-to-fail was not run (workflow recommends it before commit).
- No e2e/smoke coverage was added for the new "No barrier" filter chip.
- The fast gate is the truth; until it is green, nothing is done.

## 9. Honest overall verdict
- The audit is **excellent on visible UI and adequate on form behavior**, weak on lifecycle/recovery, accessibility, and responsiveness.
- The barrier fix is small, tested, and correct; the architecture decisions are recorded and **none of the big ones are built**.
- Anyone reading the reports should not conclude "the app is fully verified". It is not, and the reports now say so explicitly.
