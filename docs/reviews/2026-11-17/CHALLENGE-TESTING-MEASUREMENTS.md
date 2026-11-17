# Challenge: Testing vs Measurements, and measurement-type suggestions (17 Nov 2026)

Owner's point (plain): eGFR is a **urine test** whose result appears as a **measurement**. There's no link between Testing and Measurements. Are they really separate? Some measurements come from tests (eGFR, lab glucose, viral load, CD4); others don't (weight, BP). Also: "What kind of measurement is eGFR?" is a question most users can't answer — suggest a bank/fuzzy match instead.

## A2 — "Log all due routine meds" (challenge with evidence, NOT a blind fix)
Investigated before changing. The owner worried it was "limited to daily meds" and should include BD/TDS/QDS but not PRN. **The code already does exactly that:**
- `getDailyMedsState()` filters `usagePattern === "daily" || (custom && scheduleIntervalDays)`. PRN is `"prn"` → correctly excluded.
- `effectiveDoseIntervalHours()` returns `24 / dosesPerDay`, so BD (2)→12h, TDS (3)→8h, QDS (4)→6h are all handled by the same due logic.
- "Log all due routine meds" (Home) → `handleTakeAll()` → same `getDailyMedsState()`.
**Conclusion: no bug.** The word "routine" is deliberate (scheduled meds) vs PRN. If the owner wants a clearer label, "Log all due meds" (drop "routine") is a wording tweak only — but the behaviour is already correct. Do NOT change the filter.

## B1 — Testing vs Measurements: are they separate concepts? (challenge + brainstorm)

**Analogy:** think of a **lab report** and a **notebook of numbers**. The lab report (Testing) is about *events*: "on 12 Nov I did a urine test for chlamydia — negative." The notebook (Measurements) is about *values over time*: "my weight: 67.5 → 68.0 kg; my CD4: 620 → 590." They are genuinely different *jobs* (events vs time-series) — merging them would be like filing a receipt inside a graph. So: keep both modules.

**But the owner is right that a link is missing.** Some test results ARE measurements — the same fact recorded twice:
- eGFR from a urine/blood test → a number in Measurements.
- Blood glucose (lab or meter), viral load (copies/mL), CD4 (cells/µL), testosterone/estradiol (already in Measurements) — all originate as *tests*.
- Weight, BP, temperature — self-measured, not tests.

**Current state:** Measurements already has a type picker with unit conversion (`getAvailableUnits`, `convertFromCanonical`) including concentration units (mg/dL, mmol/L, copies/mL, cells/µL). Testing has `sampleType` and `testResult` (Positive/Negative/Inconclusive/Pending). There is **no** field on a test saying "this produced measurement X" and no link from a measurement back to its test.

**Design options (challenge each):**
1. **Deep-link only (minimal):** on a Testing record whose result could be numeric, add "Record as measurement" → opens Measurements prefilled (type + sample date). On a Measurement, show "From test: [title]" if linked. Requires a `sourceTestId` field on measurements. Low risk, keeps modules separate. **Recommend.**
2. **Projection view:** Measurements shows a "lab-derived" filter; Testing shows a "results with values" filter. More work, no new data needed beyond the link.
3. **Merge modules:** reject — different jobs (see analogy), would confuse users and break the multi-door architecture.

**Context caveat (RCOG/NICE/FSRH do not require this):** this is a usability/interoperability improvement, not clinical. No diagnosis or interpretation — just linking two records of the same fact.

**Decision needed:** add `sourceTestId` to measurements + a "Record as measurement" action on test results? (I recommend yes, low effort.)

## B2 — "What kind of measurement is eGFR?" — suggest from a bank (challenge + brainstorm)

Owner's point: users won't know whether eGFR is "Weight-like / Concentration / count". **Agree, and this is different from the LOINC field I dropped.** That was a hidden code nobody fills; this is help AT INPUT TIME so the app picks sensible units. That's a real user need.

But there's a subtlety: the existing type picker already lists eGFR (it was seen in the browser). The question shown is a *follow-up* asking to categorise a free-typed type. Good apps (Seventh/Niyora) fuzzy-match the typed name to a known list and "match your columns". So:

**Recommendation (challenge-tested):**
- Keep the existing known-type list as the primary path — most users pick from it, no question needed.
- For free-typed names, add a small **standard bank** (name → canonical unit/type + aliases) covering common labs: eGFR (mL/min/1.73m²), creatinine (µmol/L ↔ mg/dL), glucose, HbA1c, CD4, viral load, TSH, cholesterol, testosterone/estradiol (already canonical), weight/height/temp/BP. **Fuzzy match** (the repo already has `fuzzyMatch.js`) the typed name to the bank; prefill the type/unit and show "Did you mean eGFR? ✓". If no match, keep the manual question as the escape hatch.
- UK-first units in the bank (µmol/L, mmol/L, mL/min/1.73m²); US alternates where a real conversion exists (mg/dL) — the app's unit-conversion system already handles the rest.
- This is a **local, on-device lookup** — no cloud, consistent with the privacy promise.

**Reject:** auto-guessing silently (wrong units on health data = silent corruption, same principle as the import date-format rule). Always show the suggestion and let the user confirm.

**Decision needed:** build the standard bank + fuzzy suggestion (medium effort, high usability value)?

## Note
A3 (Medications horizontal scroll), A4 (INFERRED single line — DONE), A5 (stray · — DONE), A6 (end time — already shown when data exists), A7 (Ash sort-first — needs an owner decision on default sort vs a "needs attention" filter), A8 (reorder — DONE) are tracked in BROWSER-FEEDBACK-ROUND2.md.

*No clinical advice. UK-first.*
