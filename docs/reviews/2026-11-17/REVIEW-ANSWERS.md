# Review answers — 17 Nov 2026

Answers to the owner's questions after the beta audit + barrier fix. Evidence-based; every claim has a code ref or an audit section.

---

## 1. End alignment with Gemini's suggestions — what I did/didn't, and which were valid

Gemini produced ~30 findings across 10 modules. I did **not** treat them as instructions — several were wrong or already built. Full verdicts are in `BETA-FEEDBACK-REPORT.md` Part 1 + challenges. Summary:

**Valid and acted on (or queued):**
- Onboarding dots spacing, permission sub-note, abrupt finish → R10 (queued; replay-tour finding was FALSIFIED — already built in Guide).
- Home App Lock prompt stacking / biometrics mention → R2/R12 (biometrics already exist — only copy was stale).
- Update-banner overlap + one-tap backup → R1 (banner never dismisses — a real bug; Backup button already existed).
- Healthcare sub-tab wrapping + repeated summary cards → R4 (queued; sub-tabs wrap to 2 rows live).
- Add- contraception form height/side-effect severity → R5-adjacent (severity routed to SymptomLog per 13 Nov decision; severity DOES exist on SymptomLog — verified live).
- Log-period scroll depth / cycle-day badge → R10/queued (badge from `getCycleDay()` already exists in `menstrualCalculations.js`).
- Pregnancy test brand/sample type → R5 (hCG = urine default + serum value, owner confirmed).
- Vaginal health diagnosis-led framing/removal → D1=B (owner confirmed remove+migrate).

**Falsified by code/live (NOT done, correctly):**
- "Replay tour missing" — exists in Settings → Guide.
- "Biometric unlock missing" — `biometricAuthService.js` wired into App Lock.
- "No Backup in update banner" — button at `App.jsx:3316`.
- "Estimated ovulation window" — conflicts with the recorded medical-liability exclusion (fertility tracking excluded); rejected.
- "Side-effect severity chips in contraception modal" — severity already belongs to SymptomLog; chip badges would duplicate it.

**Where Gemini's context loss hurt it:** its final "unexplored views" list was incomplete. My systematic sweep found the gaps it listed *plus* Safety Share, Partner Notification, the tour, and all Settings sub-screens. Owner confirmed Settings WERE walked — the *notes* were lost, not coverage.

---

## 2. Sticky-tab issues on scroll — checked

Yes, checked in the live audit. **Finding (OBSERVED, audit section G, screenshots 08/09):** the Testing detail view has a sticky header (`STICKY_SUBHEADING_TOP = calc(env(safe-area-inset-top) + 58px)`, `designTokens.js:533`) but the sub-tab row in Healthcare is a separate sticky stack (`--shos-sticky-header-h`, `SHOS_Healthcare_Prototype.jsx:57-74, 264`). When scrolled in a detail view, content ("Date of treatment -" in my screenshot) was clipped behind the sticky tabs. This is a **real layout issue**, queued as part of R4/R12 (chrome height + sticky offsets), not yet fixed. Root cause worth naming for the builder: two independent sticky mechanisms (a CSS var on the Healthcare header and a fixed 58px token in detail sheets) can disagree — the fix is one shared measured offset, not two constants.

---

## 3. Status — built / ready / not done

| Item | Status |
|---|---|
| Barrier canonical label + search/filter (R13) | **BUILT** — 27 tests, eslint clean, build OK |
| Documentation (CLAUDE.md, HISTORY, audits, BACKLOG, Notion Dev Log) | **DONE** |
| Decisions D1–D4 + FSRH (option 3, menopause, move-to-Testing, cycle-context) | **RECORDED**, not built |
| R1–R12 | **READY** (ranked with effort/risk in `BETA-ACTION-PLAN.md`), not built |

Nothing was committed/pushed — the repo has the other session's in-flight files, so per `CHANGE-PROCEDURE.md` I did not stage anything. You commit when ready.

---

## 4. Objective critical review of my code

- `canonicalProtectionNames` calls `hasBarrierMethod(list)` then filters — O(n) twice over a tiny array; harmless, but a tidy reviewer would compute `real` once (already done) and reuse. No correctness issue.
- `NON_ANSWER_PATTERN` intentionally does a **whole-value** match so "Amsterdam" never matches "dam"; negated barriers reuse `NEGATED_BARRIER_PATTERN`. Tested both ways.
- Filter state reused `dateFilter` for a non-date filter (`"noBarrier"`); the comment now says so. Slightly overloaded name, not worth a rename.
- The filter's not-yet-loaded guard checks `protectionNameById.size > 0 || every encounter has no protection` — correct: an empty map can't make every record look barrier-free.
- No vacuous tests: the new cases fail if `canonicalProtectionNames` is reverted (would return `["None"]` / `["No condom"]`).

**Broader repo critical review (not my changes):**
- `App.jsx` is 3,694 lines; `SHOS_Contacts_Prototype.jsx` 4,245; `seedDivergence.js` 3,850; Encounters 2,805; Medication 2,788. That is the "module size" theme Gemini was circling — the repo already knows this (`CLAUDE.md:213-219`) and prescribes **extract further**, not "keep small". Contacts/Encounters/Medication are the biggest and the richest in cross-links — prime extraction candidates.
- `seedDivergence.js` (3,850 lines) is a calculation file with a huge embedded dataset; a candidate for data-file extraction, but it is a test-support/seeding tool — treat as low priority.
- Sticky offsets duplicated (see §2) — one of the exact "helper duplicated → bug fixed N times" patterns `CLAUDE.md:175-178` warns about. Consolidate to one measured offset.
- `showFilters` panel has only date chips; the new "No barrier" chip lives there. Fine.

---

## 5. What could be tidied / filed / organised

1. **Files created this session** are all at repo root (`AUDIT-2026-11-17.md`, `BETA-*.md`, `FSRH-*.md`, `REVIEW-ANSWERS.md`) + `audit-2026-11-17/`. Convention puts narrative history in `docs/` — consider moving the five reports into `docs/reviews/2026-11-17/` and keeping only a short index at root. Not required by the docs gate. I left them at root so you can see them.
2. **Sticky offset** → one source of truth (§2). Real bug class.
3. **Module extraction** → Contacts/Encounters/Medication into sub-components (§4).
4. **`dateFilter` name** → consider `listFilter` when next touched.
5. **BACKLOG.md** is 2,596 lines with old duplicate decision blocks; not something to rewrite casually (it's a record), but new decisions now go in dated sections — I used that pattern.

---

## 6. Other approaches / tasks before building

1. **Commit hygiene:** check `git status` and stage ONLY the three barrier files + the doc files; the other modified files (`seedDivergence.js`, i18n, appPreferencesRepository, customOptionListsRepository, encounterRepository, calendarSyncService, DESIGN-MANUAL, .opencode/opencode.json) are the other session's — do not sweep them up.
2. **Guideline alignment (your point 4):** I recorded the constraint — safe = user-entered status + neutral, dated, sourced wording aligned to NICE NG12 / FSRH / RCOG; out of scope = referral/triage decisions or risk scoring (permanently excluded in `CLAUDE.md:71-75`). Get owner sign-off on any patient-facing copy before shipping. Do not quote guidelines from memory — verify the current wording at build time and date the source comment.
3. **Test-the-test:** the workflow says revert the fix to confirm the test fails. Already reasoned above; do it concretely before commit if you want the belt-and-braces check.
4. **Build order I'd recommend:** R1 (banner) → R2 (console) → R13 is done → R3 (restore) → R5 (hCG) → D1 removal → FSRH moves (menopause + Testing ownership) last, since they touch the most screens.

---
*No clinical advice is given. No code beyond the barrier fix was changed. No commit/push was made.*
