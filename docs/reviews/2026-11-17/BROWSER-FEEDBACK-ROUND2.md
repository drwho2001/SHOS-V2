# Browser feedback round 2 (17 Nov 2026) — owner comments + triage

Concrete fixes and conceptual challenges from the owner's live review.

## A. Concrete fixes (do them)
| # | Owner comment | Where | Action |
|---|---|---|---|
| A1 | Confirm card needs ~6px space above it | `ConfirmDeleteCard` when it replaces the button row | Add ~6px top margin via margin prop / dedicated spacing |
| A2 | "Log all due routine meds" limited to daily meds — shouldn't include PRN, but should include BD, TDS, QDS | Home quick-add / due-meds logic | Fix the due-meds predicate: include all scheduled frequencies (BD/TDS/QDS = twice/three/four times daily), exclude PRN ("as needed"). **Investigate current logic first.** |
| A3 | Medications module has horizontal scroll — wrong | Medication screen layout | Find overflow source and remove (wrap instead of scroll) |
| A4 | INFERRED banner spacing awkward — make one line: "INFERRED — not confirmed: PrEP coverage is…" | Encounter list PrEP warning | Reformat to single line / header + text, no awkward gaps |
| A5 | "·" renders as a lone period — what is it? | Encounter card byline | Identify the empty value producing a stray separator; hide when empty |
| A6 | Add end time to encounter card | Encounter card | Show end time if present (e.g. "8:30 PM – 10:00 PM") |
| A7 | Ash (incomplete mandatory fields) should sort first? | Contacts list sort | Question — decide with owner; likely "needs attention" sort option rather than default change |
| A8 | Move Attachments to last: Episodes, Calendar, Clinic Card, Attachments | Healthcare sub-tab order | Reorder the bottom link row |

## B. Conceptual — challenge & brainstorm (think, don't rush)
- **B1 — Testing vs Measurements linkage.** Owner's point: eGFR is a *urine test* whose result appears as a **measurement**. Currently no link between Testing and Measurements. Are they really separate concepts? Some measurements are test-derived (eGFR, blood glucose from a lab, viral load, CD4), others are not (weight, BP). Missing deep link: from a test result → the measurement it produced, and vice versa. Need a design that links without merging the modules (they serve different purposes). **Challenge and brainstorm.**
- **B2 — Measurement type question.** "What kind of measurement is eGFR? Helps suggest sensible units" — most users won't know. Owner suggests: a bank of standardised tests/units, fuzzy match, suggest. **Challenge and brainstorm** (this echoes the earlier LOINC suggestion I dropped — but this is different: it's helping the USER at input time, not a hidden code field).

## C. Process note
- Local preview (port 4173) went down — I killed it during cleanup; owner switched to deployed URL `https://drwho2001.github.io/SHOS-V2/`. That build does NOT contain my newest local fixes (restore/contrast/theme guard) until CI deploys. Rebuild + restart preview when doing the next visual checks.

## Status after fixes (17 Nov)
- A1 DONE — confirm card margin 6px top (Home + Developer tools).
- A2 CHALLENGED — not a bug: `getDailyMedsState` already includes BD/TDS/QDS via `24/dosesPerDay` and excludes PRN. Only a wording tweak possible. See CHALLENGE-TESTING-MEASUREMENTS.md.
- A3 OPEN — medications horizontal scroll: no fixed-width culprit found in code; needs visual re-diagnosis (local preview was down; owner used the deployed build). 
- A4 DONE — INFERRED banner now one continuous text line.
- A5 DONE — stray · before encounter type now conditional.
- A6 NOT A BUG — end time already shown when `dateEnd` exists; the probed record simply had none.
- A7 OPEN — sort: needs owner decision (default "needs attention" sort vs a filter option).
- A8 DONE — order now Episodes, Calendar, Clinic Card, Attachments.

*No clinical advice. UK-first.*
