# Customizable Stats Plan — SHOS-V2 (revised v2)

## Structure: single Stats page under Settings
Like other settings screens (StatsScreen already exists). One central "Stats" screen aggregating data from all modules. Not per-module tabs.

- Location: src/modules/settings/StatsScreen.jsx (already exists, currently shows testing/medication/clinic visit stats)
- Expand to include encounters, menstrual, vaccination, symptom stats
- Add customizable metric picker + date range
- Add chart visualizations (CSS bars, no external lib)

## Architecture
- Extend StatsScreen.jsx (already has useTranslation, dialog, StatRow)
- Add statsAggregator.js (pure functions) — aggregates across modules
- Metric picker: checkboxes to show/hide metrics
- Date range: 7d/30d/90d/all/custom
- Group by: none/partner/location/month
- Persist layout in appPreferencesRepository

## Metrics catalog
Encounters: total, unique partners, loads, fists, kinks, top kink, top partner, top location, avg duration, trend by month
Medication: 7d/30d/all-time adherence, missed doses, top med
Testing: tests/month, avg interval, positive ratio, BASHH compliance
Healthcare: visits/year, vaccinations, symptoms, menstrual cycle avg
Chemicals: usage frequency, trend

## Brutal critique
- Privacy: stats on screen = exposure. Mitigate: anonymise mode, quick-exit.
- Performance: aggregation on render. Mitigate: useMemo, caching.
- Scope creep: keep phases small.

## Phased plan
Phase 1: Add encounters + menstrual + vaccination stats to StatsScreen — 4h
Phase 2: Add metric picker (show/hide) — 3h
Phase 3: Add date range selector — 3h
Phase 4: Add group-by (partner/location/month) — 4h
Phase 5: Simple charts (CSS bars) — 3h
Phase 6: Export to CSV — 2h
Total: ~19h

## Dependencies
- sessionTally, getTestingFrequencyStats, getOverallAdherence (exist)
- No new repos; aggregate from existing.

## Start
Phase 1: extend StatsScreen with encounters/menstrual/vaccination stats.
