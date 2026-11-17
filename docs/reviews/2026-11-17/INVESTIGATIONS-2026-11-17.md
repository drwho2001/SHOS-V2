# Investigations from the owner's Q&A (17 Nov 2026)

## 1. R6 "dialog stack" — likely a TEST ARTIFACT, not a product bug (challenge to owner)
The owner answered "treat as a bug". Investigation suggests otherwise:
- Settings sub-screens are conditionally rendered `{showX && <XScreen/>}` (`SHOS_Settings_Prototype.jsx:1000-1050`). When false they are unmounted.
- `goBackOneLevel()` (`:685-712`) closes the topmost sub-screen on Back/Escape, then Settings itself; `useEscapeToClose` wires it (`:717`).
- I saw 3 dialogs all `display:block` only after I **clicked multiple Settings rows via DOM `dispatchEvent` without pressing Back between them** — a synthetic click bypasses the visual occlusion that would stop a real user, so I set `showDesign`, `showDevTools`, etc. true simultaneously. A real user cannot click a row behind an open sub-screen.
- **Recommendation:** do NOT change code. Re-verify through the real UI: open Colour scheme → tap its Back → open Developer tools → confirm only one dialog is present. Only fix if a real user can reproduce. (Recorded so the next session does not "fix" a non-bug.)

## 2. contactMerge.js — VERIFIED WIRED; close the stale backlog item
- `contactMerge.js` exports `detectDuplicateCandidates` / `duplicateCandidatePanel`.
- `SHOS_Contacts_Prototype.jsx` imports `duplicateCandidatePanel` (`:72`) and uses it for the all-contacts duplicate panel (`:3364`, dismissed-pair filtering `:3372-3377`) **and** a "Possible duplicate — check before saving a second entry" warning on save (`:2383-2392`).
- `contactMergeEvidenceGuard.test.js` asserts the panel works.
- Repo history already said "wired (duplicateCandidatePanel in use)". The BACKLOG "decide fate" line is **stale** — mark it shipped/closed, do not delete.

## 3. 13px tokenisation guard — NO GUARD EXISTS (owner's instinct correct)
- `TYPE` in `designTokens.js` defines 11/12/14/16/18/20/22 — **no 13**. There are 516 raw `fontSize: 13` sites; `App.jsx` alone has ~15.
- No test or CI check compares raw font sizes to TYPE; the only relevant comment (`designTokens.js:486`) describes conversion as a "follow-up pass". No `token guard` file exists.
- **The owner also asked whether a guard should account for light/dark, colour-blind and custom colour variants.** Answer: font size is orthogonal to colour — a typography guard should check only that sizes come from TYPE (or an approved exception list). Colour variants are handled by separate mechanisms: `resolveDarkAccent` (dark mode), the colour-blind palette toggle in `DesignScreen`, and per-module colour overrides — none of which change font size. So one simple guard ("no raw fontSize literals outside designTokens.js; allow a reviewed exception file") is sufficient. It does NOT need to encode colour variants.
- **Recommendation (for the 13px pass, after the current batch):** (a) add `TYPE.body = 13` (or map 13 → 14 after checking density); (b) convert the 516 sites with a Node script (UTF-8, not PowerShell); (c) add a vitest guard that scans `src/` for raw `fontSize: <number>`/px font-size and fails outside an allowlist; (d) run axe + the existing `iconOnlyUIAudit.test.js` pattern to keep it honest. Do it in one PR with lint/tests, as the repo requires.

## 4. CI status at time of writing
`git push` succeeded (`039ec87..5f48836`). GitHub Actions: Session Bus Health Checks (draft) = success; SHOS Smoke Test, SHOS Web Alpha, Build Android APK were still running. Smoke is the gate that covers what the local machine could not (low RAM).

*No code changed in these investigations. Owner decisions recorded in BACKLOG.md 17 Nov Q&A section.*
