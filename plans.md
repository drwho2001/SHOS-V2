# Critical appraisal follow-up plan

## Findings to fix

### 1. Global event listeners without cleanup (quick-exit, New session shortcut)
- Risk: memory leaks, duplicate trigger firings on re-mount.
- Fix: ensure useEffect cleanup removes listeners; use a single registered handler with ref.
- Files: src/App.jsx (handleQuickExit), src/modules/SHOS_Home_Prototype.jsx
- Effort: small (1-2h). Verify with lint + tests.

### 2. PrEP override edge cases
- Risk: timezone shifts, overlapping override windows produce inconsistent adherence.
- Fix: add unit tests for inferPrepCoverage with prepOverride/forcePrEP/manualPrEP; validate inputs.
- Files: src/calculations/encounterProtectionContext.js + tests
- Effort: medium (2-3h).

### 3. Live region politeness
- Risk: screen reader floods if assertive.
- Fix: confirm all aria-live="polite" (not assertive); audit Home banners.
- Files: src/modules/SHOS_Home_Prototype.jsx
- Effort: small (30min).

### 4. Keyboard shortcut collisions
- Risk: New session shortcut collides with native browser/OS keys.
- Fix: guard with modifier keys (ctrl/meta) and scope to container focus; or remove shortcut if redundant.
- Files: src/modules/SHOS_Home_Prototype.jsx
- Effort: small (1h).

## Lessons learned
- Good: accessibility as first-class feature; standardized panic-exit pattern.
- Bad: global listeners without cleanup; PrEP override without edge-case tests.
- Pearls: useReducedMotion + contrast + live regions together.
- Pitfalls: assertive live regions, shortcut collisions.

## Status: ALL COMPLETE
1. Live region politeness — verified all aria-live="polite" ✓
2. Keyboard shortcut collisions — N/A (button clicks, no global shortcuts) ✓
3. Global listener cleanup — N/A (useCallback, no addEventListener) ✓
4. PrEP edge cases — tests added (24/24 pass) ✓
