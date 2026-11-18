// healthcareSummaryByTab.js
//
// M4.1 (18 Nov) — genuine per-tab summary sets, not the same three global
// counts relabelled. Each tab shows the facts relevant to that tab; tabs with
// no relevant fact show no row at all. All values come from repositories the
// Healthcare screen already loads. Reuses the shared SummaryStat component.
const stat = (key, label, value, alert = false) => ({ key, label, value: value ?? 0, alert });

export function summaryStatsForTab(subTab, summary = {}) {
  switch (subTab) {
    case "symptomLog":
      return [
        stat("activeSymptoms", "Active symptoms", summary.activeSymptoms, true),
        stat("openEpisodes", "Open episodes", summary.openEpisodes),
      ];
    case "testing":
      return [stat("testsThisYear", "Tests this year", summary.testsThisYear)];
    case "clinicVisits":
      return [
        stat("upcomingVisits", "Upcoming visits", summary.upcomingVisits),
        stat("openEpisodes", "Open episodes", summary.openEpisodes),
      ];
    case "vaccinations":
      return [stat("overdueVaccinations", "Vaccines due", summary.overdueVaccinations, true)];
    case "measurements":
      return [stat("measurementsCount", "Measurements logged", summary.measurementsCount)];
    case "menstrualHealth":
      return [
        stat("cycleLength", "Average cycle", summary.cycleLength ? `${summary.cycleLength} days` : "—"),
        stat("daysSincePeriod", "Since last period", summary.daysSincePeriod != null ? `${summary.daysSincePeriod} days` : "—"),
      ];
    default:
      return [];
  }
}
