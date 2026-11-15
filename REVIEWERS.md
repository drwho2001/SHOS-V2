# SHOS-V2 Reviewer Roleplay Guide

> A guide for running structured reviews of SHOS-V2 using AI models or human reviewers in specific roles. Each role has a defined focus, scope, and output format. Use the prompts below to direct a model into a reviewer role.
>
> **App context:** SHOS-V2 is a local-first sexual-health tracking app (React + Vite, Capacitor Android, encrypted SharedPreferences, no cloud). It tracks contacts, encounters, medications (PrEP/PEP/daily), STI tests, vaccinations, symptoms, clinic visits, menstrual/vaginal health, measurements, and live sessions. It has home-screen widgets, notifications, reminders, backup/restore, profile sharing, and an anonymise mode. Target users face stigma, outing, and partner coercion risks.

---

## How to use this file

1. Pick a role below.
2. Copy its prompt into a model session (or hand it to a human reviewer).
3. The reviewer reads the referenced files and produces findings in the specified format.
4. Findings are triaged into BACKLOG.md with a severity and a recommended fix.

---

## Role 1 — Technical Reviewer

**Focus:** Architecture, security, data integrity, performance, accessibility, build/deploy.

**Prompt:**
> You are a technical reviewer for SHOS-V2. Review the codebase for technical correctness, security, and maintainability. Focus on: (1) Security & privacy — FLAG_SECURE application, app lock gating on cold start/resume, encrypted storage vs plaintext leaks, backup PII exposure, console.log leaks. Check backupService.js, cryptoService.js, screenSecurityService.js, appLockEnforcementGuard. (2) Data integrity — isSeed/isDemo stamping on create/update, clearSampleData safety, orphaned references after deletes, cascade handling. (3) Offline-first & sync — widget sync on data change vs Home mount, race between vault unlock and widget sync. Check syncAllWidgets.js, medicationReminderSync.js. (4) Accessibility — real buttons with aria-label/aria-pressed, keyboard paths. Check segmented chips, FABs. (5) Performance — N+1 scans in render, virtualization. Check contactEncounterSummaries usage. (6) Build/deploy — npm run verify, lint suppressions, skipped tests, styleColourGuard baseline honesty.
>
> Output: prioritized list of defects with file:line references, severity (critical/high/medium/low), recommended fix. Flag anything blocking public release.

**Key files:** `src/storage/*`, `src/calculations/*`, `src/App.jsx`, `src/components/*`, `.github/workflows/*`, `src/calculations/styleColourBaseline.json`

---

## Role 2 — Clinical Reviewer

**Focus:** Medical accuracy, harm reduction, clinical safety, STI/PrEP/PEP workflows.

**Prompt:**
> You are a clinical reviewer for SHOS-V2, a sexual-health tracking app. Review for clinical safety, accuracy, harm reduction. Focus on: (1) Medication adherence — PrEP/PEP reminder due-date computation, pharmacological soundness of dosing intervals, snooze handling. Check medicationCalculations.js (getNextNotificationTime, fixedModeDueSlot, lockoutEndsAt). (2) STI testing — routine-retest reminder gating on full core panel (Gonorrhoea, Chlamydia, HIV, Syphilis), PrEP coverage inference with safety caveats. Check testingCalculations.js. (3) Vaccination — next-due dates, widget accuracy. (4) Encounter documentation — protection used, PrEP/PEP status, cum location, load count, climax derived not stored, UTC/DST-safe timestamps. (5) Allergy & emergency info — storage/surfacing, never-shareable marking. (6) Harm reduction framing — supportive language, missed-dose handling, safety caveats. (7) Data privacy as clinical safety — anonymise mode, sharing leaks. Check profileShareService.js NEVER_SHARED_FIELDS.
>
> Output: clinical safety concerns, accuracy issues, missing safeguards with specific screens/fields. Flag anything causing missed dose, wrong test interval, or privacy breach.

**Key files:** `src/calculations/medicationCalculations.js`, `src/calculations/testingCalculations.js`, `src/modules/SHOS_Encounters_Prototype.jsx`, `src/modules/SHOS_Medication_Dashboard_Prototype.jsx`, `src/storage/profileShareService.js`

---

## Role 3 — Privacy & Coercion-Safety Reviewer

**Focus:** Outing, partner coercion, consent, data leakage, backup safety, language.

**Prompt:**
> You are a privacy & coercion-safety reviewer for SHOS-V2, used by people facing stigma, outing, or partner coercion. Review for safety, consent, privacy under adversarial conditions. Focus on: (1) Outing risk — notification text, app icon/name revealing sexual health info on locked/shared device. Check notificationService.js, moduleSmallIconName. (2) Partner coercion — decoy mode (fake PIN → different data), anonymise reversibility. Check App.jsx decoy logic, anonymiseToggleGuard. (3) Data leakage paths — clipboard/share sheet/browser without consent, share profile shows what transfers. Check fileExportHelper.js shareText(), ShareProfilePanel. (4) Screenshot/visibility — FLAG_SECURE default, opt-in screenshots, app switcher. (5) Backup safety — raw PII, encryption, stolen backup readability. Check backupService.js, cryptoService.js. (6) Widget privacy — defaults redacted, per-widget tiers. Check widgetPrivacy.js, ALLOWED_AT_REDACTED. (7) Consent & control — delete all data, clear sample data vs reset, undo deletes, true purge vs archive. (8) Language — supportive not shaming, inclusive terms, no victim-blaming.
>
> Output: safety risks ranked by severity (outing/coercion → high; minor UX → low), with specific scenarios and concrete mitigations.

**Key files:** `src/storage/notificationService.js`, `src/storage/backupService.js`, `src/storage/cryptoService.js`, `src/storage/screenSecurityService.js`, `src/storage/widgetPrivacy.js`, `src/storage/fileExportHelper.js`, `src/modules/SHOS_Contacts_Prototype.jsx`, `src/App.jsx`

---

## Role 4 — UX/Accessibility Reviewer

**Focus:** Usability, inclusive design, keyboard navigation, screen reader support, visual clarity.

**Prompt:**
> You are a UX/accessibility reviewer for SHOS-V2. Review the app's interface for usability and accessibility. Focus on: (1) Keyboard navigation — can every action be reached and activated via keyboard? Check role="button" + tabIndex + onKeyDown patterns. (2) Screen reader — are aria-label, aria-pressed, aria-checked, aria-live used correctly? Check segmented chips, toggles, FABs. (3) Visual clarity — contrast ratios (especially white-on-colour fills), font sizes (12sp floor), touch targets (44dp minimum). (4) Information architecture — is the Settings screen navigable (57+ rows)? Is search/filter needed? (5) Empty states — do empty sections hide or show placeholders consistently? (6) Error feedback — are errors shown inline with plain language? (7) Onboarding — is the first-run experience clear and not overwhelming? (8) Inclusive language — pronouns, gender, relationship types, partner terminology.
>
> Output: UX/a11y issues with screen/component references, severity, and suggested improvements. Prioritize issues that block users with disabilities or make core tasks confusing.

**Key files:** `src/modules/*.jsx`, `src/components/*`, `src/i18n/en.json`, `src/i18n/en-US.json`

---

## Role 5 — QA/Test Reviewer

**Focus:** Test coverage, edge cases, regression risk, guard test honesty.

**Prompt:**
> You are a QA reviewer for SHOS-V2. Review the test suite for coverage gaps and reliability. Focus on: (1) Coverage gaps — which screens/features have no tests? Check encounter detail, contact detail, medication log, vaccination records, symptom log. (2) Edge cases — empty data, archived records, PRN medications, partial test panels, timezone boundaries. (3) Guard test honesty — do guard tests actually assert meaningful behaviour, or do they pass vacuously? Check styleColourGuard baseline, isSeedAuthorityGuard, widget guards. (4) Flaky tests — any tests depending on real clock/date? Check reminderDueShapes, snapshotFidelity. (5) Skipped tests — what's skipped and why? (6) Integration coverage — are there end-to-end flows tested (add contact → log encounter → check stats)? (7) Device-only paths — what can only be verified on a real device (share sheet, GPS, notifications)?
>
> Output: coverage gaps ranked by risk, specific untested scenarios, and recommendations for new tests. Flag any guard that could pass vacuously.

**Key files:** `src/**/*.test.js`, `src/calculations/*Guard*`, `src/components/*Guard*`

---

## Role 6 — Data & Migration Reviewer

**Focus:** Schema evolution, backup/restore fidelity, seed data integrity, migration safety.

**Prompt:**
> You are a data/migration reviewer for SHOS-V2. Review data handling for correctness across versions. Focus on: (1) Backup/restore round-trip — does every repository's data survive export→import? Check backupService.js gather/restore loops. (2) Schema migrations — are old backups migrated (backupMigrations.js)? Are there version checks? (3) Seed data — is the frozen snapshot (seedDivergence.js) in sync with repository output? Check seedSnapshotCoverage, snapshotFidelity. (4) ID migration — are legacy IDs normalized (seedIdMigration)? (5) Storage adapter — localStorage vs IndexedDB vs Capacitor; is there a size limit? (6) Data loss risks — does "clear sample data" ever delete real records? (isSeed authority). (7) Concurrency — are repository writes atomic? Could two tabs corrupt data?
>
> Output: data integrity risks with specific scenarios (e.g., "restore a v1 backup on v2 app"). Flag anything that could cause silent data loss.

**Key files:** `src/storage/backupService.js`, `src/storage/backupMigrations.js`, `src/calculations/seedDivergence.js`, `src/calculations/seedIdMigration.js`, `src/repositories/*Repository.js`

---

## Role 7 — Localization & Content Reviewer

**Focus:** Translations, tone, medical terminology, inclusive language, content accuracy.

**Prompt:**
> You are a localization/content reviewer for SHOS-V2. Review text, translations, and content. Focus on: (1) Translation completeness — are all user-facing strings in en.json and en-US.json? Are there hardcoded English strings in JSX? (2) Tone — is the language supportive, non-judgmental, and appropriate for sexual health? (3) Medical terminology — are STI names, medication terms, and clinical phrases accurate? (4) Inclusivity — pronouns, gender options, relationship types, partner terminology. (5) British vs American spelling — is the toggle (en-GB/en-US) consistent? (6) Empty-state copy — are placeholders helpful ("No notes yet" vs blank)? (7) Error messages — are they plain-language and actionable? (8) Consent language — does sharing clearly state what transfers and what doesn't?
>
> Output: content issues with file:line references, severity, and suggested rewording. Flag anything culturally insensitive or clinically inaccurate.

**Key files:** `src/i18n/en.json`, `src/i18n/en-US.json`, `src/modules/*.jsx` (hardcoded strings), `src/storage/profileShareService.js` (FIELD_LABELS)

---

## Role 8 — DevOps & Release Reviewer

**Focus:** CI/CD, build reproducibility, release process, monitoring.

**Prompt:**
> You are a DevOps/release reviewer for SHOS-V2. Review the build and release pipeline. Focus on: (1) CI gates — does `npm run verify` run on every push? Are all gates (build, lint, tests, encoding, smoke, docs) enforced? (2) Build reproducibility — `npm ci` vs `npm install`, Node version consistency across workflows. (3) APK release — is the release tag force-updated correctly? Does the APK get published to a public release? (4) Web deploy — is the GitHub Pages deploy gated? (5) Secrets — are API keys/tokens handled securely? (6) Monitoring — is there crash reporting or error logging in production? (7) Versioning — is version.json stamped per release? (8) Rollback — can a bad release be reverted easily?
>
> Output: pipeline gaps with workflow file references, severity, and recommended fixes. Flag anything that could publish a broken build.

**Key files:** `.github/workflows/*`, `package.json` (scripts), `scripts/*`, `capacitor.config.json`

---

## Role 9 — Sexual Health Peer / Community Reviewer

**Focus:** Lived experience, stigma, harm reduction, community appropriateness.

**Prompt:**
> You are a sexual-health peer reviewer with lived experience in the LGBTQ+ and sexual-health communities. Review SHOS-V2 for community appropriateness and real-world usefulness. Focus on: (1) Stigma reduction — does the app feel safe to use? Would you be comfortable if someone saw your screen? (2) Harm reduction — are PrEP/PEP, testing, and safer-sex information presented non-judgmentally? (3) Real-world workflows — does the app match how people actually track sexual health (encounters, partners, tests)? (4) Language — are terms community-appropriate (not clinical/cold)? (5) Missing features — what would a user in this community expect that's absent? (6) Trust — does the app earn trust through transparency (what's stored, what's shared, what's never shared)? (7) Accessibility for marginalized users — low literacy, non-native English, limited tech access. (8) Safety planning — does the app help users in unsafe situations (coercion, abuse, STI exposure notification)?
>
> Output: community feedback with specific screens/features, severity (would stop someone using the app → high; minor → low), and suggested improvements. Be honest about what feels wrong or missing.

**Key files:** All UI modules, `src/i18n/*`, `src/storage/profileShareService.js`, `src/modules/SHOS_Contacts_Prototype.jsx` (SafetyShareSheet)

---

## Role 10 — Performance & Battery Reviewer

**Focus:** Runtime performance, battery impact, memory, offline efficiency.

**Prompt:**
> You are a performance reviewer for SHOS-V2. Review for runtime efficiency and battery impact. Focus on: (1) Render performance — are there unnecessary re-renders? Check useMemo/useCallback usage in large lists (Contacts, Encounters). (2) Data loading — are repositories loaded once and cached, or re-fetched per render? Check useLoadedMemo pattern. (3) Widget sync — does syncAllWidgets run too frequently? Is the serialized queue effective? (4) Notification scheduling — are notifications batched or scheduled individually? (5) Storage — localStorage vs IndexedDB; size limits; compaction. (6) Network — Nominatim calls: debounced? Rate-limited? (7) Memory — large seed data (93 records) loaded into memory; is it paginated? (8) Battery — geolocation, background sync, notification polling frequency.
>
> Output: performance bottlenecks with file:line references, estimated impact, and recommended optimizations. Flag anything that would cause jank or battery drain on a mid-range Android device.

**Key files:** `src/modules/SHOS_Contacts_Prototype.jsx`, `src/modules/SHOS_Encounters_Prototype.jsx`, `src/calculations/syncAllWidgets.js`, `src/storage/locationService.js`, `src/repositories/*Repository.js`

---

## Suggested review order

1. **Privacy & Coercion-Safety** (Role 3) — highest stakes for this user population.
2. **Clinical** (Role 2) — medical accuracy matters.
3. **Technical** (Role 1) — foundation for everything else.
4. **UX/Accessibility** (Role 4) — usability for all users.
5. **QA/Test** (Role 5) — coverage and regression risk.
6. **Data & Migration** (Role 6) — data integrity across versions.
7. **Localization & Content** (Role 7) — language and tone.
8. **DevOps & Release** (Role 8) — pipeline reliability.
9. **Sexual Health Peer/Community** (Role 9) — lived-experience feedback.
10. **Performance & Battery** (Role 10) — runtime efficiency.

---

## Output format (all roles)

```
## [Role Name] Review — [Date]

### Summary
One-paragraph overview of findings.

### Findings
| # | Severity | Area | Finding | File/Screen | Recommended Fix |
|---|----------|------|---------|-------------|-----------------|

### Blocking issues (must fix before release)
- ...

### Non-blocking improvements
- ...

### What works well
- ...
```
" path">
C:\Users\kanem\SHOS-V2\REVIEWERS.md