# F3 — four-body guideline check, app-quality survey, and challenge of my own draft (17 Nov 2026)

Research sources (live web, 17 Nov 2026): **NICE NG23** (Menopause, last reviewed 15 Apr 2026) + **NICE NG12** (Suspected cancer, 15 Apr 2026) + NICE CKS; **RCOG** patient info + PMB poster (updated Apr 2025) + RCOG SITM curriculum; **FSRH** over-40 guideline + UKMEC 2016 (amended Sep 2019); **BMS/BSGE/BGCS/FSRH/GIRFT/RCOG** joint guideline on unscheduled bleeding on HRT (Apr 2024, reviewed May 2026); existing apps (Clue Perimenopause, Natural Cycles NC° Perimenopause, Balance/Newson Health, Flo, Apple Health, Caria, Health & Her, Ovia, Lulu).

## 1. The four bodies — what they actually say

**NICE (NG23 + NG12):**
- NG23 1.3.1: perimenopause = recent vasomotor symptoms + cycle changes; menopause = **no period for ≥12 months and not using hormonal contraception**; post-hysterectomy = symptom-based. **No lab tests needed 45+**.
- NG23 1.3.2/1.3.5: menopause is **hard to identify on hormonal treatment**; don't FSH-test people on combined oestrogen/progestogen or high-dose progestogen.
- NG23 1.8.4 (amended 2026): HRT bleeding in first 6 months / within 3 months of a dose change is common; seek help beyond those windows. NG23 1.8.5 defers to BMS.
- NG12 1.5.12/1.5.14: 2ww for 55+ with unexplained PMB not attributable to HRT; consider for under-55. Explicitly **trans-inclusive**.
- NG23 scope **excludes** people currently on gender-affirming hormone therapy.

**RCOG:**
- Defines menopause as 12 months without a period. PMB poster (2025): "any vaginal bleeding after the menopause (12 months after periods stop)"; ~1 in 10 PMB has endometrial cancer; "arrange to see your GP urgently"; HRT bleeding common soon after starting/changing but still discuss with GP. Patient info: unexpected bleeding after 6 months on HRT → see HCP straight away; cyclical HRT if starting <12 months from LMP, continuous combined if >12 months.

**FSRH (over-40) + UKMEC:**
- **No method contraindicated by age alone in the 40s.** At 50: stop CHC (switch to non-hormonal or IMP/POP/LNG-IUD); consider stopping DMPA (bone health). Contraception can generally stop at **55**. Non-hormonal methods: 2 years amenorrhoea if 40–50, 1 year if >50.
- UKMEC categories (1–4) are about **safety**, not efficacy, and can't simply be added; initiation vs continuation can differ. FSRH/UKMEC is about **contraceptive eligibility** — it is not a menopause-staging tool.

**BMS joint guideline (with FSRH/RCOG etc.):**
- Unscheduled bleeding on HRT: first 6 months / 3 months after change → adjust preparation for up to 6 months if low-risk; urgent TVS within 6 weeks if first presentation >6 months after starting / >3 months after change, or bleeding prolonged/heavy, or ≥2 minor risk factors; USCP referral for 1 major or 3 minor risk factors. This is **clinical decision support** — out of scope for the app.

## 2. Existing app survey — what good products do
- **Clue Perimenopause**, **Natural Cycles NC°**, **Flo**, **Balance (Newson Health)**, **Apple Health**, **Caria**, **Health & Her**, **Ovia**, **Lulu**. Common patterns:
  - Track **every bleed incl. spotting with start/end dates**; handle irregular/skipped cycles without a rigid 28-day prediction; log hot flushes, night sweats, sleep, mood, brain fog, vaginal dryness, HRT.
  - Show **longitudinal patterns** (trends across months/seasons), not day-to-day noise.
  - **Clinician-ready export/report** is a recurring, highly-valued feature (Balance, Flo, Apple PDF, Natural Cycles report) — aligns with the user-preference research from earlier.
  - Experts (Dr Stephanie Faubion, Menopause Society) note most "menopause features mostly repackage existing data" and staged estimates are **not a diagnosis** — supports our no-diagnosis stance.
  - Privacy is a selling point for several; SHOS's local-first/no-cloud is competitive here.
  - **Gap in the market:** none of the survey results specifically describe a post-menopausal spotting safety prompt; they mostly track symptoms/patterns. SHOS could differentiate with the neutral, guideline-aligned prompt — carefully.

## 3. BRUTAL CHALLENGE of my own F3 draft

1. **I under-specified the HRT branch.** My draft said "HRT bleeding may be expected in the first 6 months / after a dose change" — correct — but the four-body guidance has **two different clocks** for different situations: >6 months after *starting* OR >3 months after *changing* (NICE NG23 1.8.4); BMS uses 6 months of adjustments. My copy blurred "starting vs changing". If we mention any timeframe, it must be precise or we mislead.
2. **I omitted the "not using hormonal contraception" condition** from the 12-month definition. NG23 1.3.1 is explicit: menopause = ≥12 months no period **and not using hormonal contraception**. A Depot/IUD user with no periods is NOT menopausal by that definition — this is exactly the population my F4 cycle-stats work is about. My draft would mislabel them.
3. **I let "status" be user-entered with no structure.** Research shows apps that ask the "right stage" questions hold the week's data together; a bare dropdown is weaker. But — a stage *algorithm* is what experts warn is "not a diagnosis" and could drift into liability. **Resolution:** keep user-entered status, but let the app record the *facts* (last period date, HRT/contraception, symptoms) and show them as a **timeline/summary for the clinician**, not a stage verdict.
4. **My "draft then review" F3 was too narrow** — the owner's actual concern was alignment with all four bodies. The bigger alignment gap is **contraception around age 40–55** (FSRH/UKMEC): SHOS currently has contraception methods with renewal intervals but no guidance on stopping at 50/55 or switching from CHC/DMPA. That is a *safety-relevant, information-only* feature that fits the app's "store facts, derive state" rule and the no-diagnosis line. I missed it.
5. **Trans-inclusion is not just wording.** NICE NG23 *excludes* people currently on gender-affirming hormone therapy from its recommendations (with narrow exceptions). The app's "trans-inclusive fields, gated by settings/toggle, never gender alone" is good, but the F3 copy must not imply NG23 applies to someone on GAHT — either state "guidance may not apply if you are on gender-affirming hormones" or link to a clinician. My draft didn't.
6. **I treated "any bleeding after 12 months" as a prompt trigger** but did not handle **spotting logged as a symptom vs a period**. The app's period form has a "spotting between periods" flag with a date — a post-menopausal user might use that rather than "log period". The F3 trigger must check BOTH the period log and spotting symptoms, or it will miss exactly the case it is meant to catch.
7. **Age-based framing risk**: NG23: don't diagnose from age/labs alone 45+; RCOG uses symptom-based diagnosis. My draft correctly says status is user-entered, but I should explicitly state the app never confirms/diagnoses menopause from logged data.

## 4. What's missing (from the research and the challenge)
- [ ] **Contraception-stopping guidance at 50/55** (FSRH) — information-only, no decision; potentially the biggest safety-value addition. New backlog item.
- [ ] **HRT as a first-class medication context** — currently HRT isn't distinct from other meds; the bleeding prompt needs to know if HRT is active, the preparation type (sequential vs continuous) and any recent change date. Decide scope.
- [ ] **Hysterectomy / uterus status** — NG23/RCOG diagnose differently post-hysterectomy; the app has no such field. Needed for correctness of the prompt and the 12-month rule.
- [ ] **GAHT exclusion note** in copy (NICE NG23 scope).
- [ ] **Trigger both period logs and spotting symptoms** for the post-menopausal prompt.
- [ ] **Clinician-ready cycle/menopause summary** — market-standard and research-validated; fold into existing export/Clinic Card, not a new module.
- [ ] **Precise starting-vs-changing HRT timeframes** (6 vs 3 months) in any HRT copy, or omit timeframes entirely and just say "discuss with a clinician".
- [ ] **Clinical sign-off** on all patient-facing text (still required).

## 5. Revised recommendation
Do NOT build F3 as a simple "status dropdown + prompt". Build it as:
1. **Facts**: user-entered status + last-period date + uterus status (optional) + HRT/contraception context, all existing-data-compatible.
2. **Display**: a longitudinal timeline/summary (no stage verdict, no diagnosis).
3. **Prompt**: neutral, NG12/RCOG-aligned, HRT-qualified, triggered by period OR spotting logs, with GAHT caveat; link to Resources.
4. **Separate new item**: information-only contraception-at-50/55 guidance (FSRH), scoped with the owner.

*No clinical advice given. All patient-facing copy remains DRAFT pending owner sign-off and clinical review.*
