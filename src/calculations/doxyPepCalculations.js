// doxyPepCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: passively track whether a DoxyPEP dose is due
// based on real Activity (Encounter) history, and flag it — not a
// diagnosis, not a decision made on the user's behalf, an informational
// countdown exactly like exposureWindows.js already does for testing
// windows. Same "Out of Scope: diagnosis engine / automated risk
// scoring" boundary from Architecture Lock v1.0 applies here — this
// only ever flags a window, the decision to actually take a dose
// stays entirely manual (consistent with the earlier explicit
// decision, logged 4 Aug 2026, that DoxyPEP dosing must stay manual
// so a missed dose is caught, not auto-logged).
//
// SOURCING — verified via web search 26 Aug 2026, not assumed from
// memory, matching this project's own sourcing standard:
// BASHH's 2025 UK national guideline and CDC's 2024 clinical guidance
// both specify a single 200mg dose taken as soon as possible within
// 24 hours (ideal) and no later than 72 hours after condomless oral,
// vaginal, or anal sex. BASHH explicitly supports the
// "cover a period of activity with one dose at the end" pattern this
// file implements: "Anyone having potential risks over several days
// can take the 200mg dose at the end of a 72 hour period" (HIV i-Base
// summary of the 9 June 2025 BASHH guideline). Sources:
// bashh.org/_userfiles/pages/files/guideline_doxypep_final_9thjune2025_v11.pdf,
// cdc.gov/mmwr/volumes/73/rr/pdfs/rr7302a1-H.pdf.
//
// WHAT COUNTS AS A "QUALIFYING" ACTIVITY — the user's explicit rule,
// matching BASHH/CDC's own "oral, vaginal, or anal sex" wording:
// mucous-membrane contact only. Fingering (hand-to-mucosa) explicitly
// excluded per the user's own "hand no" — digital contact isn't the
// transmission route these guidelines are targeting. Rimming
// (anooral) and any oral-genital contact (vaginooral) both count as
// oral-contact per the guideline wording. Kissing/Cuddling/Groping/
// Mutual masturbation are not sex acts in the guideline's sense.
// Kink/Toys — CONFIRMED excluded by the user (26 Aug 2026): "could have
// risk missed but better than false positive." A deliberate
// conservative default, not a gap — if a specific Kink/Toys entry
// genuinely involved qualifying mucosal contact, log it under the
// actual act (Oral/Anal/Vaginal/Rimming) instead, same as any other
// encounter.
export const DOXYPEP_QUALIFYING_POSITIONS = [
  "Oral - giving", "Oral - receiving",
  "Rimming - giving", "Rimming - receiving",
  "Anal - giving", "Anal - receiving",
  "Vaginal - giving", "Vaginal - receiving",
];

export const DOXYPEP_WINDOW_HOURS = 72;

export function isQualifyingEncounter(encounter) {
  return (encounter.myPosition || []).some((p) => DOXYPEP_QUALIFYING_POSITIONS.includes(p));
}

// Identifies the DoxyPEP medication by name rather than a hardcoded
// ID — real device data may not share the same seed IDs as this
// repo's mock data, and matching by name is the same robustness
// principle already used for Testing's exact-string TESTING_FOR
// checks (deliberately fixed, not editable, per
// customOptionListsRepository.js's own documented reasoning).
export function findDoxyPepMedication(medications) {
  return (medications || []).find((m) => !m.isArchived && m.name.toLowerCase().includes("doxy")) || null;
}

// Core calculation. Pure function — no repository reads, no side
// effects, testable in isolation. Callers pass in already-loaded data.
//
// Returns one of:
//   { active: false }
//     — no qualifying activity since the last dose (or ever). Nothing
//       to flag.
//   { active: true, overdue: false, windowStart, deadline, msRemaining }
//     — countdown running, dose not yet due.
//   { active: true, overdue: true, windowStart, deadline, msOverdue }
//     — 72h passed with no dose logged.
//
// windowStart is the EARLIEST qualifying encounter since the last
// dose — per the user's explicit rule (matching BASHH's own "several days
// of activity, one dose at the end" allowance above): sequential
// qualifying activities do NOT restart the countdown, only the first
// one in a new streak starts it. Logging a dose clears everything
// that came before it, and the next qualifying encounter after that
// starts a fresh window.
export function getDoxyPepStatus(encounters, doxyDoseLogs, now = new Date()) {
  const lastDose = [...(doxyDoseLogs || [])]
    .filter((l) => l.type === "dose" && !l.voided)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const lastDoseTime = lastDose ? new Date(lastDose.date).getTime() : null;

  const qualifyingSinceLastDose = (encounters || [])
    .filter((e) => !e.isArchived && e.date && isQualifyingEncounter(e))
    .filter((e) => lastDoseTime === null || new Date(e.date).getTime() > lastDoseTime)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (qualifyingSinceLastDose.length === 0) return { active: false };

  const windowStart = new Date(qualifyingSinceLastDose[0].date).getTime();
  const deadline = windowStart + DOXYPEP_WINDOW_HOURS * 3600000;
  const nowMs = now.getTime();

  if (nowMs < deadline) {
    return { active: true, overdue: false, windowStart, deadline, msRemaining: deadline - nowMs };
  }
  return { active: true, overdue: true, windowStart, deadline, msOverdue: nowMs - deadline };
}

// Formatting helper matching the app's existing hours/minutes
// convention (see Medication's Days Remaining formatting, added 4 Aug
// 2026 — drops to hours/minutes rather than flooring to "0d" and going
// silent right when it matters most).
export function formatDoxyPepCountdown(ms) {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
