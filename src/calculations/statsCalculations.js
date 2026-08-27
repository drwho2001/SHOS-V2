// statsCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: a Stats page in Settings, grouped by context
// (Activity/Healthcare/Medication/Contacts), with clickable info
// explaining the calculation and citing real guidance (BASHH/CDC)
// where a stat references a clinical benchmark. Pure functions only —
// callers pass in already-loaded repository data, same separation as
// doxyPepCalculations.js.

// ── Activity ──

export function getActivitiesPerMonth(encounters, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  encounters.filter((e) => !e.isArchived && e.date).forEach((e) => {
    const d = new Date(e.date);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.count++;
  });
  return buckets;
}

// Real kink names, resolved via the registry — caller passes a
// getName(kinkId) resolver so this stays repository-agnostic.
export function getTopKinks(encounters, contacts, resolveKinkName, topN = 5) {
  const counts = {};
  encounters.filter((e) => !e.isArchived).forEach((e) => {
    (e.kinksInvolved || []).forEach((k) => {
      const name = resolveKinkName(k.kinkId);
      if (name) counts[name] = (counts[name] || 0) + 1;
    });
  });
  contacts.filter((c) => !c.isArchived).forEach((c) => {
    (c.statedKinks || []).forEach((k) => {
      const name = resolveKinkName(k.kinkId);
      if (name) counts[name] = (counts[name] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({ name, count }));
}

// ── Healthcare ──
//
// SOURCING — verified via web search 26 Aug 2026, not assumed:
// BASHH's 2023 "Summary Guidance on Testing for STIs" recommends
// 3-monthly asymptomatic screening for higher-risk groups (matches
// CDC's own 3–6 month PrEP-user guidance). 90 days is used here as
// the higher-risk/PrEP reference point, since this app already tracks
// PrEP/DoxyPEP usage — not a claim that every user needs exactly this
// frequency, just the cited benchmark being compared against.
// Source: bashh.org/_userfiles/pages/files/resources/bashh_summary_guidance_on_stis_testing_2023.pdf
export const BASHH_TESTING_INTERVAL_DAYS = 90;
export const BASHH_TESTING_SOURCE_URL = "https://www.bashh.org/_userfiles/pages/files/resources/bashh_summary_guidance_on_stis_testing_2023.pdf";

export function getTestingFrequencyStats(tests) {
  const real = tests.filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (real.length < 2) {
    const lastDate = real[0]?.date || null;
    const daysSinceLast = lastDate ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000) : null;
    return { averageIntervalDays: null, daysSinceLast, testCount: real.length, withinBashhInterval: daysSinceLast !== null ? daysSinceLast <= BASHH_TESTING_INTERVAL_DAYS : null };
  }
  const gaps = [];
  for (let i = 1; i < real.length; i++) {
    gaps.push((new Date(real[i].date) - new Date(real[i - 1].date)) / 86400000);
  }
  const averageIntervalDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const lastDate = real[real.length - 1].date;
  const daysSinceLast = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  return { averageIntervalDays, daysSinceLast, testCount: real.length, withinBashhInterval: daysSinceLast <= BASHH_TESTING_INTERVAL_DAYS };
}

// ── Medication ──

export function getOverallAdherence(medications, computeAdherenceFn) {
  const rates = medications
    .filter((m) => !m.isArchived && m.usagePattern !== "prn")
    .map((m) => computeAdherenceFn(m))
    // CHANGED 26 Aug 2026 — real shape check before using this: this
    // returns {streak, sevenDay, sinceRefill}, not a flat percent —
    // sevenDay.pct is the actual field (confirmed by reading
    // windowStats() directly, not guessed).
    .filter((a) => a?.sevenDay && typeof a.sevenDay.pct === "number");
  if (rates.length === 0) return null;
  return Math.round(rates.reduce((sum, a) => sum + a.sevenDay.pct, 0) / rates.length);
}

// DoxyPEP compliance: of qualifying encounters that started a real
// countdown, what fraction had a dose logged before the 72h window
// closed. Reuses the same qualifying-activity definition as
// doxyPepCalculations.js (passed in, not re-implemented here, so the
// two stay in sync automatically rather than needing separately
// maintained copies of the same rule).
export function getDoxyPepComplianceRate(encounters, doxyDoseLogs, isQualifyingEncounterFn, windowHours) {
  const qualifying = encounters.filter((e) => !e.isArchived && e.date && isQualifyingEncounterFn(e)).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (qualifying.length === 0) return null;
  const doses = doxyDoseLogs.filter((l) => l.type === "dose" && !l.voided).map((l) => new Date(l.date).getTime()).sort((a, b) => a - b);

  // Group qualifying encounters into streaks (same anchoring rule as
  // the real countdown: consecutive qualifying activity with no dose
  // in between shares one window), then check whether a dose landed
  // within 72h of each streak's first encounter.
  let compliant = 0, totalStreaks = 0;
  let streakStart = null;
  for (let i = 0; i < qualifying.length; i++) {
    const t = new Date(qualifying[i].date).getTime();
    if (streakStart === null) streakStart = t;
    const nextIsNewStreak = i === qualifying.length - 1 || doses.some((d) => d > t && d < new Date(qualifying[i + 1].date).getTime());
    if (nextIsNewStreak) {
      totalStreaks++;
      const deadline = streakStart + windowHours * 3600000;
      if (doses.some((d) => d >= streakStart && d <= deadline)) compliant++;
      streakStart = null;
    }
  }
  if (totalStreaks === 0) return null;
  return Math.round((compliant / totalStreaks) * 100);
}

// ── Contacts ──

export function getContactsAddedPerMonth(contacts, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  contacts.filter((c) => c.createdAt).forEach((c) => {
    const d = new Date(c.createdAt);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.count++;
  });
  return buckets;
}
