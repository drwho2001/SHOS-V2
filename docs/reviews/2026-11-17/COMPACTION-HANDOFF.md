# COMPACTION HANDOFF — SHOS, 18 Nov 2026

**Purpose:** everything needed to resume with no lost context. Read this file first, then the specific docs referenced.

## Current state
- Working tree **clean**; HEAD = `4ae7962` ("Remove PEP protection entirely; About email-only + icon/build date; encounter field gating"), pushed to `main`.
- CI on `4ae7962` (and the handoff-doc commit `533f3c4`): **Web Alpha + Build Android APK are RED**, Smoke was in flight at handoff. Cause is known and mechanical: I added `__BUILD_DATE__` (Vite `define` + eslint global) for the About build date, but the repo's `src/components/jsxIdentifierBindingGuard.test.js:40` has its own `ALLOWED_GLOBALS` set (contains `__BUILD_SHA__`, `__APP_VERSION__`) and does not include `__BUILD_DATE__`, so the guard fails. **FIRST ACTION ON RESUME (no decision needed):** add `"__BUILD_DATE__"` to that set (same place as `__BUILD_SHA__`), run `npx vitest run src/components/jsxIdentifierBindingGuard.test.js`, commit + push. Then re-check CI. No other policy decisions are pending — all were answered in the last popup and recorded below. Prior smoke failures were root-caused and fixed (styleColourGuard, healthcareCalendarShortcutGuard, PWA auto-update dismiss flag, flow-2 timing race).
- Local verification at handoff: eslint clean, 44 targeted tests pass, `vite build` success, negative-status + encoding guards pass. Full local smoke is memory-starved; CI is the gate.

## SHIPPED THIS SESSION (18 Nov, on top of the list below)
- CI fix: `__BUILD_DATE__` added to `jsxIdentifierBindingGuard.test.js` ALLOWED_GLOBALS.
- Home polish A1–A4 (card text, activity reorder + DoxyPEP row, desktop greeting, calendar shrink).
- R9 period overlap guard (open prior record to add end date, estimate escape, save-time re-check).
- Contacts "Incomplete" sort: mandatory-missing contacts now precede optional-only ones; default sort untouched.
- B1 investigated (`B1-ORPHAN-INVESTIGATION.md`): raw `seed_contact_9008` ID is CORRECT diagnostic behaviour for a genuinely hard-deleted contact; no code change warranted (owner asked investigate-first).
- Testing↔Measurements link: CHALLENGE FINDING — already fully built (`linkedTestId`, inline add from Testing, unlink on delete, orphan check). No rebuild; `testingMeasurementLinkGuard.test.js` locks it.
- Measurement-type suggestion bank built (`measurementTypeBank.js`): local fuzzy bank with aliases, confirm-before-apply; manual kind prompt retained.
- R5 hCG: pregnancy entries now have sampleType (Urine default / Blood), optional serum hCG mIU/mL (Blood only), and brand; additive schema so no migration; FSRH Testing-ownership refactor still separate.
- R7 (D1=B): Vaginal health tab removed; one-time `vaginalHealthMigration.js` copies real records to Symptom Log losslessly; repository kept as read-only backup shim; old UI module retained unimported/deprecated.

## SHIPPED (do not rebuild)
- Update banner dismiss fix (one encrypted cooldown key/format) + APK link removed on web; banner raised above FAB (CI flow 21).
- "No barrier method" canonical label; enc search/filter. Shared theme-key hardening + guard.
- R3 reversible demo-data clear (snapshot + Restore in Home banner + Developer tools).
- Legible confirm buttons (white-on-white fix) across all ~15 delete confirmations.
- Round-2 visual fixes: 6px confirm spacing, single-line INFERRED, conditional stray `·`, Healthcare order Episodes/Calendar/Clinic Card/Attachments.
- Round-3 fixes: removed misleading testing-trend insights from Stats; encounter Loads/Fisting fields conditionally revealed; smoke flow-2 race fixed.
- PEP removed entirely from protection vocabulary (no migration — no real entries existed). About: email-only reporting, app icon, build date, spacing.
- Widget brainstorm doc written; **no widget/deep-link code shipped** (decision: wait for a real widget).

## CHALLENGED — not bugs, do not "fix"
- R6 dialog stack = test artifact (real-UI Back closes sub-screens correctly).
- A2 "routine meds excludes BD/TDS/QDS" — already handled by `24/dosesPerDay`, PRN excluded.
- A6 "add end time" — already shown when `dateEnd` exists.
- A8 About subtitle expansion — deliberately vague (owner preference).
- B5 barrier tags — keep single "No barrier method" (separate domains, don't conflate).
- C2 HIV/ART — Medication module is enough; no new module.

## APPROVED but NOT BUILT (ordered)
1. **Home polish A2/A3** — desktop-only "X's Home" greeting, reorder recent activity (Newest contact above Last encounter), add last-DoxyPEP-dose row.
2. **R9 period overlap** — opening a second period while one is ongoing opens the first record to enter its end date (no auto-close), with "I don't remember → estimate duration" escape + plain explanation.
3. **F4 cycle stats** — annotate averages for hormonal contraception, soften (not hide) the "irregular" advisory, never call 2 cycles "irregular".
4. **R5 hCG** — urine default + optional quantitative serum value; Testing-owned.
5. **R7 vaginal health removal** (D1=B) — fold into Symptoms/Testing/Episodes, read-only backup shim one release, migration test.
6. **Import v1** — SHOS own export round-trip + Clue-format CSV, on-device, preview-before-save, explicit UK/US date format; synthetic Clue sample data for tests.
7. **Clinic Card doctor summary** — extend existing export into one-page report; no new module.
8. **Menopause status** — My Profile + NEVER_SHARED + read-only FSRH view + optional neutral hysterectomy/no-uterus field; patient-facing copy needs sign-off.
9. Other queued: R2 icon 404s/CSP, R4 summary cards + allergies green outline, R8 transient zero counts, R10 onboarding polish, R11 Safety Share empty fields, R12 consistency nits, 13px tokenisation (after this batch, with the new guard).

## DECISIONS — ALL ANSWERED in the final popup (no pending policy questions)
- **A1 Home card text:** BUMP the description font size. ✅ approved.
- **A4 Calendar:** SHRINK cells AND reserve space for selected-day detail. ✅ approved.
- **B1 `seed_contact_9008`:** INVESTIGATE FIRST (not auto-change) — confirm whether this dangling reference should be repaired; raw ID may be correct diagnostic behaviour. ⏳ task.
- **Contacts sort (A7 clarified):** owner does NOT want a sort change — keep newest-first. The point was about the INCOMPLETE badge/order *within* incomplete records: those missing **mandatory** details must be listed before those missing only **non-mandatory** details. Treat as a presentation/order-within-incomplete fix, not a global sort change. ⏳ task.
- **Testing↔Measurements:** ADD the optional link (`sourceTestId` on measurements + "record as measurement" on results), keeping both modules separate. ✅ approved.
- **Measurement-type suggestions:** ADD the local bank + fuzzy match, manual entry retained. ✅ approved.
- **F3 menopause copy:** APPROVED as drafted (F3-MENOPAUSE-COPY-DRAFT.md). ✅ approved.
- **Next build after Home polish A2/A3:** **R9 period overlap** first. ✅ decided.

## BUILD ORDER for next session (after the CI fix above)
1. CI fix (`__BUILD_DATE__` allowlist) — mechanical, do first.
2. Approved Home polish: A1 bump card text; A2 reorder recent activity + DoxyPEP row; A3 desktop "X's Home"; A4 Calendar shrink + detail space.
3. R9 period overlap (open first record to enter end date, no auto-close, "I don't remember → estimate duration" escape).
4. Contacts incomplete-ordering fix (mandatory-missing first among incomplete).
5. B1 investigate orphan `seed_contact_9008`.
6. Testing↔Measurements link + measurement-unit suggestion bank.
7. Then the rest of the approved-not-built list above (R5, R7, import, Clinic Card, menopause status).

## NO FURTHER QUESTIONS NEEDED — the owner asked "any other qs first?" and all policy decisions are now captured above.

## KEY CONVENTIONS (from CLAUDE.md — obey)
- Docs gate: any `src/` change must also touch CLAUDE.md or docs/. One home per truth (state map at top of CLAUDE.md).
- Commit messages: what was wrong / why / what I got wrong first / verification. Footer: `Co-Authored-By: OpenCode AI opencode-go/hy4-flash-free <no-reply@local>` + `AI-Session: local-opencode-session`.
- `git status` first; stage explicit paths only; never `git add -A` (two-session history).
- Local `--fast` gate times out (unit tests ~790s); CI is truth. Encoding guard = `node scripts/check-encoding.cjs`.
- UK-first; US compatibility as agreed. No clinical advice or decision support.
- Workstyle: one change, test between each; challenge findings before building; record mistakes.

## DOCS INDEX (`docs/reviews/2026-11-17/`)
README.md (index) · CONSOLIDATED-BACKLOG.md · BETA-ACTION-PLAN.md · AUDIT-2026-11-17.md + screenshots/ · BETA-FEEDBACK-REPORT.md · BETA-TESTER-CRITIQUE.md · FSRH-ARCHITECTURE-BRAINSTORM.md · PLATFORM-PARITY-REVIEW.md · REVIEW-ANSWERS.md · DESIGN-TEMPLATE-REVIEW.md · AXES-BRAINSTORM.md · CLINICAL-RESEARCH-2026-11-17.md · F3-RESEARCH-CHALLENGE.md · F3-MENOPAUSE-COPY-DRAFT.md · DEEPLINKS-AUTOMATION-INTEROP.md · CHALLENGE-OF-INTEROP-PLAN.md · DECISIONS-ROUND3.md · WIDGET-BRAINSTORM.md · BROWSER-FEEDBACK-ROUND2.md · CHALLENGE-TESTING-MEASUREMENTS.md · BROWSER-FEEDBACK-ROUND3.md · this file.
