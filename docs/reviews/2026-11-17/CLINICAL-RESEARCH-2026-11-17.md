# Clinical research + self-challenge (17 Nov 2026)

Owner asked: (a) check the "second ongoing period" UX against RCOG; (b) research NICE/FSRH/RCOG guidance and what information users actually want, and **challenge my own approach**. Note: information only — no clinical advice is given, and the app permanently excludes diagnosis/decision support.

## Sources checked (live web, 17 Nov 2026)
- NICE NG12 *Suspected cancer: recognition and referral* — last updated **15 April 2026** (note: the 2-week-wait pathway is now framed as "suspected cancer pathway referral", target seen within 2 weeks / diagnosis within 28 days).
- FSRH/RCOG *Management of Unscheduled Bleeding in Women Using Hormonal Contraception* and RCOG/CEU *Problematic Bleeding with Hormonal Contraception*.
- NHS inform *Irregular periods*; NICE CKS *Amenorrhoea*; nidirect *Bleeding between periods* / *Stopped or missed periods*.
- User-preference studies: RBMO 2023 (n=326), npj Women's Health 2026 (Clue, n=11,910), NZ menstrual-app study 2023 (n=144), PMC 2018 (n=90), endometriosis diary survey 2023, privacy study 2025.

## Findings that matter to the app

**1. Post-menopausal bleeding (F3 wording).**
- Definition: vaginal bleeding **more than 12 months after menstruation stopped** due to menopause. Not any spotting after a missed period.
- NG12 1.5.12/1.5.14 (2026): suspected-cancer-pathway referral for age **55+**; **consider** it for **under 55** — with the crucial qualifier **"unexplained… that cannot be attributed to HRT"**.
- NG12 explicitly says "women, **and trans men and non-binary people with female reproductive organs**" — the app's trans-inclusive stance aligns with current guidance; wording should mirror this (the app currently says nothing gendered here, so keep neutral/anatomical).
- HRT bleeding is a special case (BMS guidance, limited evidence): bleeding in the first ~6 months of starting or ~3 months of changing HRT can be expected; NICE signposts BMS rather than giving a rule.
- **Implication:** a simple "spotting after menopause → 2ww" line would be WRONG (over-refers, ignores HRT and the 12-month definition). Neutral prompt must say "bleeding after 12 months without a period" and "discuss with a clinician promptly", with a link — never a referral instruction.

**2. Hormonal contraception + cycle stats (F4 / the "irregular" advisory).**
- Unscheduled bleeding is **common and expected in the first 3–6 months** of most hormonal methods; it often settles. Guidance advises against changing COC within the first 3 months.
- 90-day reference period definitions: frequent >5 episodes, infrequent <3, amenorrhoea = no bleeding/spotting through 90 days. Normal cycle 24–38 days (NHS inform).
- **CORRECTED 18 Nov (clinician review of cited sources):** the earlier "prolonged ≥14 days" was wrong. FIGO System 1 (2018 revisions) defines duration as normal **≤8 days**, prolonged **>8 days**; the 90-day reference period uses a *variation* in bleeding-free intervals (>17 days) as a regularity measure, not a 14-day duration threshold. FIGO/Fraser bleeding-diary definitions: a **bleeding/spotting episode = one or more consecutive days** with bleeding recorded; a bleeding-free interval = one or more consecutive days with none. This is the basis for the 18 Nov episode-scoped "stop reminding me" rule. Sources: Munro et al. *Int J Gynecol Obstet* 2018;143:393–408; Jain/Munro/Critchley *IJGO* 2023 (PMID 37538019); Fraser et al. *Semin Reprod Med* 2011.
- Persistent bleeding **beyond 3 months** or a **change in pattern** warrants clinical review; endometrial biopsy considered at ≥45 with persistent problematic bleeding.
- **Self-challenge:** my earlier option-1 ("annotate averages + hide 'irregular' advisory when a hormonal method is active") is directionally right but too crude. The advisory should be **context-aware by method and time**: suppress only the *alarm* in the expected settling-in window, and instead surface "this can be expected with [method] in the first 3 months — mention persistent or changed bleeding to a clinician". Do not silently hide data; keep the dates visible and explain. Also stop calling a 2-cycle average "irregular" at all — 2 data points cannot establish irregularity.

**3. Overlapping "ongoing" periods (owner's R9 answer).**
- No clinical rule supports two concurrent menstrual periods. Clinically a bleed has a start and an end; an un-ended "ongoing" record cannot be used to compute cycle length, which is exactly what the app's averages/irregular advisory depend on.
- **Owner's decision is clinically sound:** do NOT auto-close. When a second "Log period" is attempted, open the first record's edit sheet to enter its end date, with a plain explanation ("A new period can't start until the previous one has ended — add the date it stopped"). This also fits the app's rule "store facts, derive state".
- Note for build: allow same-day end/start, and handle a user who genuinely cannot remember (option to save with an approximate/blank end + flag), rather than blocking them entirely.

**4. What users actually want (from the studies) — challenges the "more features" instinct.**
- Top tracked items are **period start date (99%)** and **end date (86%)**; ~67% say the app allows about the right number of symptoms. Ease of use (85%) outranks prediction accuracy (65%).
- Users value **a concise, shareable record for clinicians**: "objective record rather than relying on memory", "convince doctors", "summarise into a 1–2 page sheet" — but complain apps ask for too many fields and that summaries are too long to be useful.
- 60% said tracking increased confidence talking to an HCP; 21% of those with a diagnosis credited tracking with helping obtain it.
- 38% forget to log — so low-friction entry and gentle prompts matter more than extra fields.
- **Self-challenge:** the FSRH "Symptom patterns (experimental)" panel I saw live is the app drifting toward "more data"; research says the winning move is a **concise export/summary for appointments**, which the app already partly has (Clinic Card, CSV/PDF export). Recommend prioritising a short "cycle summary for your clinician" over adding more symptom-tracking fields.

## Decisions I recommend back to the owner
- F3: draft wording using the 12-month definition + HRT qualifier + neutral "discuss with a clinician", link to Resources; no 2ww/referral phrasing. (Owner already chose "draft then I review".)
- F4: option 1 refined as above — annotate + soften (not hide) under hormonal contraception, and never label 2 cycles "irregular". Owner to confirm once they see the drafted copy.
- R9: implement owner's flow (open first record to add end date, with explanation), plus an "I don't remember" escape hatch.
- New candidate (low effort, high value per research): a concise **"cycle summary for your clinician"** export — fold into the existing Clinic Card/export work, not a new module.

*No patient-facing copy is approved by this document; all wording needs owner sign-off and ideally clinical review before shipping.*
