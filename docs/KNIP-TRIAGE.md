# Knip dead-code triage (report-only)

Generated from a knip 6.45.1 scan (entry `src/main.jsx`, project `src/**/*.{js,jsx}`, tests ignored). Knip was uninstalled after the scan; this file is the persisted record. No code was removed.

## Summary

- Unused dependencies: 1 (`capacitor-widget-bridge`)
- Unused devDependencies: 3 (`@testing-library/user-event`, `axe-core`, `qrcode`)
- Unlisted dependencies: 2 (`@babel/parser` in glossaryPropChain.js, `@vitest/coverage-v8` in vitest.config.ts)
- Unused exports: 84
- Duplicate exports (named + default): 29 — false positives; consumers use the default export via `lazy(() => import(...))`.

## False positives (do not touch)

- **Settings screens** (AboutScreen … WidgetsScreen): exported both named and default; loaded via `lazy()` default import. Named export unused but harmless.
- **Sync helpers** (cycleWidgetSync, liveSessionWidgetSync, syncAllWidgets, useReducedMotion, jargonNotes, FormTabs, HivStatusNote, JargonNote, Skeleton): same named/default pattern.
- **Constants referenced only by guard tests**: many `*_FLAG_KEY`, `*_OPTIONS`, redacted-line helpers exist to be asserted by `*.test.js` guards; knip ignores tests, so these read as unused but are intentional invariants.
- **Internal helpers of wired features**: `generateClinicCardPdf`, `importProfileAsContact`, `recordsToCSV`, etc. are used only inside their own module (by their wrapper exports like `exportClinicCardPdf`). Not missing features.

## Candidate items: simple-language assessment

### A. Convenience wrapper never called — superseded
- **applyDisclosure** (`disclosureLevel.js`) — reads stored disclosure level and resolves text against it. UI calls `resolveDisclosure(level, text)` directly. **Superseded.** Recommendation: make it the single entry point or delete.

### B. Minor robustness gaps — not features, just missing cleanup/error surfacing
- **getVaultError** (`cryptoService.js`) — returns last vault error. Never surfaced; failures handled via thrown exceptions. Wire into lock screen or remove.
- **clearGraceWindow** (`cryptoService.js`) — clears temp grace-unlock window. Never called; windows only overwritten. Call on PIN change/disable.
- **hasPinProtection** (`cryptoService.js`) — checks whether PIN is set. UI tracks PIN via settings flag instead. Use as single source of truth.
- **secureRemove** (`secureStorageAdapter.js`) — deletes a secure-storage key. Never called; vault data never explicitly purged. Call on data reset.
- **RELEASE_PAGE_URL / RELEASE_APK_URL** (`updateCheckService.js`) — convenience links. Never shown. Wire into About screen or remove.

### C. Superseded aggregate constant
- **CUMMER_OPTIONS** (`contactRepository.js`) — combined list; superseded by split `CUMMER_FREQUENCY_OPTIONS` / `CUMMER_VOLUME_OPTIONS` / `CUMMER_STYLE_OPTIONS`. Delete.

### D. Intentional / leave alone
- Registry/repository constants (KINK_ROLE_STYLE, KINK_DETAIL_PACKS, EXPANSION_FLAG_KEY, PEP_ADDED_FLAG, SAMPLE_TYPE_MIGRATION_FLAG, CVD_SAFE_PALETTE, DEFAULT_NOTIFICATION_*, SETTING_OPTIONS, DEFAULT_VAGINAL_HEALTH_ENTRY, TOUR_STEPS, SkeletonRow, etc.) — used via string keys and guard tests. Not bugs.
