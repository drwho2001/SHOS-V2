# Beta review — 17 Nov 2026 (index)

Fresh-install walkthrough (demo data), full code/docs audit, and ranked fixes. Nothing in this folder is auto-loaded; read the file you need.

- **`BETA-ACTION-PLAN.md`** — start here. Ranked fixes R1–R13 with effort/risk, owner decisions, sequencing.
- **`CONSOLIDATED-BACKLOG.md`** — START HERE for next work. One ranked, challenged list of everything open, reconciling PLAN.md / device-audit findings / beta R-items / approved axes, with rejected items marked so they are not rebuilt.
- **`AUDIT-2026-11-17.md`** — the live walkthrough: every screen/form/toggle, dark + light, findings with code refs.
- **`BETA-FEEDBACK-REPORT.md`** — analysis of the Gemini transcript (challenges, plan, coverage gap).
- **`BETA-TESTER-CRITIQUE.md`** — module-by-module good/bad/missing appraisal.
- **`FSRH-ARCHITECTURE-BRAINSTORM.md`** — reproductive-health trio structure; owner decisions; guideline-alignment constraints.
- **`DESIGN-TEMPLATE-REVIEW.md`** — Evaluates whether modules follow the "Encounters is the template" rule; form coverage.
- **`PLATFORM-PARITY-REVIEW.md`** — native vs web limits (biometrics, calendar sync, APK link), think/challenge/plan/fix.
- **`REVIEW-ANSWERS.md`** — direct answers to the owner's review questions.
- **`AXES-BRAINSTORM.md`** — honest review of axes under-covered by the audit (lifecycle, recovery, a11y, responsive, clinical).
- **`CLINICAL-RESEARCH-2026-11-17.md`** — RCOG/NICE/FSRH checks + user-preference research + self-challenge (period/hormone/PMB wording).
- **`INVESTIGATIONS-2026-11-17.md`** — dialog-stack re-verification, contactMerge verified-wired, 13px guard finding, CI smoke banner/FAB overlap root cause + fix verification.
- **`CLINICAL-RESEARCH-2026-11-17.md`** — RCOG/NICE/FSRH checks + user-preference research + self-challenge.
- **`screenshots/`** — 28 captured screens (dark + light, list/detail/form).

Shipped from this review: the "No barrier method" canonical label + search/filter, the update-banner dismiss fix, and the web biometric gating (see `docs/HISTORY.md`, 17 Nov entries). Owner decisions are in `BACKLOG.md` under "17 Nov 2026".

**Verification (17 Nov):** full `npm run verify` — build, lint, 2165 unit tests across 202 files, encoding, negative-status, inherited-instructions and docs-in-sync all PASS. Smoke suite SKIPPED locally (320 MB free RAM, below the ~700 MB floor); CI runs it on push. Do not read the skip as a failure.

**Uncommitted work from a prior session (reviewed 17 Nov, all legitimate — keep):**
`calendarSyncService.js` (try/catch around `findEvents` for the Capacitor calendar crash), `encounterRepository.js` + `seedDivergence.js` (`WOULD_MEET_AGAIN` "Fuck YES 💖" → "Absolutely"), `customOptionListsRepository.js` (He/they + She/they pronouns), `appPreferencesRepository.js` (`includeArchivedInContactCount`), `DESIGN-MANUAL.md` (solid-surfaces principle #7), `.opencode/opencode.json` (formatting only). These match decisions already recorded in `BACKLOG.md`'s "5 backlogged items / Updated action list". Lint clean.
