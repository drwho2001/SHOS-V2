# Pitfall Fix Plan — SHOS-V2

## Pitfalls identified (from GLOBAL-APPRAISAL.md)

### P1. Bundle size (healthcare 543KB, settings 586KB)
- Fix: code-split large modules via React.lazy + dynamic import
- Files: src/App.jsx, module files
- Effort: 4-6h. Risk: medium (routing changes).

### P2. Build memory (needs 4GB+)
- Fix: optimize Vite config, reduce transform parallelism, or split build
- Files: vite.config.js
- Effort: 2-3h. Risk: low.

### P3. Test suite runtime (10.9 min)
- Fix: parallelize tests, reduce setup overhead, split into shards
- Files: vitest.config.js
- Effort: 3-4h. Risk: low.

### P4. Module-scope consts hardcoded (MODULE_LABELS, ACTION_COLOR_LABELS)
- Fix: move to en.json with t() calls (already converted at usage)
- Files: DesignScreen.jsx, en.json
- Effort: 1h. Risk: low.

### P5. PrEP edge cases (timezone/overlap)
- Fix: add unit tests for timezone shifts and overlapping override windows
- Files: encounterProtectionContext.js + tests
- Effort: 2-3h. Risk: medium.

### P6. Capacitor build artifacts uncommitted
- Fix: gitignore version.json, commit capacitor changes
- Files: .gitignore, android/
- Effort: 30min. Risk: low.

### P7. No E2E/visual regression tests
- Fix: add Playwright E2E for critical flows (login, quick-exit, add record)
- Files: e2e/
- Effort: 8-12h. Risk: medium.

### P8. Quick-exit on Testing/Encounters (floating buttons)
- Fix: add full header rows (invasive, needs careful refactor)
- Files: SHOS_Testing_Prototype.jsx, SHOS_Encounters_Prototype.jsx
- Effort: 3-4h. Risk: high.

## Execution order (priority)
1. P6 (30min) — quick win
2. P4 (1h) — cosmetic
3. P5 (2-3h) — data integrity
4. P2 (2-3h) — build speed
5. P3 (3-4h) — CI speed
6. P1 (4-6h) — perf
7. P8 (3-4h) — UX polish
8. P7 (8-12h) — long-term

Total: ~24-34h. Each committed separately.
