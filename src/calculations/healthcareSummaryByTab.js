// healthcareSummaryByTab.js
//
// R4 (18 Nov) — the same three summary cards (Active symptoms / Overdue
// vaccinations / Tests this year) used to sit identically above EVERY
// Healthcare sub-tab. Make them context-aware: the stat relevant to the open
// tab comes first, with one supporting stat. No new data — these are the
// same three already-computed global counts — and SummaryStat stays shared.
const LABELS = {
  activeSymptoms: "Active symptoms",
  overdueVaccinations: "Overdue vaccinations",
  testsThisYear: "Tests this year",
};
const LABEL_KEYS = {
  activeSymptoms: "healthcare.activeSymptoms",
  overdueVaccinations: "healthcare.overdueVaccinations",
  testsThisYear: "healthcare.testsThisYear",
};
const ALERT = { activeSymptoms: true, overdueVaccinations: true, testsThisYear: false };

// Relevant stat first; one supporting stat so the row is never a lone card.
const BY_TAB = {
  testing: ["testsThisYear", "activeSymptoms"],
  symptomLog: ["activeSymptoms", "testsThisYear"],
  clinicVisits: ["testsThisYear", "activeSymptoms"],
  vaccinations: ["overdueVaccinations", "testsThisYear"],
  measurements: ["testsThisYear", "activeSymptoms"],
  menstrualHealth: ["activeSymptoms", "testsThisYear"],
};

export function summaryStatsForTab(subTab, summary = {}) {
  const keys = BY_TAB[subTab] || ["activeSymptoms", "overdueVaccinations", "testsThisYear"];
  return keys.map((key) => ({ key, labelKey: LABEL_KEYS[key], label: LABELS[key], value: summary[key] ?? 0, alert: ALERT[key] }));
}
