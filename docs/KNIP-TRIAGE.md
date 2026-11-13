# Knip dead-code triage (report-only)

Generated from a knip 6.45.1 scan (entry `src/main.jsx`, project `src/**/*.{js,jsx}`, tests ignored). Knip was uninstalled after the scan; this file is the persisted record. No code was removed.

## Summary

- Unused dependencies: 1 (`capacitor-widget-bridge`)
- Unused devDependencies: 3 (`@testing-library/user-event`, `axe-core`, `qrcode`)
- Unlisted dependencies: 2 (`@babel/parser` in glossaryPropChain.js, `@vitest/coverage-v8` in vitest.config.ts)
- Unused exports: 84
- Duplicate exports (named + default): 29 — these are false positives; consumers use the default export via `lazy(() => import(...))`.

## False positives (do not touch)

- **Settings screens** (AboutScreen … WidgetsScreen): exported both named and default; loaded via `lazy()` default import. Named export unused but harmless.
- **Sync helpers** (cycleWidgetSync, liveSessionWidgetSync, syncAllWidgets, useReducedMotion, jargonNotes, FormTabs, HivStatusNote, JargonNote, Skeleton): same named/default pattern.
- **Constants referenced only by guard tests**: many `*_FLAG_KEY`, `*_OPTIONS`, redacted-line helpers exist to be asserted by `*.test.js` guards; knip ignores tests, so these read as unused but are intentional invariants.

## Genuinely unwired feature code (candidates for wiring or removal)

These have zero non-test callers. Decide per item whether to wire into UI or delete.

| Export | File | Likely feature |
|---|---|---|
| generateClinicCardPdf | storage/clinicCardPdfService.js | Clinic-card PDF export (no UI trigger) |
| importProfileAsContact | storage/profileShareService.js | Import a shared profile as a contact |
| recordsToCSV | storage/csvExportService.js | CSV record export |
| getVaultError, derivePinVerifier, clearGraceWindow, hasPinProtection | storage/cryptoService.js | PIN/vault protection flows |
| secureRemove | storage/secureStorageAdapter.js | Secure storage deletion |
| updateRefillWidget | calculations/refillReminderSync.js | Refill widget refresh |
| applyDisclosure | calculations/disclosureLevel.js | Disclosure-level privacy control |
| encountersForContact, encounterCount, averageEnjoyment, highestEnjoyment, lastInteraction | calculations/encounterCalculations.js | Encounter stats/aggregates |
| getVaccinationDoseKey | calculations/vaccinationCalculations.js | Vaccination dose keying |
| getUpcomingBookedVisits, getSoonestBookedVisit, clinicCardRedactedLine | calculations/clinicVisitReminderSync.js | Booked-visit reminders |
| normaliseAcknowledgement | calculations/reminderSuppression.js | Reminder acknowledgement normalisation |
| updateCycleWidget | calculations/cycleWidgetSync.js | Cycle widget refresh |
| updateLiveSessionWidget | calculations/liveSessionWidgetSync.js | Live-session widget refresh |
| syncAllWidgets | calculations/syncAllWidgets.js | Bulk widget sync |
| declaredInFile | components/glossaryPropChain.js | Glossary prop-chain diagnostic |
| SkeletonRow | components/Skeleton.jsx | Skeleton row component |
| TOUR_STEPS | modules/InteractiveTour.jsx | Tour step data |

## Other unused exports (likely dead / internal)

EXPORT_INCLUDE_RECENT_CONTACTS_KEY, setExportIncludeRecentContacts, CONTACT_REQUIRED_FIELD_GROUPS, supportsTarget, detectDuplicateCandidates, FONT_FAMILY_MONO, EXPOSURE_WINDOWS_DAYS, unclearedInfectionsForTest, U_U_EXPLANATION, REMINDER_KINDS, ACK_SCOPES, lastTestRedactedLine, SETTING_LABELS, ALLOWED_AT_REDACTED, REDACTED_COPY, elementBridgeField, elementVisible, EXPANSION_FLAG_KEY, KINK_ROLE_STYLE, KINK_DETAIL_PACKS, PEP_ADDED_FLAG, CUMMER_OPTIONS, SAMPLE_TYPE_MIGRATION_FLAG, CVD_SAFE_PALETTE, DEFAULT_NOTIFICATION_ITEM, DEFAULT_NOTIFICATION_LIST, SETTING_OPTIONS, DEFAULT_VAGINAL_HEALTH_ENTRY, RELEASE_PAGE_URL, getVaultError (dup), recordsToCSV (dup).

## Recommendation

Do not auto-delete. Review each Category-"unwired feature" item: either wire it into the UI (if the feature is intended) or remove it plus its tests. Keep guard-test-only constants. Keep `capacitor-widget-bridge` only if widgets are in use (they are Android-native; verify before removing).
