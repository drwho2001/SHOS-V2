# Customizable Stats Plan — SHOS-V2 (revised v3)

## High-demand stats (40%+ users want these)
- Total encounters + unique partners
- Days since last test + BASHH compliance
- 7-day medication adherence
- Last encounter (partner, date, type)
- Next clinic visit
- Active session summary (if any)
- Contraception due date
- Cycle day (if tracked)

## Slut mode (risque/kinky data, toggle in settings)
- Total loads, fists, kinks tallies
- Top kinks by frequency
- Top partners by encounter count
- Top locations
- Chem usage frequency
- Bottoming/topping ratio
- Encounter type breakdown (solo/duo/group)
- Average encounter duration
- Most active day of week/month

## Structure: single Stats page under Settings
One central "Stats" screen. Toggle "Slut mode" in settings to show risque section.

## Architecture
- Extend StatsScreen.jsx
- Add statsAggregator.js (pure functions)
- Metric picker: checkboxes to show/hide
- Date range: 7d/30d/90d/all
- Group by: none/partner/location/month
- Persist layout in appPreferencesRepository
- Slut mode toggle in privacy/settings

## Phased plan
Phase 1: High-demand stats (encounters total, partners, last test, adherence, last encounter, next visit, contraception, cycle) — 4h
Phase 2: Slut mode section (loads, fists, kinks, top kink/partner/location, chems) — 4h
Phase 3: Metric picker + date range — 3h
Phase 4: Group-by (partner/location/month) — 4h
Phase 5: Simple charts (CSS bars) — 3h
Phase 6: Export to CSV — 2h
Total: ~20h

## Brutal critique
- Privacy: stats on screen = exposure. Mitigate: anonymise mode, quick-exit, slut mode toggle.
- Performance: aggregation on render. Mitigate: useMemo, caching.
- Scope creep: keep phases small.

## Dependencies
- sessionTally, getTestingFrequencyStats, getOverallAdherence (exist)
- No new repos; aggregate from existing.

## Start
Phase 1: extend StatsScreen with high-demand stats.
