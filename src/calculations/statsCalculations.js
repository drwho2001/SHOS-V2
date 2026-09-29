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
    // FIXED 29 Sep 2026 (t020) — e.date is a STORED fake-UTC value, so its
    // calendar month is the UTC one. Read through the local getters it was
    // filed under the PREVIOUS month west of UTC: a stored "2026-09-01" is UTC
    // midnight, which is 20:00 on 31 Aug in New York, so every first-of-the-month
    // encounter silently landed in the wrong bar with nothing visibly wrong.
    //
    // The BUCKETS deliberately stay on the local calendar. They are the user's
    // own "this month", and the stored values are wall-clock, so a user in
    // Sydney logging 1 Sep means 1 Sep - reading the buckets in UTC would
    // instead make a 1 Sep record fall outside the window and vanish, which is
    // the over-correction this test file guards against explicitly.
    const d = new Date(e.date);
    const bucket = buckets.find((b) => b.year === d.getUTCFullYear() && b.month === d.getUTCMonth());
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

// ADDED — real ask: "Stats is descriptive, not predictive... no 'your
// average time between tests is drifting up' or 'this is 40% longer
// since your last test than your own average' type nudge." Two
// genuinely different comparisons, both against the user's OWN past
// pattern rather than a fixed external benchmark (BASHH's 90 days
// above already covers that comparison):
//
// 1. "Current gap vs. your own average" — needs only 2 real tests
//    (reuses averageIntervalDays/daysSinceLast above), so it's useful
//    almost immediately. Flags once the gap since the last test has
//    already run meaningfully longer than the person's own typical
//    interval — a real "you're overdue relative to YOUR pattern" nudge,
//    distinct from the fixed BASHH comparison.
// 2. "Recent trend vs. historical" — compares the average of the most
//    recent gaps against the average of the earlier ones, so it can
//    say the interval is genuinely lengthening or shortening over time,
//    not just "currently a bit longer than usual". Needs at least 4
//    real tests (3 gaps) to split into a meaningful recent/earlier
//    comparison — returns null below that, same "not enough data"
//    honesty as averageIntervalDays itself.
//
// Threshold is 20% either direction — small enough to catch a real
// drift, large enough that ordinary test-to-test variance (scheduling
// around a clinic's availability, a missed month) doesn't fire a nudge
// on noise alone.
const TREND_THRESHOLD = 0.2;
const RECENT_GAP_COUNT = 2;

export function getTestingIntervalTrend(tests) {
  const real = tests.filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (real.length < 2) return { currentGapVsAverage: null, recentTrend: null };

  const gaps = [];
  for (let i = 1; i < real.length; i++) gaps.push((new Date(real[i].date) - new Date(real[i - 1].date)) / 86400000);
  const averageIntervalDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const daysSinceLast = Math.floor((Date.now() - new Date(real[real.length - 1].date).getTime()) / 86400000);

  // 1. Current gap vs. own average — a real ratio, not just a boolean,
  // so the UI can say by how much rather than just "yes/no".
  const gapRatio = averageIntervalDays > 0 ? daysSinceLast / averageIntervalDays : 1;
  const currentGapVsAverage = Math.abs(gapRatio - 1) >= TREND_THRESHOLD
    ? { direction: gapRatio > 1 ? "longer" : "shorter", percent: Math.round(Math.abs(gapRatio - 1) * 100), averageIntervalDays: Math.round(averageIntervalDays), daysSinceLast }
    : null;

  // 2. Recent vs. historical trend — only computed with enough real
  // gaps to split meaningfully; a 2-gap history split into "1 recent,
  // 1 earlier" would just be comparing two arbitrary numbers, not a
  // real trend.
  let recentTrend = null;
  if (gaps.length >= RECENT_GAP_COUNT * 2) {
    const recentGaps = gaps.slice(-RECENT_GAP_COUNT);
    const earlierGaps = gaps.slice(0, gaps.length - RECENT_GAP_COUNT);
    const recentAvg = recentGaps.reduce((a, b) => a + b, 0) / recentGaps.length;
    const earlierAvg = earlierGaps.reduce((a, b) => a + b, 0) / earlierGaps.length;
    const trendRatio = earlierAvg > 0 ? recentAvg / earlierAvg : 1;
    if (Math.abs(trendRatio - 1) >= TREND_THRESHOLD) {
      recentTrend = { direction: trendRatio > 1 ? "up" : "down", percent: Math.round(Math.abs(trendRatio - 1) * 100), recentAvgDays: Math.round(recentAvg), earlierAvgDays: Math.round(earlierAvg) };
    }
  }

  return { currentGapVsAverage, recentTrend };
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

/**
 * The same average, but over the "this container" window instead of 7 days.
 *
 * Deliberately a sibling of getOverallAdherence rather than a parameter on it:
 * the two windows answer different questions - "am I on top of it this week"
 * and "am I keeping up across a whole supply" - and a blended single number
 * would be the kind of "one wellness score" this file's own header refuses to
 * invent.
 *
 * The `sinceRefillAnchored` filter is the important part, and it mirrors the
 * medication card's own gate. computeAdherence() falls back to the 7-day
 * figures when a medication has no logged refill, so WITHOUT this filter a
 * medication nobody has ever refilled would contribute its 7-day rate to a
 * figure labelled "this container" - which is the same class of bug as
 * labelling those numbers "this refill" on the card. Nothing to measure a
 * container from means nothing to show, so it is excluded rather than
 * substituted.
 *
 * @param {Array} medications with their `logs` already attached
 * @param {Function} computeAdherenceFn passed in, not imported, matching
 *   getOverallAdherence and keeping the two provably in step
 * @returns {number|null} null when no medication is anchored
 */
export function getOverallContainerAdherence(medications, computeAdherenceFn) {
  const rates = (medications || [])
    .filter((m) => m && !m.isArchived && m.usagePattern !== "prn")
    .map((m) => computeAdherenceFn(m))
    .filter((a) => a?.sinceRefillAnchored && typeof a.sinceRefill?.pct === "number");
  if (rates.length === 0) return null;
  return Math.round(rates.reduce((sum, a) => sum + a.sinceRefill.pct, 0) / rates.length);
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

// ADDED — real ask: "expand stats". computeAdherence() in
// medicationCalculations.js is hardcoded to "today" as its reference
// point (used live by Medication Dashboard/Home) — not safely
// reusable here for a PAST month without risking that shared,
// already-depended-on function. Deliberately a simpler, self-contained
// measure instead: per medication per month, the plain fraction of
// days with at least one real dose logged (from whichever is later,
// the month's start or the medication's own startDate, through the
// month's end or today, whichever is earlier) — then averaged across
// all non-PRN medications that existed at all that month. This is
// intentionally NOT the same precise calculation as the "Overall
// adherence (7-day)" figure above it (which correctly accounts for
// custom every-N-days scheduling) — labelled honestly as such in the
// UI, not presented as a like-for-like number.
export function getAdherenceTrend(medications, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  // FIXED 29 Sep 2026 (t020) — the entire day-walk below was local arithmetic
  // over values that are STORED fake-UTC strings, and the result was a fully
  // dosed August reading 97% in New York: the app telling someone their perfect
  // month was not perfect. Silent, because a number that looks like a real
  // adherence change is exactly what a user cannot second-guess.
  //
  // The two failures compounded. `setHours(0,0,0,0)` floored each stored dose
  // to midnight in the DEVICE's zone, so a stored "2026-08-31" (UTC midnight =
  // 20:00 on 30 Aug local) was filed under 30 August; and `totalDays` was an
  // elapsed-milliseconds divide, the exact shape of the DST adherence bug this
  // project already fixed once in medicationCalculations.js, reintroduced
  // through a different door.
  //
  // So the whole chain now works in the STORED frame: month boundaries, the day
  // walk, and the dose-day set are all UTC, and days are compared as
  // YYYY-MM-DD keys rather than as local-midnight epochs. "Today" is still the
  // real now — a real instant is genuinely the user's local day, and the
  // current month is truncated at it either way.
  const dayKey = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const monthStartKey = dayKey(monthStart);
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 0));
    const lastDayKey = dayKey(lastDay);
    // The window ends at the earlier of "the end of this month" and "today",
    // compared as calendar days so the truncation cannot slip a day.
    const rangeEndKey = lastDayKey < todayKey ? lastDayKey : todayKey;
    let sumPct = 0, countMeds = 0;

    medications.filter((m) => !m.isArchived && m.usagePattern !== "prn").forEach((m) => {
      const startKey = typeof m.startDate === "string" ? m.startDate.slice(0, 10) : "";
      const effectiveStartKey = startKey > monthStartKey ? startKey : monthStartKey;
      if (effectiveStartKey > rangeEndKey) return; // medication didn't exist yet this month
      const totalDays =
        Math.round(Date.parse(`${rangeEndKey}T00:00:00Z`) / 86400000) -
        Math.round(Date.parse(`${effectiveStartKey}T00:00:00Z`) / 86400000) + 1;
      if (totalDays <= 0) return;
      const doseDays = new Set(
        (m.logs || [])
          .filter((l) => l.type === "dose" && !l.voided)
          .map((l) => (typeof l.date === "string" ? l.date.slice(0, 10) : ""))
          .filter(Boolean),
      );
      let hit = 0;
      for (let d = 0; d < totalDays; d++) {
        const key = dayKey(new Date(Date.parse(`${effectiveStartKey}T00:00:00Z`) + d * 86400000));
        if (doseDays.has(key)) hit++;
      }
      sumPct += (hit / totalDays) * 100;
      countMeds++;
    });
    buckets.push({ label: monthStart.toLocaleDateString(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }), pct: countMeds > 0 ? Math.round(sumPct / countMeds) : null });
  }
  return buckets;
}

// ── Symptoms ──

// Same shape/reasoning as getTopKinks above — real symptom names via a
// registry resolver, kept repository-agnostic.
export function getTopSymptoms(symptomEntries, resolveSymptomName, topN = 5) {
  const counts = {};
  symptomEntries.filter((e) => !e.isArchived).forEach((e) => {
    (e.symptomIds || []).forEach((id) => {
      const name = resolveSymptomName(id);
      if (name) counts[name] = (counts[name] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({ name, count }));
}

// ADDED 16 Sep 2026 — real ask (#78): "positive-test counts by
// organism/site." Real double-counting risk found while scoping this:
// testingRepository.js's own `_supersedeOlderMostRecent()` comment
// documents that two tests on the SAME DAY, for different sample
// sites, are stored as separate records ("same-day tests can coexist
// as most recent... different sample sites, same visit") — a naive
// per-record tally of positive results would count one real clinical
// event as 2+ positives if it happened to be logged as 2 site-specific
// records. Deduped below by grouping on (date, organismId), so a
// same-day multi-site positive for one organism counts once — matching
// what "how many times have I tested positive for X" actually means.
// `resolveOrganismName` mirrors getTopKinks()/getTopSymptoms()'s own
// resolver-callback pattern — this file stays I/O-free, the caller
// resolves ids via whichever registry it already has loaded.
export function getPositiveTestsByOrganism(tests, resolveOrganismName, resolveResultName, topN = 8) {
  const real = tests.filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date());
  const seenEvents = new Set(); // `${date}|${bucketKey}`
  const counts = {};
  for (const t of real) {
    const isPositive = (t.resultIds || []).some((id) => resolveResultName(id)?.toLowerCase() === "positive");
    if (!isPositive) continue;
    const day = t.date.slice(0, 10);
    // FIXED — real report: "counting positive results by organism
    // doesn't actually work." Root cause: Testing's own "Organism (if
    // positive)" field is genuinely optional (its own label says so),
    // so a real positive result logged without ever filling it in used
    // to vanish from this breakdown entirely, even though a real
    // positive exists. Falls back to the test's own `testingFor`
    // selections (what was actually being screened for) so a positive
    // result is never silently invisible here just because the more
    // specific, optional organism field was left blank.
    const buckets = (t.organismIds && t.organismIds.length)
      ? t.organismIds.map((id) => ({ key: id, name: resolveOrganismName(id) }))
      : (t.testingFor || []).filter((name) => name && name !== "Other").map((name) => ({ key: name, name }));
    for (const { key, name } of buckets) {
      const eventKey = `${day}|${key}`;
      if (seenEvents.has(eventKey)) continue;
      seenEvents.add(eventKey);
      if (name) counts[name] = (counts[name] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({ name, count }));
}

// ADDED 16 Sep 2026 — real ask (#78): "...and site." A tally of how
// many times each sample type has actually been taken — genuinely
// additive (one real swab/draw per array entry per record), so unlike
// the organism breakdown above this needs no event-level dedup: two
// records from the same visit with different sampleType entries really
// are two different physical samples, not a double-count of one fact.
export function getTestsBySite(tests, topN = 8) {
  const real = tests.filter((t) => !t.isArchived && t.date && new Date(t.date) <= new Date());
  const counts = {};
  for (const t of real) {
    for (const site of t.sampleType || []) counts[site] = (counts[site] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, count]) => ({ name, count }));
}

// ── Clinic Visits ──

// Only PAST, real visits — a future booked appointment isn't something
// that's "happened" yet, same real/scheduled distinction every other
// stat in this file already applies (see getTestingFrequencyStats).
export function getClinicVisitStats(visits) {
  const real = visits.filter((v) => !v.isArchived && v.date && !v.isFutureAppointment && new Date(v.date) <= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (real.length === 0) return { visitCount: 0, daysSinceLast: null };
  const lastDate = real[real.length - 1].date;
  const daysSinceLast = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  return { visitCount: real.length, daysSinceLast };
}

export function getClinicVisitsPerMonth(visits, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  visits.filter((v) => !v.isArchived && v.date && !v.isFutureAppointment).forEach((v) => {
    // FIXED 29 Sep 2026 (t020) — same shape as getActivitiesPerMonth above, and
    // the same reason: v.date is a STORED fake-UTC value, read through the local
    // getters it landed in the previous month west of UTC. The buckets stay
    // local, so a stored date is matched by its own stored calendar month.
    const d = new Date(v.date);
    const bucket = buckets.find((b) => b.year === d.getUTCFullYear() && b.month === d.getUTCMonth());
    if (bucket) bucket.count++;
  });
  return buckets;
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
    // DELIBERATELY LEFT ALONE, and this is the point worth recording.
    // createdAt is a GENUINE INSTANT, not a stored wall-clock value, so the
    // device's own month is the correct one and the local getters below are
    // right. The two functions above needed UTC getters; this one must NOT be
    // given them, and a blanket sweep across "all the toLocale/getMonth sites"
    // would have broken it. statsMonthBucketTimezone.test.js has a counter-test
    // for exactly that, because a test that only covered the broken functions
    // would not catch the regression the sweep introduces.
    const d = new Date(c.createdAt);
    const bucket = buckets.find((b) => b.year === d.getFullYear() && b.month === d.getMonth());
    if (bucket) bucket.count++;
  });
  return buckets;
}
