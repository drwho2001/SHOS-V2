# Customizable Stats Plan — SHOS-V2 (revised v4)

## High-demand stats (40%+ users want these)
- Total encounters + unique partners
- Days since last test + BASHH compliance
- 7-day medication adherence
- Last encounter (partner, date, type)
- Next clinic visit
- Active session summary (if any)
- Contraception due date
- Cycle day (if tracked)

## Advanced stats (toggle in settings, off by default)
Detailed encounter breakdown: loads, fists, kinks, top kink/partner/location, chem usage, bottoming/topping ratio, encounter type breakdown, avg duration, most active day.

## Structure: single Stats page under Settings
One central "Stats" screen. Toggle "Advanced stats" in settings to show detailed section.

## Architecture
- Extend StatsScreen.jsx (already has useTranslation, dialog, StatRow)
- Add statsAggregator.js (pure functions) — aggregates across modules
- Metric picker: checkboxes to show/hide
- Date range: 7d/30d/90d/all/custom
- Group by: none/partner/location/month
- Persist layout in appPreferencesRepository

## Customizable charts
- User selects: metric + date range + group-by
- Chart types: bar, line, pie (CSS-based, no external lib)
- Drill-down: tap a bar to see underlying records
- Filter by partner, location, kink, chem, encounter type
- Trend: rolling 7-day/30-day averages

## Brutal critique
- Privacy: stats on screen = exposure. Mitigate: anonymise mode, quick-exit, toggle.
- Performance: aggregation on render. Mitigate: useMemo, caching.
- Scope creep: keep phases small.

## Phased plan
Phase 1: High-demand stats (encounters total, partners, last test, adherence, last encounter, next visit, contraception, cycle) — 4h
Phase 2: Advanced stats section (loads, fists, kinks, top kink/partner/location, chems) — 4h
Phase 3: Metric picker + date range — 3h
Phase 4: Group-by (partner/location/month) — 4h
Phase 5: Simple charts (CSS bars) — 3h
Phase 6: Export to CSV — 2h
Total: ~20h

## Dependencies
- sessionTally, getTestingFrequencyStats, getOverallAdherence (exist)
- No new repos; aggregate from existing.

## Status
NOT BUILT. Plan only. Phase 1 is the starting point.

## Customizable charts detail
User can build their own: pick a metric (e.g., "loads"), a dimension (e.g., "by partner"), a date range, and a chart type. This is a "stats builder" — like a mini BI tool. Start with 3 pre-built charts, then add the builder in Phase 4.
