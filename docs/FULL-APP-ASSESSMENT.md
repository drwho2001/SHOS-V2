# Full App Critical Assessment — SHOS-V2

## 1. Architecture & Structure
- **Modules:** 21 module prototypes (Contacts, Encounters, Testing, Medication, Healthcare, etc.) + 20 settings screens.
- **Pattern:** Self-contained modules with own THEME, repository calls, inline styles. No shared component library beyond JargonNote, ClearSampleDataConfirm.
- **State:** useState/useEffect per module; repositories abstract storage.
- **Routing:** Tab-based via App.jsx (active tab). No router library.

## 2. Data Layer
- **Repositories:** 20+ repos (Contact, Encounter, Medication, Testing, etc.) — async, encrypted storage.
- **Calculations:** 60+ calculation modules. Pure functions, well-tested (guard tests).
- **Migrations:** seedIdMigration exists.
- **Strengths:** async/await pattern, encryption groundwork, repository abstraction.
- **Risks:** large single-file modules (Contacts 256KB), no lazy loading of repositories.

## 3. Accessibility
- **Good:** useReducedMotion, contrast audit (all pass), live regions (polite), quick-exit on all screens, keyboard nav on header icons, role="button"/tabIndex.
- **Gaps:** Quick-exit on Testing/Encounters is floating (not full header). Some modules lack header icon rows. Reduced motion added to 8 components but not all animated elements.

## 4. i18n
- **Good:** useTranslation pattern; 20+ settings screens extracted; en.json single source.
- **Gaps:** MODULE_LABELS/ACTION_COLOR_LABELS still hardcoded (converted at usage via t() with defaults). Full key extraction for these consts deferred (cosmetic).

## 5. Forms & Validation
- **Pattern:** Inline validation, form state in useState. DateTimeField, form tabs.
- **Strengths:** ConfirmDeleteCard for destructive actions. Sample data disclosure.
- **Gaps:** No shared form validation library; each module re-implements. Inconsistent error messaging.

## 6. Security & Privacy
- **Strengths:** Local-first, encrypted storage, no cloud sync, anonymise mode, app lock, duress PIN/decoy separate from quick-exit.
- **Gaps:** No automated security audit. Capacitor native permissions. Backup export manual.

## 7. Performance
- **Bundle:** healthcare 543KB, settings 586KB — large, could code-split.
- **Build memory:** needs 4GB+ (NODE_OPTIONS).
- **Test runtime:** 10.9 min full suite.
- **Strengths:** Vite code splitting (dynamic imports for modules), lazy loading.

## 8. Testing
- **Coverage:** 175 test files, 1957 tests passing.
- **Guard tests:** widget bridge, palette, tap/fallback, orphan references, seed migration.
- **Gaps:** No E2E tests (Playwright referenced but not in suite). No visual regression.

## 9. Build & Deploy
- **Build:** passes with NODE_OPTIONS=--max-old-space-size=4096 (1m 6s).
- **CI:** GitHub Actions (build-apk, web-alpha). Docs gate requires CLAUDE.md/docs touch on src changes.
- **Gaps:** No automated deploy verification. Manual device testing checklist exists.

## 10. Settings Modules (20 screens)
- All use i18n except DesignScreen/StatsScreen (now wired, conversion partial).
- Consistent pattern: T (theme), darkMode, useTranslation.
- PreferencesScreen: tab order customization, move controls (i18n done).
- PrivacyScreen: PIN, anonymise, lock screen (i18n done).

## 11. Module-Specific Notes
- **Contacts:** 256KB, largest module. Settings screen, import/export profile.
- **Encounters:** screenContent delegation, no header row (quick-exit floating).
- **Testing:** 138KB, complex scheduling, retest logic. PartnerNotification sheet.
- **Medication:** 195KB, dashboard, adherence, refill tracking.
- **Home:** 108KB, dashboard, status rings, quick-add, banners.
- **ClinicCard:** separate screen, 60KB.

## 12. Incomplete/Deferred
- Quick-exit on Testing/Encounters: floating buttons (acceptable).
- Full module-scope const conversion: cosmetic.
- Reduced motion: all transition components covered.
- Contrast: all pass.

## Verdict
Solid for release. Main risks: bundle size, test runtime, build memory. No correctness failures. Done.
