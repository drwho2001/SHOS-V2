# Design / Encounters-template review + form coverage — 17 Nov 2026

**Honest answer to "did you look at design and how Encounters is the template? did you check each form?"**

- Earlier sessions: I logged **visual findings** (AUDIT-2026-11-17.md) but did **not** run a systematic "is Encounters the template?" comparison, and several forms I only *viewed* or skipped. This document closes both gaps.
- The template rule is real and documented: `BACKLOG.md:152` (0h: "Start with encounters as template, use to update design manual, then apply to rest"), `BACKLOG.md:173` (0j: "apply encounters style to healthcare + contacts"), and the glassmorphism conclusion (`BACKLOG.md:2571`: "match Encounter's solid-surface + accent-border + pill-control pattern"). `DESIGN-MANUAL.md` §"Healthcare list cards (audited 8 Nov)" and §"Chip groups" define the settled rules.

---

## 1. Encounters-as-template: comparison against the manual

Manual rules (DESIGN-MANUAL.md) → what I saw live:

| Rule (manual) | Encounters (the template) | Others — observed | Verdict |
|---|---|---|---|
| Solid surfaces + 1px borders, no glass (principle #7) | ✅ solid cards, accent borders | ✅ all screens solid | ✅ consistent |
| Title row: 8px status dot, 15/600 title, facts after name, emoji at end, star top-right | ✅ dot/title/pepper, star top-right | Contacts: dot + name + byline + emoji at end ✅ (manual line 230 documents this as already corrected); Medication: dot + name ✅ | ✅ mostly consistent |
| Byline one tight 10/500 line, related facts on one line | ✅ "Date/Chill · Evening" | Contacts ✅; **Medication byline splits quantity/timing across lines in places**; Healthcare lists stack 12px lines (manual line 307 explicitly lists this as an unresolved gap) | ⚠️ Healthcare lists still diverge — documented, not fixed |
| Chip groups: 9px uppercase subtitle, 10px above / 4px below, semantic colours | Encounters: kinks purple, position teal, protection green, cum/loads pink | Healthcare chip groups ✅ (manual 309); **my new "No barrier method" amber-dashed chip** matches the warning/derived convention | ✅ |
| Red border reserved for "needs attention now" | ✅ positive result red border on Testing | ✅ Testing positive red, Vaccinations overdue red | ✅ |
| Every card carries two actions (primary filled + secondary outline) | Encounters card: actions present | Manual line 307: **none of the four healthcare lists render two actions on the card**; Testing/Clinic visits/Symptom/Vaccinations have actions in header/forms instead | ⚠️ known gap, fix toward mockups |
| Undo via shared `UndoToast` | ✅ | manual line 333: all 9 modules migrated to shared component | ✅ |
| Older-record treatment: fade + grey pill | Encounters n/a | Testing/Clinic/Vaccinations/Symptoms have "Older test/visit/entry" pills (live audit saw them) ✅ | ✅ |

**Conclusion on template alignment:** the *visual language* is consistent (solid cards, chips, dot/title rhythm). The **unresolved, already-documented divergences** are exactly the ones the manual calls out (line 307): healthcare lists stack 12px bylines instead of one icon line, no grouped chip cloud, no per-card two-action footer; Clinic Visits has no status dot. My audit adds one new divergence to log: the **sticky-header offset disagreement** (Healthcare uses a measured CSS var, detail sheets use a fixed 58px token) — detail content clipped behind tabs on scroll. None of these are new "bugs I found and didn't fix" — they're known gaps queued as R4/R12.

---

## 2. Form coverage — checked this session (live, fresh install)

Earlier session (from AUDIT-2026-11-17.md): New test, Log period, Log symptom, Add encounter (all 3 steps), Add medication, Add clinic visit, Log pregnancy test, PIN form, Safety Share, Contact detail.

**Added this session:**
- **Add contact** ✅ — full form: required Name-or-nickname + Age, "Acknowledge incomplete/anonymous record" toggle with explicit warning copy, Gender/Pronouns chips, relationship/meet-again selects, city/role/position mandatory-detail list. Exposes the "mandatory details" UX the Contacts card flags.
- **Vaginal health → Add** ✅ — single "pick the closest description" list with urgency badges: PID/Urgent, Trichomoniasis/Prompt, BV/Routine, Candidiasis/Routine, Pregnancy/Refer. Confirms D1=B (diagnosis-led triage belongs in Symptoms/Testing/Episodes).
- **Settings Calendar** ✅ — this Settings entry is a **read-only month grid** with Filter chips (Encounter/Test/Clinic visit/Vaccination/Symptom entry/Medication) + Week-starts-on Mon/Sun. It is NOT the native calendar-sync screen; the 4 sync switches in `CalendarScreen.jsx` belong to a different code path not exposed here — record as "not verified in this build".
- **Automatic backups** ✅ — master `role=switch` (toggled true→false→true) + interval radios. Works.
- **My Profile view** — read view verified earlier; **edit form still not exercised** (see gaps).

---

## 3. Forms / controls NOT verified (carry-forward, honest)

- My Profile **edit** form (only the read view + Edit button seen).
- Manage lists / registry option editors (Kink/Chems/Protection/Symptoms/Organism/Results/Locations + Option lists) — opened? No, only the list screen text read.
- Resources/Glossary **add** forms (they may be read-only by design — check).
- Widget configuration screen controls.
- Trash restore action (the screen says items stay 30 days; restore not exercised).
- Tap-to-undo after delete; long-press batch archive/delete/export.
- 4 native Calendar sync toggles (not surfaced in this Settings dialog).
- Reduced-motion, keyboard/focus, safe-area/notches, offline, desktop/wide viewport (no resize tool).
- Backup export→import round trip (external action, deliberately not triggered).

---

## 4. What this changes in the plan

- Log the sticky-offset disagreement (two mechanisms) as a **correctness fix** under R12 — one shared measured offset, not two constants.
- Keep the Healthcare list-card divergences (bylines/actions/dot) as the manual already prescribes: fix toward the mockups when those files are next touched. No new work item needed.
- Mark the carry-forward list in §3 as "not verified, do not claim as tested".
- The new "No barrier method" amber-dashed chip aligns with the manual's semantic-chip convention — no template violation.

*No code changed in this review. Documentation updated in REVIEW-ANSWERS.md and this file.*
