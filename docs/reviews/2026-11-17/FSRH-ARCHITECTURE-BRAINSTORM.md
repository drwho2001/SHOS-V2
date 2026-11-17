# FSRH Architecture — Brainstorm & Challenge

**Date:** 17 Nov 2026 · Owner's shorthand "FSRH" = the reproductive trio (pregnancy, menstruation, contraception/hormonal). Named "FSRH" because FSRH is also the real UK Faculty of Sexual & Reproductive Healthcare — a useful, gender-neutral clinical anchor rather than "female health".
**Principle to hold:** *multiple doors, one source of truth* — a fact is stored once; every other place that shows it is a view/deep-link, never a second copy.

---

## 1. First, challenge the premise — there is no "female health" tab (owner is right)

What actually exists today:
- Healthcare sub-tabs: Symptoms, Testing, Clinic Visits, Vaccinations, Measurements, **Menstrual & Contraception** (inner: Cycle / Contraception / Pregnancy), Vaginal health (to be removed), Episodes, Attachments, Calendar, Clinic Card.
- Pregnancy is *already* gated twice: menstrual-tracking toggle in Preferences **and** a "Show pregnancy tracking anyway" link that resets every reload (session-only) — audited.
- The trio is therefore split: menstruation + contraception share one sub-tab; pregnancy is a hidden third sub-tab inside it; pregnancy **tests** live in two different places.

**This is the muddle to resolve:** the same clinical event (a pregnancy test) can be entered as a `Testing` record (has sample type, result, linked visits/episodes) **or** as a `PregnancySheet` record (date, result, notes only). Two forms, two repositories, no link between them. That violates "enter once, access from more than one place".

---

## 2. Apply "multiple doors, one source of truth" to the trio

The repo already has this pattern — it just isn't applied consistently:

| Concept | ONE source of truth (owner) | Other "doors" (views / deep links) | Status |
|---|---|---|---|
| Symptom | `SymptomLogRepository` | Cycle view, encounter form, clinic visit — all deep-link to it (13 Nov decision) | ✅ correct pattern |
| DoxyPEP / PrEP dose | `MedicationRepository` + dose logs | Encounter card infers coverage via `encounterProtectionContext` — you never re-enter it | ✅ correct pattern |
| **Pregnancy test** | **should be `TestingRepository`** (it IS a test — sample type, result, date) | Pregnancy sub-tab shows a **filtered view** of Testing records + "+ Log test" deep-links to Testing | ❌ currently duplicated |
| Menstrual period | `menstrualCycleRepository` | Home "Log period" quick-add; cycle→symptom deep-link | ✅ mostly |
| Contraception method | `contraceptionRepository` | Home quick-add; side effects → SymptomLog via `sideEffectIds`; "reason stopped" field decided 13 Nov (unbuilt) | ⚠️ side-effect severity still duplicated in forms |
| Menopause / post-menopausal status | **does not exist** | — | ❌ gap (see §4) |

**Concrete recommendation for pregnancy tests:** make `Testing` the single owner. In the Pregnancy sub-tab, render the list of tests where `testingFor` includes "Pregnancy" (a read-only projection), and make "+ Add" open the Testing form **prefilled** with `testingFor: "Pregnancy"` (the repo already supports `prefill` — `testingRepository.js:455`). Remove testDate/testResult from `PregnancySheet`; keep pregnancy-specific state there (gestational weeks, outcome, link to contraception at conception, mask flag). This gives exactly the user's ask: *add in Testing or Pregnancy, enter once, access from both.*

---

## 3. Structure: more tabs, own module, or a cluster? — challenge

Options:
1. **Three sibling sub-tabs** under Healthcare (Cycle / Contraception / Pregnancy), Vaginal health removed. Pros: smallest change, matches "trio". Cons: Healthcare sub-tab row is already overcrowded (live audit: 7 pills on row 1 + 4 text links on row 2 — the feedback flagged this). Adding a third menstrual-area tab makes it worse.
2. **Own top-level module** (6th bottom-nav tab) called "Reproductive / sexual health". Pros: clean grouping, room to grow. Cons: bottom nav already 5 tabs — a 6th is cramped on mobile; and DoxyPEP precedent shows related concepts can live in their own module and be deep-linked from elsewhere, so a module is viable. But it splits Testing from its test data again.
3. **A labelled cluster inside Healthcare** (recommended): keep one sub-tab "Menstrual & Contraception", rename to "Reproductive health", and inside it three clear sub-sections Cycle / Contraception / Pregnancy. Grouping happens *inside* the sub-tab; do not add to the overcrowded top-level pill row. This preserves "one source of truth" because Testing/Medication/Symptoms stay where they are and are deep-linked.

**Recommendation: option 3 now; option 2 only if the cluster outgrows the sub-tab.** Do not create a 6th bottom tab yet.

---

## 4. Things the owner flagged that the app does not model — and the safe response

**a) Menopause.** No field exists anywhere. Before acting, challenge: the app's own recorded decisions explicitly **EXCLUDE** fertility tracking and pregnancy week-by-week content for medical-liability reasons (13 Nov). Turning age into an auto-gated clinical state, or emitting a triage verdict ("2-week-wait referral"), is clinical decision support — a different, higher-liability category than the app's current "record and inform" stance. The app's `Symptom patterns` panel is careful to say "Informational only – not a diagnosis. Verify independently with a clinician." Keep that line.

**b) "Any spotting after menopause → urgent 2ww referral?"** Clinically, post-menopausal bleeding is indeed a 2-week-wait pathway in the UK. But encoding a *referral decision* is not appropriate for a personal record app. Safe design:
- Add a **menopause status** field (e.g. "pre / peri / post / unknown") in the Profile or Cycle section, entered by the user, never inferred from age alone.
- If post-menopausal + a bleeding/spotting symptom is logged, show a **neutral prompt**: "You've recorded spotting after menopause. Guidelines recommend discussing this with a clinician promptly. [Resources: post-menopausal bleeding]" — a link, not a diagnosis or referral instruction. Owner must approve wording; consider clinical review before shipping.

**c) Menstruation depends on age / hormones / contraception.** Currently cycle stats are simple averages ("29 days over 2 cycles") with an "irregular cycles" advisory — but they do **not** account for hormonal contraception (Depot/IUD commonly stop periods) or perimenopause. So the app can show a misleading "irregular" warning to someone whose periods are suppressed by Depot. Challenge: before adding age logic, make the stats **context-aware** — annotate averages with "while on [contraceptive]" and suppress the irregular-cycle advisory when an active hormonal method is recorded. That is a correctness fix, not a new feature.

---

## 5. Is vaginal health a useful concept? — answer to the owner's question

**As a *tab of diagnosis presets*: no** — it presentsBV/PID/thrush/trich as triage diagnoses, which belongs in Symptoms (presentations), Testing (lab confirmation) and Episodes (diagnosis + treatment + outcome). D1=B (remove + migrate) stands.
**As *data*: keep the useful fields**, per the 13 Nov decision — treatment, outcome (resolved/recurring/chronic), recurrenceCount, link to Testing — by migrating them onto Episodes/SymptomLog/Testing rather than deleting them. The repository has no seed data and is in backups, so removal needs the read-only shim noted in the action plan.
**Naming note:** "vaginal health" is also anatomical-only and misses vulval/urogenital presentations — another reason a Symptoms-owned model is better.

---

## 6. Barrier logic — what was actually wrong, and what I changed

Challenging the premise: there is **no "No condom" option** to remove. Protection seed is `Condom / PrEP / PEP / None` (`protectionRegistry.js:13`). "No condom" appears only as a negated-string test case so a user-added entry isn't misread as a barrier. The desired logic was *already* implemented: no condom **or** dental dam selected → derived "No barrier method", never stored.

Two real defects remained, now fixed in code:
1. **Double label**: selecting "None" produced both "None" and "No barrier method". Added `canonicalProtectionNames()` / `isProtectionNonAnswer()` in `protectionBarrier.js` so non-answers fold into exactly one derived label; applied in the encounter card and detail view. 27 unit tests pass.
2. **Not searchable/filterable**: the Encounter search indexed only title/type/notes/attendees/kinks, and filters were date-only. Added "No barrier method" to the search index (to the derived label users actually see) and a "No barrier method" filter chip. ESLint clean, production build succeeds.

`canonicalProtectionNames` rule (owner's logic, encoded): real barrier selected → show real methods only; nothing selected → show exactly one "No barrier method"; "No barrier method" replaces "No condom"/"None" and is never stored.

---

## 7. Owner decisions (17 Nov 2026 — RESOLVED)

1. **Structure = option 3 (confirmed).** "Reproductive health" cluster inside the existing Menstrual & Contraception sub-tab. No 6th bottom tab; no new top-level pill on the Healthcare row.
2. **Menopause = BUILD.** User-entered status (pre/peri/post/unknown) + the neutral spotting prompt. **Constraint carried forward:** align the *informational wording* with NICE / Faculty of SRH / RCOG guidance, but do **not** encode a referral/triage/decision rule — `CLAUDE.md` permanently excludes diagnosis engines and clinical risk scoring. Any patient-facing wording needs owner sign-off (ideally clinical review) before shipping. See the build note below.
3. **Pregnancy test = move to Testing (confirmed).** Testing is the single owner of test records; Pregnancy becomes a read-only projection + a prefilled "+ Log test" deep-link (`testingRepository` already supports `prefill`). This is the true "enter once, access from more than one place" answer. Needs a migration for existing `PregnancySheet` test entries so no history is lost.
4. **Cycle-stats context = owner "yes, but unsure".** Recorded as *decided-in-principle, scope to confirm at build*: annotate/suppress the "irregular cycles" advisory when an active hormonal method (Depot/IUD) is recorded. Because the owner is unsure, treat this as a small, reversible correctness fix — do not bundle it into the menopause work.

### Build note for menopause (guideline alignment without crossing the line)
- What is safe and aligned: user-entered status; neutral, sourced informational text ("NICE recommends post-menopausal bleeding is discussed with a clinician promptly"); a link to Resources/glossary; no triage score, no "2ww" label as an app verdict, no automated action.
- What is out of scope by existing repo rule: an "urgent referral" decision, risk scoring, or anything that reads as a diagnosis. Keep the app's established "Informational only – not a diagnosis" line.
- Before writing copy: quote/check the exact current NICE NG12 / FSRH / RCOG wording and date it in the source comment, so the next session can re-verify.

---
*Brainstorm only — no clinical advice is given here; any patient-facing wording needs owner sign-off and ideally clinical review. Code changes in §6 are limited to the barrier label logic and are covered by tests.*
