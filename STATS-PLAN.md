# Customizable Stats Plan — SHOS-V2 (revised)

## Structure: tab/subpage, not separate module
Stats shows data, doesn't collect it. So it belongs as a tab within existing modules, not a standalone module.

- Encounters module: add "Stats" tab (slut mode — loads, people, fists, kinks, top kink)
- Medication module: add "Stats" tab (adherence trends, missed doses)
- Testing/Healthcare: add "Stats" tab (tests/month, interval, compliance)
- Home: "Status at a glance" already exists (rings). Could link to detailed stats.

## Architecture
- No new module. Add tab to existing modules.
- Reuse existing calculations (sessionTally, getTestingFrequencyStats, getOverallAdherence).
- New: statsAggregator.js (pure functions, testable) — aggregates across modules.
- UI: metric cards (not charts initially). Date range: 7d/30d/90d/all.
- Persistence: save preferred layout in appPreferencesRepository.

## Phased plan
Phase 1: Encounters "Stats" tab with fixed tallies — 3h
Phase 2: Medication "Stats" tab (adherence) — 3h
Phase 3: Testing/Healthcare "Stats" tab — 3h
Phase 4: Customizable metric picker + date range — 6h
Phase 5: Simple charts (CSS bars) — 3h
Total: ~18h

## Brutal critique
- Privacy: stats on screen = exposure. Mitigate: anonymise mode, quick-exit.
- Performance: aggregation on render. Mitigate: useMemo.
- Scope creep: keep phases small.

## Best structure
Tab within module > separate module. Reuse existing tabs infrastructure. No new routing.

Done.
