// exposureWindows.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Reference data for "how many days after exposure does a test for X
// reliably detect it" — commonly called a window period. Used by
// Timeline/Episode (see SHOS_Timeline_Prototype.jsx) to flag when a
// linked Test was taken too soon after a specific at-risk Encounter to
// confidently say that Encounter is covered/cleared by that result.
//
// SOURCING, stated plainly rather than presented as more precise than
// it is: gathered from current UK sexual-health guidance (BASHH/BHIVA
// position statements and NHS-affiliated sexual health services,
// checked via web search rather than relied on from memory, since
// getting this wrong in either direction — too short OR too long —
// has real consequences). These are ROUNDED, COMMONLY-CITED figures
// for the standard modern test type used in UK sexual health clinics
// (e.g. HIV = 4th-generation antigen/antibody combination test), not
// a verbatim reproduction of any single document, and not a substitute
// for actual clinical guidance — a real clinician's advice about a
// specific test/situation always takes precedence over this table.
//
// THIS IS INFORMATIONAL FLAGGING ONLY, deliberately not a hard
// block or an automated clinical determination — Architecture Lock
// v1.0's own "Out of Scope" section explicitly excludes "Diagnosis
// engine / clinical decision support" and "Automated risk scoring"
// from this app. Nothing here decides whether someone is infected;
// it only flags "this specific test result can't yet confidently
// speak to this specific encounter" — the same kind of caution a
// patient leaflet gives, not a clinical judgment this app is making
// on the user's behalf. Resolution of an episode always stays a manual
// tap regardless of what this table says (see EpisodeDetail's
// "Resolve" section) — this only ever adds a visible caveat, never
// blocks or auto-decides anything.
//
// Deliberately NOT included, and why:
// - Mpox: not tested via an antibody/NAAT "window" the same way —
//   diagnosis is from a lesion swab when symptomatic, not blood
//   screening on a timer. A window-period framing doesn't apply.
// - "C&S (treatment)" / "Other": not screening-test categories in
//   this sense (C&S here means a post-treatment test-of-cure culture,
//   which is exactly what this table would otherwise be warning
//   about needing to wait for — already handled by the episode's own
//   TOC step, not double-counted here).
//
// Lower-confidence entries, flagged explicitly rather than presented
// with false precision: Hepatitis A (no dedicated STI-context BASHH
// window period found; using average incubation as a rough proxy) and
// MGen (Mycoplasma genitalium — inferred from its NAAT test type being
// the same class as chlamydia/gonorrhoea, not from a dedicated source).
export const EXPOSURE_WINDOWS_DAYS = {
  "Chlamydia": { days: 14, confidence: "high" },
  "Gonorrhoea": { days: 14, confidence: "high" },
  "MGen": { days: 14, confidence: "low" },
  "HIV": { days: 45, confidence: "high" },
  "Syphilis": { days: 84, confidence: "high" },
  "Hepatitis B": { days: 84, confidence: "high" },
  "Hepatitis C": { days: 84, confidence: "medium" }, // some sources note it can occasionally take longer
  "Hepatitis A": { days: 28, confidence: "low" },
};

// Given a linked Test and the date of a specific Encounter it's being
// checked against, returns the list of testingFor entries whose
// window period hasn't elapsed yet — i.e. the infections this test's
// negative result CAN'T confidently speak to for that encounter.
// Anything not in EXPOSURE_WINDOWS_DAYS (Mpox, Other, C&S, and — per
// The user's own explicit call — HPV/Herpes/Trichomoniasis/Bacterial
// vaginosis, added for broader LGBTQ+-inclusive coverage without
// requiring the same BASHH-sourced precision research as the core
// list) is silently skipped — no window concept applies, so nothing
// to flag.
export function unclearedInfectionsForTest(test, encounterDate) {
  if (!encounterDate || !test?.date) return [];
  const daysBetween = (new Date(test.date) - new Date(encounterDate)) / 86400000;
  return (test.testingFor || []).filter((infection) => {
    const entry = EXPOSURE_WINDOWS_DAYS[infection];
    return entry != null && daysBetween < entry.days;
  });
}

// Given an Encounter's date and every Test linked to an episode,
// returns the best available coverage status — picks whichever linked
// test (taken on/after the encounter) leaves the FEWEST infections
// unconfirmed, since that's the most informative one available.
//   status: "covered"   — at least one linked test fully clears the window for everything it tested
//           "uncovered" — every linked test still has at least one infection inside its window
//           "no_test"   — nothing has been logged since this encounter yet
export function getEncounterCoverage(encounterDate, tests) {
  if (!encounterDate) return { status: "no_test", uncoveredInfections: [], test: null };
  const relevantTests = (tests || []).filter((t) => t.date && t.date >= encounterDate);
  if (relevantTests.length === 0) return { status: "no_test", uncoveredInfections: [], test: null };

  let best = null;
  relevantTests.forEach((t) => {
    const uncovered = unclearedInfectionsForTest(t, encounterDate);
    if (!best || uncovered.length < best.uncoveredInfections.length) {
      best = { status: uncovered.length === 0 ? "covered" : "uncovered", uncoveredInfections: uncovered, test: t };
    }
  });
  return best;
}

// The Home ring's own question, which is narrower than "every infection
// this test screened for": which exposures is the last negative result
// still NOT able to clear, counting only the infections that actually
// drive decisions here - HIV, gonorrhoea and chlamydia. Syphilis (and the
// hepatitis entries) are deliberately left out: their 84-day windows are
// far longer than the rest and would swamp the count, and they are not the
// infections this ring is asking about.
//
// The encounter's own prevention is applied, because a window that has not
// elapsed only matters if that infection was a live concern in the first
// place:
//   - HIV is not counted when PrEP coverage is adequate (daily or 2-1-1).
//   - Chlamydia is not counted when DoxyPEP was actually taken.
//   - Gonorrhoea is always counted: DoxyPEP does not reliably prevent it.
//
// `unclearedInfectionsForTest` above is unchanged and still used by
// Timeline/Episode, which asks the wider "anything this test screened for"
// question.
export const RING_PRIORITY_INFECTIONS = ["HIV", "Gonorrhoea", "Chlamydia"];

export function unclearedPriorityInfectionsForEncounter(test, encounter) {
  if (!test?.date || !encounter?.date) return [];
  // Compare CALENDAR DAYS, not elapsed milliseconds. A Test is stored with a
  // date and no time of day, so an encounter logged minutes after midnight on
  // the test day would otherwise read as "after the test" purely because of
  // its timestamp. A same-day encounter therefore counts as still uncleared:
  // the safe reading is that a test that day cannot confidently clear it.
  const testDay = String(test.date).slice(0, 10);
  const encounterDay = String(encounter.date).slice(0, 10);
  const daysBetween = Math.round(
    (Date.parse(`${testDay}T00:00:00Z`) - Date.parse(`${encounterDay}T00:00:00Z`)) / 86400000
  );
  if (!Number.isFinite(daysBetween) || daysBetween < 0) return []; // after the test day: not the pre-test window's question
  const prepAdequate = /^adequate/i.test(encounter.myPrepCoverage || "");
  const doxyTaken = /taken/i.test(encounter.myDoxyPepStatus || "")
    && !/not yet|missed/i.test(encounter.myDoxyPepStatus || "");
  return (test.testingFor || []).filter((infection) => {
    if (!RING_PRIORITY_INFECTIONS.includes(infection)) return false;
    const entry = EXPOSURE_WINDOWS_DAYS[infection];
    if (entry == null || daysBetween >= entry.days) return false;
    if (infection === "HIV" && prepAdequate) return false;
    if (infection === "Chlamydia" && doxyTaken) return false;
    return true;
  });
}
