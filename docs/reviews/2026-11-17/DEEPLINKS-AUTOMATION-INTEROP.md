# Deep links, automation opportunities, interoperability — research + decisions (17 Nov 2026)

## 1. Were all deep links checked? What could be linked? Automation opportunities?

**What exists:** `deepLinkRoutes.js` (pure, unit-tested) handles custom-scheme URLs for widgets/App Shortcuts:
- `medication` (/log, /dashboard, /inventory) → Medication; `encounter` → quick-add; `contact/add` → quick-add; `clinic-visits?id=` → specific visit; `clinic-card` → Clinic Card; `healthcare?subTab=` → 5 valid sub-tabs; `widget/reveal-clinic` → action.
- A **consumer guard test** (`deepLinkConsumerGuard.test.js`) exists because a route resolving ≠ a route working (the Clinic Card widget bug).
- **In-app deep links** work via `onNavigateToRecord` / `openRecordId` / `prefill` (Global Search → record; Home widgets → prefilled forms; Testing → linked tests; Symptoms → encounters/tests; Clinic Visits → tests/vaccinations/symptoms/meds).

**Verified this session (deep-link checks I actually ran):** symptom → encounter + test links persisted in detail view; app deep-link via Home widget → prefilled New test form (smoke flow); Clinic Card route guard is tested. Many others are code-verified but not exercised live.

**Gaps I can identify:**
- `VALID_HEALTHCARE_SUBTABS` in `deepLinkRoutes.js` has 5; the app has more destinations (Episodes, Attachments, Calendar, Clinic Card is separate). Adding `episodes` / `calendar` / `attachments` routes is trivial and safe (the guard will catch unhandled ones).
- No generic `?id=` for other repositories (test, symptom, period, medication) — only clinic visits. A generic `healthcare?subTab=X&id=Y` consumer would be one mechanism for all.
- No `contacts?id=` (open a specific contact).
- No URL-level keyword search route (`shos://search?q=`) — Global Search exists but is not reachable by URL/widget.

**Automation opportunities now that the app is mostly built (ranked):**
1. **Due-test/retest automation** already exists (BASHH 3-month reminders) — verified. Low effort: surface it more clearly (it's a due-banner).
2. **Auto-close "ongoing" period when a new one is logged** — REJECTED by owner (R9 decision); instead open prior record to enter end date. Keep.
3. **Notify on positive result → treatment/clinic-visit prompt** — the forms already cross-link; a nudge from the Test card to "Log treatment" is low effort.
4. **Recurring/static data as registries** — done; new concepts should use the same pattern (no duplicate free text).
5. **Auto-fill "last test date" / disclosure copy** — done via `mostRecentTest` single owner.
6. **Backup/Migrations guard tests** — keep ratcheting; every new repo wired in the same change.

## 2. Integration with other apps / standard formats / import-export

**What the market does:** Clue/Flo/Natural Cycles export **JSON/CSV** (GDPR portability); Apple Health exports **XML**; apps like Seventh/Isla/Niyora import all of these plus "match your columns" CSV, and several write back to Apple Health. Cycle start dates carry over cleanly; symptoms/notes usually don't. Clinician PDF summaries are common.

**Standards:** FHIR DiagnosticReport/Observation + LOINC codes (e.g. the FPAR 2.0 panel: HIV, chlamydia, gonorrhoea, HPV, pap) are the interoperability standard for lab results; HL7 has an At-Home IVD test-report IG and a PHR `.sphr` file format. Full FHIR is EHR-scale — out of scope for a local-first personal app, but **borrowing LOINC codes as optional identifiers** and a stable CSV schema is cheap and high value.

**Recommendation (ranked, low→high):**
- **A. Stable, documented CSV/JSON import for period data** (start/end/flow/spotting/symptoms) — accept Clue/Flo/Natural Cycles/Apple-Health-derived CSV with a column-mapping step (like Seventh). This is the single most-requested real-world integration and fits "enter once". Owner decision: allow import from files on-device only (no cloud) — consistent with the privacy promise.
- **B. Export a "doctor summary" PDF** (one page, dates + symptoms + linked test/vaccine/treatment context) — already partly in Clinic Card; extend that, don't build a new module. Research says this is the top clinician-facing want.
- **C. Optional LOINC/SNOMED-style code field on Testing records** — a "standard code (optional)" text field with a small built-in list for common STI tests, so exported results can be matched by other systems later. No EHR integration — just future-proofing the export.
- **D. Native Apple Health / Google Health Connect sync** — NOT now: iOS-only for HealthKit, Health Connect is Android; large platform work, two-way sync conflict handling, and the app's no-cloud stance must be preserved. Revisit after beta.

**Data safety:** imports must be read on-device, validated, previewed before save, deduplicated by date, and never auto-overwrite existing records (same guard rails as demo restore).

## 3. Menopause status — where to store it? (Owner: "you decide")

**Decision: `My Profile`, in the `NEVER_SHARED_FIELDS` group** (alongside allergies and emergency info), **plus a read-only view in the FSRH/Reproductive-health section** that links to Profile for editing.

Reasoning:
- The owner's own precedent: allergies / DOB / clinic number are in `My Profile` and explicitly in `NEVER_SHARED_FIELDS` (`profileShareService.js:102-113`) — menopause status is the same category of sensitive health fact. Putting it there inherits the "never transmitted in a shared profile" guarantee automatically; adding it to `SHAREABLE_FIELDS` would be a privacy regression.
- `Reproductive health` (FSRH cluster) is where it is *used* (the spotting prompt, cycle-stat context). A read-only display there + "Edit in My Profile" keeps one source of truth (repo rule: one owner per fact) and avoids a second writable copy in settings.
- Storing it in `AppPreferencesRepository` instead would bypass the profile-share allowlist concept entirely and scatter "profile facts" across two stores — rejected.

**Storage detail:** add `menopauseStatus` (and optional `menopauseConfirmedAt`, `hysterectomy`) to `DEFAULT_PROFILE` / profile repository; add all three names to `NEVER_SHARED_FIELDS`; they will then automatically appear only in Clinic Card/backup (which is correct — Clinic Card is for clinician sharing, not partner sharing). Wire into backup (profile already is). No new repository.

## Owner decisions still needed
- Approve A/B/C above (import of period CSV is the biggest; B extends existing export).
- Approve LOINC-code field as optional future-proofing (C).
- Confirm the My Profile storage decision (I recommend it as above).

*No code changed. No clinical advice. Nothing built.*
