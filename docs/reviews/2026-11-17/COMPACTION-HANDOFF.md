# COMPACTION HANDOFF — SHOS, 18 Nov 2026

**Purpose:** everything needed to resume with no lost context. Read this file first, then the specific docs referenced.

## Current state
- Working tree **clean**; HEAD = `4ae7962` ("Remove PEP protection entirely; About email-only + icon/build date; encounter field gating"), pushed to `main`.
- CI on `4ae7962` was still running at handoff (Session Bus green; Smoke/Web Alpha/APK in flight). **Check `gh run list --branch main --limit 4` on resume.** Prior smoke failures were root-caused and fixed (styleColourGuard, healthcareCalendarShortcutGuard, PWA auto-update dismiss flag, flow-2 timing race); if CI is red again, read `gh run view <id> --log-failed` before changing code.
- Local verification at handoff: eslint clean, 44 targeted tests pass, `vite build` success, negative-status + encoding guards pass. Full local smoke is memory-starved; CI is the gate.

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

## OPEN DECISIONS (presented via popup — answers not yet known at handoff)
- A1 Home status-card description text size (bump for legibility/space-fill?)
- A4 Calendar grid shrink + reserve space for selected-day detail
- B1 `seed_contact_9008` row (orphan diagnostic showing dangling id — expected behaviour?)
- B2 verify fists/loads kink wiring actually works
- A7 contacts sort — "needs attention" default vs a filter option
- Testing↔Measurements `sourceTestId` link (e.g. eGFR result → measurement)
- Measurement-type suggestion bank (fuzzy match standard units instead of "what kind is eGFR?")
- F3 menopause patient-facing copy sign-off (draft in F3-MENOPAUSE-COPY-DRAFT.md)
- Overall next-build order / scope for the next session

## KEY CONVENTIONS (from CLAUDE.md — obey)
- Docs gate: any `src/` change must also touch CLAUDE.md or docs/. One home per truth (state map at top of CLAUDE.md).
- Commit messages: what was wrong / why / what I got wrong first / verification. Footer: `Co-Authored-By: OpenCode AI opencode-go/hy4-flash-free <no-reply@local>` + `AI-Session: local-opencode-session`.
- `git status` first; stage explicit paths only; never `git add -A` (two-session history).
- Local `--fast` gate times out (unit tests ~790s); CI is truth. Encoding guard = `node scripts/check-encoding.cjs`.
- UK-first; US compatibility as agreed. No clinical advice or decision support.
- Workstyle: one change, test between each; challenge findings before building; record mistakes.

## DOCS INDEX (`docs/reviews/2026-11-17/`)
README.md (index) · CONSOLIDATED-BACKLOG.md · BETA-ACTION-PLAN.md · AUDIT-2026-11-17.md + screenshots/ · BETA-FEEDBACK-REPORT.md · BETA-TESTER-CRITIQUE.md · FSRH-ARCHITECTURE-BRAINSTORM.md · PLATFORM-PARITY-REVIEW.md · REVIEW-ANSWERS.md · DESIGN-TEMPLATE-REVIEW.md · AXES-BRAINSTORM.md · CLINICAL-RESEARCH-2026-11-17.md · F3-RESEARCH-CHALLENGE.md · F3-MENOPAUSE-COPY-DRAFT.md · DEEPLINKS-AUTOMATION-INTEROP.md · CHALLENGE-OF-INTEROP-PLAN.md · DECISIONS-ROUND3.md · WIDGET-BRAINSTORM.md · BROWSER-FEEDBACK-ROUND2.md · CHALLENGE-TESTING-MEASUREMENTS.md · BROWSER-FEEDBACK-ROUND3.md · this file.
