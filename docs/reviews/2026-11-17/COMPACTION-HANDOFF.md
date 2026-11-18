# COMPACTION HANDOFF — SHOS, 18 Nov 2026

**Read this first after compaction.** Then `BETA-ACTION-PLAN.md` for per-item detail, and `CONSOLIDATED-BACKLOG.md` for what remains.

## Current state
- Working tree **clean**; HEAD = `287bb7e` ("Docs: long chip-row consolidation outcome"), pushed to `main`.
- Last local gate: **74 guard files / 443 assertions pass**, `eslint src` clean, `vite build` success, encoding + negative-status guards pass. Full local smoke is memory-starved; CI is the gate.
- CI at last check: Web Alpha + Session Bus GREEN, Build Android APK + Smoke in flight on the final commits. If red on resume: `gh run view <id> --log-failed` before editing.
- Lesson that kept CI green this session: **run every `*Guard/*Coverage` test file locally before pushing** — it caught four gate failures that would otherwise have landed (build-date allowlist, frozen pregnancy seed snapshot, style colours, stored-date arithmetic).
- ADB: device connected over wireless debugging (Redmi Note 13 / Android 15 / 1080×2400 / `com.shos.app`). It drops and reconnects; if `adb devices` is empty, `adb reconnect` fixes it. Screenshots must be taken with `adb shell screencap -p /sdcard/x.png` + `adb pull` — PowerShell `>` redirection corrupts the PNG as UTF-16.

## Built this session (all pushed; detail in BETA-ACTION-PLAN.md)
- CI `__BUILD_DATE__` allowlist; Home polish A1–A4; R9 period overlap; contacts mandatory-first within Incomplete; B1 investigated (raw ID correct, no change).
- Testing↔Measurements link — challenged as already built; no rebuild. Measurement-type bank built.
- R5 hCG; R7 vaginal-health removal + migration shim; Import v1; F4 cycle-stats context; menopause status + spotting prompt; Clinic Card PDF challenged as already built.
- R2/R4/R8/R10/R11/R12; 13px tokenisation (137 sites); F1 rename; F2 Testing-owned pregnancy tests; P3 hygiene.
- F3 episode-scoped stop-reminding (FIGO consecutive-day rule); Maps handoff improved with Google's verified menu path (no direct live-share URL exists — both candidates 404).
- M4 follow-up: compact 2-row Healthcare tab bar + "More ▾" overflow, genuine per-tab stats, pregnancy link under the tab row, Testing "Other" free text.
- Long chip rows condensed app-wide via one `chipVisibility.js` rule (chosen first, cap 8, `more +N`/`less`) across all five `MultiSelectChips` copies.
- Symptom self-care bank BUILT (was deferred): `calculations/symptomSelfCare.js` is the single owner of plain label + explanation + holistic self-care + source per menstrual symptom; the approved "sooner" line is one exported constant. `components/SymptomSelfCareNote.jsx` is a keyed tap-to-reveal info dot (same disclosure pattern as JargonNote/HivStatusNote; unknown keys render nothing) wired into Symptom Log detail and the cycle form. Resources gained one per-symptom entry under Menstruation & menopause using only links opened and verified live 18 Nov (two missed/no-period candidates 404'd and were dropped; "Feeling sick" left blank honestly). No per-condition repositories. 16 new tests pass.
- Verify/close audit: 0al, 0ao, 0ae, 0u, 0v, 0z all confirmed already fixed in code — no rebuild needed.
- Device verification: A2 rows, F1 rename, F4 cards, F2 pregnancy→Testing prefill, Maps handoff, Testing "Other", 2-row tabs, per-tab stats, pregnancy link all confirmed on the phone. Device-only bug found and fixed: Healthcare's local `T` had no `textPrimary`, making the More menu text near-invisible.

## Decisions (all recorded; no undeclared changes)
- Owner is a **clinician** and reviewed the patient-facing wording.
- **Clinical copy:** "consider mentioning it to a doctor or nurse" → **"it's worth mentioning to a clinician sooner"** (time reference, no alarm). Applied to the live spotting prompt.
- **Episode rule:** FIGO-aligned — a bleeding/spotting episode = consecutive days; a bleeding-free day starts a new one. This resets the stop-reminding acknowledgement.
- **Maps:** open Google Maps + on-screen steps (no URL opens the live-share interface).
- **Chip rows:** cap 8, chosen chips first, `more +N`; selected tag chips / searchable pickers / short filter rows deliberately left visible.
- **Healthcare tabs:** shrink pills + More overflow; full per-tab stats; pregnancy link under the tab row. Header standardisation (0b) deferred.
- **Symptom self-care bank:** BUILT 18 Nov (see above). Owner chose "bank + Resources entries" over deferring. Design rationale in `PATIENT-TEXT-ARCHITECTURE.md` still holds: no per-condition repositories, one keyed words module, Resources keeps links.
- **BACKLOG 0b (header icon-set standardisation):** owner chose "do it now" — NEXT task after this commit.
- **P0 recovery checks (phone):** owner's chosen first device group when the phone is available — fresh-install import, locked-vault cold start, old-backup migration, storage quota.
- Earlier decisions: A1 bump, A4 shrink+reserve, B1 investigate-first, contacts sort within-Incomplete, Testing↔Measurements link, measurement bank, F3 copy approved, R9 first.

## Remaining work
- **Next, approved:** BACKLOG 0b header icon-set standardisation (Home/Encounter/Healthcare) with guard coverage.
- **Needs a phone:** P0 recovery A1–A4 (first priority), accessibility AX1–4, responsive RS1–3, platform parity PP1–3, final on-device check of the `more +N` chip and the new info dots.
- **Needs a phone / real data:** P0 recovery A1–A4 (fresh-install import, locked-vault cold start, old-backup migration, storage quota); accessibility AX1–4; responsive RS1–3; platform parity PP1–3.
- **Device-audit tail (0p–0av):** Contacts 0p/0q/**0r save-bar overlap (HIGH)**/0s/0t/0aa–0ab; Safety Share **0y checkbox double-toggle (HIGH)** (0u/0v/0z likely covered — verify); Encounters 0ac/0ad/0ae; Stats/Calendar 0af–0ai; Settings 0aj/0ak/0al/0am (0al likely already fixed); Lists 0an/0ao (likely already present); Design 0ap rejected, 0aq–0av FAB overlaps.
- **Verify/close rather than rebuild:** 0al, 0ao, 0ae, 0u, 0v, 0z.

## Conventions (from CLAUDE.md — obey)
- Any `src/` change must also touch CLAUDE.md or docs/. One home per truth.
- Commit messages: what was wrong / why / what I got wrong first / verification. Footer:
  `Co-Authored-By: OpenCode AI opencode-go/hy4-flash-free <no-reply@local>` and `AI-Session: local-opencode-session`.
- `git status` first; stage explicit paths only; never `git add -A` (two-session history).
- UK-first; US compatibility as agreed. No clinical advice, diagnosis, triage or decision support.
- One change, test between each; challenge findings before building; record mistakes.

## Docs index (`docs/reviews/2026-11-17/`)
README.md · BETA-ACTION-PLAN.md (per-item detail) · CONSOLIDATED-BACKLOG.md (what remains) · COMPACTION-HANDOFF.md (this file) · AUDIT-2026-11-17.md + screenshots/ · BETA-FEEDBACK-REPORT.md · BETA-TESTER-CRITIQUE.md · FSRH-ARCHITECTURE-BRAINSTORM.md · PLATFORM-PARITY-REVIEW.md · REVIEW-ANSWERS.md · DESIGN-TEMPLATE-REVIEW.md · AXES-BRAINSTORM.md · CLINICAL-RESEARCH-2026-11-17.md · F3-RESEARCH-CHALLENGE.md · F3-MENOPAUSE-COPY-DRAFT.md · DEEPLINKS-AUTOMATION-INTEROP.md · CHALLENGE-OF-INTEROP-PLAN.md · DECISIONS-ROUND3.md · WIDGET-BRAINSTORM.md · BROWSER-FEEDBACK-ROUND2.md · CHALLENGE-TESTING-MEASUREMENTS.md · BROWSER-FEEDBACK-ROUND3.md · B1-ORPHAN-INVESTIGATION.md · PATIENT-TEXT-ARCHITECTURE.md.
