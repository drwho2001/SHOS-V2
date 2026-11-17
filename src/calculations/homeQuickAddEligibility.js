// homeQuickAddEligibility.js — pure rule for Home's medication quick actions.
//
// 17 Nov 2026: Home used two DIFFERENT rules for the same question. "Log all
// due routine meds" asked `isDoseLockedOut`, but "Take PrEP/DoxyPEP now" wrote
// a dose unconditionally — a real double-dose path from a button sitting
// right next to the one that refused it. Both now call the SAME calculation
// the Medication Dashboard uses, via this seam, so they cannot drift again.
// The feedback text is here too: touchscreen users never see a title tooltip.
import { isDoseLockedOut, latestLogOfType, lockoutEndsEstimate } from "./medicationCalculations";

export function isQuickActionLocked(med, logs) {
  if (!med) return false;
  const last = latestLogOfType({ logs: logs || [] }, "dose");
  return isDoseLockedOut(med, last?.date);
}

export function quickActionLockoutMessage(med, logs) {
  if (!isQuickActionLocked(med, logs)) return "";
  if (!med) return "This medication is no longer available — nothing was logged.";
  const last = latestLogOfType({ logs: logs || [] }, "dose");
  const estimate = lockoutEndsEstimate(med, last?.date);
  return `${med.name} is locked out${estimate && estimate !== "now" ? ` for another ${estimate}` : ""}. Tap again if you still want to log it.`;
}

// `logsByMed` is a plain { [medicationId]: log[] } map. The caller keeps it
// fresh after a write so the ghosted/non-ghosted state reflects reality.
export function dueRoutineMedications(allMeds, logsByMed) {
  return (allMeds || []).filter((med) => {
    if (!med || med.isArchived || med.usagePattern !== "daily") return false;
    return !isQuickActionLocked(med, logsByMed?.[med.id]);
  });
}
