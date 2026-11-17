# Challenge of my own deep-link / automation / interop plan (17 Nov 2026)

Plain-language review. **Analogy:** my previous document was like a shop catalog — I listed everything that *could* be on the shelves. This challenge asks: "who actually needs each item, and would putting it there break anything?" UK-first throughout; US compatibility noted where it matters.

## 1. Shells/stalls — resolved first
- **Not stalled.** Two `vite preview` servers from my earlier local smoke runs were orphaned (like two car engines left running). Killed them; free RAM went from ~320 MB to 686 MB. My local smoke "timeouts" were memory starvation, not app bugs.
- CI smoke is genuinely slow (~13 min), not stuck: other three workflows green on the latest pushes. I will report the verdict when it lands, not guess.

## 2. Challenge: deep-link gaps — which are worth adding?
My previous list of "gaps" was too eager. Think of a deep link as a **door with a key**: adding doors nobody has keys for is just extra holes in the wall.

- `deepLinkRoutes.js` is driven by **widgets and App Shortcuts** (`com.shos.app://...`). There are 11 widgets; do we have a widget for Episodes/Calendar/Attachments? **No.** So adding `episodes`/`calendar`/`attachments` routes would be doors with no keys — skip them. The existing consumer guard test exists precisely because "route resolves" ≠ "route works", and I shouldn't add unused routes to prove a point.
- **Worth adding (has a real key):**
  1. `contact?id=` — Global Search already opens a contact; a widget/shortcut could too. Cheap, follows the tested `clinic-visits?id=` pattern.
  2. A generic `healthcare?subTab=X&id=Y` consumer — ONE mechanism instead of one per module. But only implement when a producer exists (e.g. a "next test due" widget linking to that test). **Do not build the consumer alone.**
  3. `shos://search?q=` — only if a search widget/shortcut is planned; otherwise skip.
- **Decision:** add `contact?id=` now (small, symmetric with clinic-visits); leave the rest as "when a widget needs them". Note in BACKLOG.

## 3. Challenge: automation opportunities
- Positive-result → treatment nudge: **valid but careful** — "Log treatment" is a form link, not advice; the app already cross-links tests→clinic visits, so this is a UI shortcut. Fine, low risk.
- "BASHH retest reminders surfaced more clearly": already a due-banner; **no new feature needed** — don't gold-plate.
- My "registries for recurring data" point is really "follow the existing pattern" — not an automation feature. Removed from the list.
- **Missed automation I hadn't listed:** the app's own due-state engine already computes refill/retest/vaccine due dates; the one genuinely missing piece is the *data import* below, because manual re-entry is the biggest waste of effort for a new user.

## 4. Challenge: interoperability plan (biggest corrections)
My A/B/C/D ranking was reasonable but too vague. Sharpened:

- **A (period CSV/JSON import):** keep as top priority, BUT scope v1 tightly: **import SHOS's own export first** (round-trip — already have the schema), then add one external format (Clue CSV is the most documented). A generic "match your columns" importer (like Seventh) is a **v2** — it is a lot of UI and validation, and guessing columns wrongly silently corrupts health data (analogy: pouring an unlabelled bottle into a medicine cupboard). UK/US: accept both `dd/mm/yyyy` and `mm/dd/yyyy` explicitly, never guess from ambiguous dates — ask the user.
- **B (doctor summary):** **agree, but it is not new** — extend the existing Clinic Card/export. I should not have implied a new module. Good.
- **C (LOINC codes):** **weak — I am challenging my own suggestion.** Adding a code field that nobody fills just adds clutter; "future-proofing" is not a user need. Better: keep SHOS's export schema stable and documented so mapping can happen *later outside the app*. **Drop C for now.**
- **D (Apple Health / Health Connect):** **agree to defer** — correct call. UK-first: Health Connect (Android) is more relevant to the app's existing APK; HealthKit is US/iOS-heavy. Both wait for post-beta.
- **Standards reality check:** FHIR/LOINC are EHR plumbing (hospital systems). For a local-first personal app, copying the *shape* (stable field names, explicit units) is enough; full FHIR would be like fitting a lorry's exhaust to a bicycle.

## 5. UK-first + US compatibility — what my plan missed
The app is UK-built (BASHH, NHS, NICE). It already handles a lot well:
- **Units:** the repository converts to one canonical unit and back per preference (`kg`↔`lb`, `°C`↔`°F`, `mmol/L`↔`mg/dL` are in `KIND_UNITS`) — so US compatibility for measurements is **already built**. Good.
- **Spelling/locale:** en-GB + en-US dictionaries exist; the smoke suite has `SMOKE_LOCALE` to test both. Good.
- **Dates:** native date inputs + fake-UTC storage; ambiguous `03/04` must never be auto-parsed on import — ask (see A).
- **Gaps I missed:**
  - **NHS number** is UK-only. A US user has no NHS number; the field should be labelled generically ("NHS number / record number") or hidden by locale, with en-US copy. Otherwise US users see a meaningless field.
  - **UK guideline links** (BASHH/NICE) in Resources are UK-specific; for en-US, label them "UK guidance" so a US user isn't misled into thinking they are local. No US guideline set should be added this round — UK first.
  - **Postcode** field in profile/contacts is UK-shaped; US ZIP is different. Low priority (free text already accepts it), but don't add postcode validation that assumes UK format.
  - **Terminology:** "GP" in patient-facing copy → "doctor/clinic" for en-US where it appears.

## 6. Menopause storage — challenge of my own decision
I decided "My Profile + NEVER_SHARED, read-only in Reproductive health". Challenge:
- **Correct for partner sharing** — allergies precedent holds; NEVER_SHARED is the explicit "never leaves in a shared profile" list.
- **But I invented two extra fields** (`menopauseConfirmedAt`, `hysterectomy`) the owner never asked for. Hysterectomy is clinically relevant (NICE diagnoses differently) but it is **scope creep** — propose it as an optional field in the F3 review, not as a silent addition.
- **One real issue:** NEVER_SHARED applies to *partner profile sharing*, but **Clinic Card is a different export** — allergies deliberately appear there (clinicCardPdfService.js:325). Menopause status in Profile will therefore show in the Clinic Card. That is probably correct (clinician-facing), but I should state it rather than imply "never shared anywhere".
- **Decision stands** (Profile + NEVER_SHARED + read-only FSRH view), with the above caveats made explicit.

## 7. Net changes to the plan
- Deep links: add `contact?id=` only; defer others until a widget needs them.
- Automation: keep positive→treatment shortcut; drop the two non-features.
- Import: v1 = SHOS own export + Clue CSV, explicit date format choice; drop LOINC field; defer external sync; keep doctor-summary as Clinic Card extension.
- UK/US: add generic record-number label + mark guideline links as UK; no new US clinical content this round.
- Menopause: decision stands; hysterectomy becomes an explicit F3 option, not automatic.

*No code changed. No clinical advice. UK guidance only; US notes are compatibility, not clinical recommendations.*
