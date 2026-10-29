# Customizable Stats Plan — SHOS-V2

## Vision
A "Stats" dashboard where users pick metrics, date ranges, and groupings to see their own patterns. Plus an "Encounters" sub-page ("slut mode") showing raw tallies.

## Architecture
- New module: SHOS_StatsBuilder_Prototype.jsx
- Repository: statsQueryRepository (aggregates from existing repos)
- Calculation: statsAggregator.js (pure functions, testable)
- UI: metric picker (checkboxes), date range, group-by dropdown, chart (recharts or canvas)
- Persistence: save user's preferred stat layout in appPreferencesRepository

## Metrics catalog
Encounters: total, unique partners, loads, fists, kinks, top kink, top partner, top location, avg duration, trend by month
Medication: 7d/30d/all-time adherence, missed doses, top med
Testing: tests/month, avg interval, positive ratio, BASHH compliance
Healthcare: visits/year, vaccinations, symptoms
Chemicals: usage frequency, trend

## Brutal critique
- **Privacy risk:** Detailed stats on screen = more exposure if phone shared. Need anonymise mode support.
- **Performance:** Aggregating across all repos on every render = slow. Need memoization + caching.
- **Complexity:** Customizable UI is a rabbit hole. Start with fixed views, add customization later.
- **Data quality:** Stats are only as good as logged data. Garbage in = garbage out. Show "not enough data" honestly.
- **Chart library:** Adding recharts = bundle size increase. Use canvas or simple CSS bars first.
- **Scope creep:** Don't build everything. Start with Encounters sub-page (slut mode) + 3 fixed stats views.

## Phased plan
Phase 1: Encounters sub-page with fixed tallies (loads, people, fists, kinks, top kink) — 4h
Phase 2: Stats dashboard with 3 fixed views (Encounters, Medication, Testing) — 6h
Phase 3: Customizable metric picker + date range — 8h
Phase 4: Charts (canvas-based) — 4h
Phase 5: Export stats to CSV — 2h
Total: ~24h

## Risks
- Privacy: stats on screen = exposure. Mitigate: anonymise mode, quick-exit.
- Performance: aggregation on every render. Mitigate: useMemo, caching.
- Scope creep: keep phases small, ship incrementally.

## Dependencies
- sessionTally (exists)
- getTestingFrequencyStats, getOverallAdherence (exist)
- MenstrualCycleRepository.getAverageCycleLengthDays (exists)
- No new repos needed; aggregate from existing.

## Start
Phase 1: Encounters sub-page. Add to Testing or Encounters module as a tab.
