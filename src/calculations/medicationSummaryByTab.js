// medicationSummaryByTab.js — R4 (18 Nov)
// The two Medication stat tiles used to sit identically above Registry/Log/
// Inventory. Put the tab-relevant one first with a tab-appropriate label;
// both values are the same real counts (active meds / needs action), so no
// stat shows data from another tab.
const BY_TAB = {
  Registry: [
    { key: "active", label: "Active medications" },
    { key: "action", label: "Needs action" },
  ],
  Log: [
    { key: "active", label: "Medications to log" },
    { key: "action", label: "Needs action" },
  ],
  Inventory: [
    { key: "action", label: "Refill / low stock" },
    { key: "active", label: "Active medications" },
  ],
};

export function medicationStatsForTab(tab) {
  return BY_TAB[tab] || BY_TAB.Registry;
}
