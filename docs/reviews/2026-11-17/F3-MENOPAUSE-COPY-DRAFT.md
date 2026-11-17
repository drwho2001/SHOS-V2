# F3 — Menopause status + spotting prompt: DRAFT COPY FOR OWNER REVIEW

**Status: DRAFT — NOT approved, NOT built. Owner must sign off (ideally clinical review) before any of this ships.**

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
> "You've recorded a period after menopause. Bleeding more than 12 months after periods stop is normally checked by a clinician, even when it is light. If this is new for you, consider mentioning it to a doctor or nurse — bring the dates you've logged here."
>
> [Read more (Resources)](link) · [Not relevant / dismiss]

**C. If HRT is recorded as an active medication, append:**
> "If you are taking HRT, some bleeding can be expected — especially in the first 6 months or after a dose change. This guidance does not apply to expected HRT bleeding; ask your prescriber if you are unsure."

**D. Resources entry (neutral, to be verified at build time):**
> "Post-menopausal bleeding — NHS / NICE guidance on when to get bleeding checked. [Link to be verified]"

## Explicitly NOT in this draft (do not add)
- No "2-week wait" / "urgent referral" / "cancer" wording.
- No automatic date-based inference of menopause from age or from 12 months of no periods (the record is user-entered).
- No triage badges, severity scoring, or "you should refer" instruction.
- No fertility/ovulation content (existing liability exclusion).

## Owner review checklist
- [ ] Approve/reject the 12-month definition phrasing (A/B).
- [ ] Approve the HRT qualifier (C) — is it clear enough without being advice?
- [ ] Approve neutral verbs ("consider mentioning", "get checked").
- [ ] Confirm where `menopauseStatus` is stored (preferences vs profile).
- [ ] Confirm the Resources link target and that wording is verified against current NICE/FSRH/RCOG at build time, with the date in a source comment.
- [ ] Clinical review sign-off before shipping any patient-facing text.

*No code changed. Nothing here is approved or built.*
