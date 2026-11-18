// M4.1 (18 Nov) — genuine per-tab stats, not the same three counts relabelled.
import { describe, it, expect } from "vitest";
import { summaryStatsForTab } from "./healthcareSummaryByTab.js";

const summary = {
  activeSymptoms: 2, overdueVaccinations: 1, testsThisYear: 8,
  upcomingVisits: 3, measurementsCount: 12, cycleLength: 29, daysSincePeriod: 14, openEpisodes: 1,
};

describe("Healthcare summary cards per sub-tab", () => {
  it("gives each tab its own relevant facts", () => {
    expect(summaryStatsForTab("symptomLog", summary).map((s) => s.key)).toEqual(["activeSymptoms", "openEpisodes"]);
    expect(summaryStatsForTab("testing", summary).map((s) => s.key)).toEqual(["testsThisYear"]);
    expect(summaryStatsForTab("clinicVisits", summary).map((s) => s.key)).toEqual(["upcomingVisits", "openEpisodes"]);
    expect(summaryStatsForTab("vaccinations", summary).map((s) => s.key)).toEqual(["overdueVaccinations"]);
    expect(summaryStatsForTab("measurements", summary).map((s) => s.key)).toEqual(["measurementsCount"]);
    expect(summaryStatsForTab("menstrualHealth", summary).map((s) => s.key)).toEqual(["cycleLength", "daysSincePeriod"]);
  });

  it("uses real values, with a dash when there is no cycle data", () => {
    expect(summaryStatsForTab("testing", summary)[0].value).toBe(8);
    expect(summaryStatsForTab("menstrualHealth", summary)[0].value).toBe("29 days");
    expect(summaryStatsForTab("menstrualHealth", { cycleLength: null, daysSincePeriod: null })[0].value).toBe("—");
  });

  it("returns no row for tabs with no relevant stat", () => {
    expect(summaryStatsForTab("unknown", summary)).toEqual([]);
  });
});
