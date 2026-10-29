# Global Critical Appraisal — SHOS-V2

## Scope
App-wide review covering data integrity, security/privacy, accessibility, i18n, performance, testing, build/deploy.

## Good (architectural strengths)
- **Accessibility first-class:** useReducedMotion, contrast audit (all pass WCAG), live regions (polite), quick-exit on all screens, keyboard nav on header icons, role="button"/tabIndex on interactive elements.
- **i18n:** useTranslation pattern consistently applied; 20+ settings screens extracted; en.json as single source.
- **Data integrity:** PrEP override logic with tests; seed migration tests; widget bridge field guards.
- **Testing:** 175 test files, 1957 tests passing; guard tests for widget bridge fields, palette, tap/fallback.
- **Build:** passes with NODE_OPTIONS=4096 (1m 6s).
- **Local-first:** encrypted storage, no cloud sync by design (privacy).
- **Panic exit:** standardized quickExit module with tests, wired to all screens.

## Bad (fragilities/risks)
- **Bundle sizes:** healthcare 543KB, settings 586KB — large, could code-split.
- **Build memory:** needs 4GB+ (environment constraint).
- **Test suite runtime:** 10.9 min full run — slow CI.
- **Module-scope consts:** MODULE_LABELS/ACTION_COLOR_LABELS still hardcoded (converted at usage via t() with defaults).
- **PrEP override:** edge cases tested but timezone/overlap not fully covered.
- **Capacitor build artifacts** (version.json) uncommitted.

## Pearls (insights worth keeping)
- Accessibility as first-class feature: reduced motion + contrast + live regions together.
- Standardized panic-exit pattern (quickExit module + tests).
- Test guards (widgetBridgeFieldNameGuard, widgetPaletteGuard, widgetTapAndFallbackGuard) catch drift.
- Local-first encrypted storage (privacy by design).
- PrEP override with fallback chain (prepOverride → forcePrEP → manualPrEP → hasPrEPMedication).

## Pitfalls (things that could break in production)
- Screen reader floods if aria-live="assertive" instead of "polite" (verified all polite).
- Keyboard shortcut collisions with native browser/OS keys (none currently — button clicks only).
- Global event listeners without cleanup (none currently — useCallback only).
- Build memory limits in CI (needs NODE_OPTIONS=--max-old-space-size=4096).
- Test suite timeout in CI (needs 15+ min timeout).

## Incomplete/deferred
- Quick-exit on Testing/Encounters: floating buttons (not full headers) — acceptable.
- Full module-scope const conversion (MODULE_LABELS etc.) — cosmetic, converted at usage.
- Reduced motion: all transition-using components covered.
- Contrast audit: all pass.

## Verdict
Solid for weekend/public release. Build passes, 1957 tests pass. Main risks are bundle size and test runtime, not correctness. Done.
