// R4 (18 Nov) — context-aware summary cards on Healthcare and Medication.
import { describe, it, expect } from "vitest";
import { summaryStatsForTab } from "./healthcareSummaryByTab.js";
import { medicationStatsForTab } from "./medicationSummaryByTab.js";

describe("Healthcare summary cards per sub-tab", () => {
  const summary = { activeSymptoms: 2, overdueVaccinations: 1, testsThisYear: 7 };

  it("puts the relevant stat first for each tab", () => {
    expect(summaryStatsForTab("testing", summary)[0].key).toBe("testsThisYear");
    expect(summaryStatsForTab("symptomLog", summary)[0].key).toBe("activeSymptoms");
    expect(summaryStatsForTab("vaccinations", summary)[0].key).toBe("overdueVaccinations");
  });

  it("keeps one supporting stat and the real value", () => {
    const stats = summaryStatsForTab("testing", summary);
    expect(stats).toHaveLength(2);
    expect(stats[0].value).toBe(7);
    expect(stats[0].labelKey).toBe("healthcare.testsThisYear");
  });

  it("falls back to the original three for an unknown tab", () => {
    expect(summaryStatsForTab("unknown", summary).map((s) => s.key)).toEqual(["activeSymptoms", "overdueVaccinations", "testsThisYear"]);
  });
});

describe("Medication summary cards per sub-tab", () => {
  it("re orders and relabels rather than repeating the identical pair", () => {
    expect(medicationStatsForTab("Registry")[0].label).toBe("Active medications");
    expect(medicationStatsForTab("Log")[0].label).toBe("Medications to log");
    expect(medicationStatsForTab("Inventory")[0].label).toBe("Refill / low stock");
  });

  it("still shows both real counts on every tab", () => {
    for (const tab of ["Registry", "Log", "Inventory"]) {
      const stats = medicationStatsForTab(tab);
      expect(stats.map((s) => s.key).sort()).toEqual(["action", "active"]);
    }
  });
});
