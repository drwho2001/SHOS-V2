# F3 — Menopause status + spotting prompt: DRAFT COPY FOR OWNER REVIEW

**Status: DRAFT — NOT approved, NOT built. Owner must sign off (ideally clinical review) before any of this ships.**
**⚠️ This draft is SUPERSEDED in part by `F3-RESEARCH-CHALLENGE.md` (4-body check). Its known corrections, folded in below: (1) 12-month rule must say "and not using hormonal contraception"; (2) HRT timeframes are 6 months from starting / 3 months from a change — or omit timeframes; (3) add a GAHT-exclusion caveat; (4) trigger the prompt on spotting symptoms as well as period logs; (5) never imply the app diagnoses menopause.**

## Constraint (from the owner's decisions + repo rules)
- User-entered **menopause status only** — never inferred from age.
- A **neutral informational prompt** when a post-menopausal spotting/bleeding symptom is logged — a link to Resources, never a referral instruction, triage verdict, or risk score. The repo permanently excludes diagnosis engines and clinical risk scoring.
- Aligned to NICE NG12 (last updated 15 Apr 2026), FSRH/RCOG and BMS guidance (sources in `CLINICAL-RESEARCH-2026-11-17.md`). NG12 wording is trans-inclusive ("women, and trans men and non-binary people with female reproductive organs") — the copy below stays anatomical/neutral, matching the app's existing style.

## What the research says the wording MUST get right (else it is wrong / over-refers)
1. **Definition:** post-menopausal bleeding = bleeding **more than 12 months after periods stopped** because of the menopause — NOT any spotting after a missed or late period.
2. **HRT qualifier:** bleeding that can be attributed to HRT timing / expected settling-in is explicitly excluded from the NG12 referral recommendation. BMS guidance covers unscheduled bleeding on HRT. The prompt must not tell an HRT user to seek urgent care for expected early bleeding.
3. **Age:** NG12 = suspected-cancer-pathway referral for 55+; "consider" for under 55. The app must not encode "2ww" or "urgent" — that is a clinical decision.
4. **No triage language:** "discuss with a clinician", "get it checked", "mention at your next appointment" are acceptable; "urgent", "2-week wait", "cancer", "referral" are not.

## Proposed fields (menopause status — Settings/Cycle, user-entered)
- `menopauseStatus`: one of `Not recorded` (default) / `Pre-menopause` / `Peri-menopause` / `Post-menopause` / `Prefer not to say`.
- `menopauseConfirmedAt` (optional, date): only used for the prompt logic (12-month rule), entered by the user.
- Stored in `AppPreferencesRepository` or `myProfile` — **decision needed**; no new repository without backupService wiring (repo rule 9).

## Proposed prompt text (DRAFT — review each)

**A. Status help text (under the field):**
> "This is your own record — SHOS never guesses your stage from your age. You can change this any time."

**B. Neutral prompt shown when a bleeding/spotting symptom is logged AND status = Post-menopause:**
> "You've recorded bleeding or spotting after menopause. Bleeding more than 12 months after your periods stopped — and when you are not using hormonal contraception — is usually checked by a clinician, even if it is light. If this is new for you, consider mentioning it to a doctor or nurse and bring the dates you've logged here."
>
> [Read more (Resources)](link) · [Not relevant / dismiss]
>
> Note for build: the trigger checks BOTH the period log AND a spotting symptom on/after the status date, otherwise a post-menopausal user logging "spotting" is missed (challenge item 6).

**C. If HRT is recorded as an active medication, append:**
> "If you are taking HRT, some bleeding can be expected — commonly within the first 6 months of starting, or within 3 months of changing your dose or preparation. If bleeding is new, heavy, or continues beyond that, discuss it with your prescriber."
>
> Note: "6 months from starting / 3 months from a change" is the precise NICE NG23 1.8.4 / BMS distinction — do not blur it (challenge item 1). If we cannot track the change date reliably, OMIT all timeframes rather than state a wrong one.

**D. Resources entry (neutral, to be verified at build time):**
> "Post-menopausal bleeding — NHS / NICE guidance on when to get bleeding checked. [Link to be verified]"

## Explicitly NOT in this draft (do not add)
- No "2-week wait" / "urgent referral" / "cancer" wording.
- No automatic date-based inference of menopause from age or from 12 months of no periods (the record is user-entered).
- No triage badges, severity scoring, or "you should refer" instruction.
- No fertility/ovulation content (existing liability exclusion).
- No implication that NICE NG23 guidance applies to someone currently taking gender-affirming hormone therapy — NG23 explicitly excludes that group. If GAHT is recorded, suppress the guideline-based prompt and link to a clinician instead (challenge item 5).
- No "SHOS has diagnosed/identified menopause" phrasing — the app records facts, never stages or diagnoses (challenge item 7).

## Owner review checklist
- [ ] Approve/reject the 12-month definition phrasing (A/B).
- [ ] Approve the HRT qualifier (C) — is it clear enough without being advice?
- [ ] Approve neutral verbs ("consider mentioning", "get checked").
- [ ] Confirm where `menopauseStatus` is stored (preferences vs profile).
- [ ] Confirm the Resources link target and that wording is verified against current NICE/FSRH/RCOG at build time, with the date in a source comment.
- [ ] Clinical review sign-off before shipping any patient-facing text.

*No code changed. Nothing here is approved or built.*
