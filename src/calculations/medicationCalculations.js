// medicationCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file has no memory of its own — it never stores or fetches
// anything. Every function here just takes numbers/data in and returns
// an answer out, the same way a calculator does. That's what makes it
// "pure": call it twice with the same input, get the same answer both
// times, with nothing else in the app affected either way.
//
// This is what Doc 5 means by "store facts, derive state" — Current
// Stock, Adherence, and Next Dose are never saved anywhere. They're
// worked out fresh from the log history every time they're needed.
// That's also why fixing a mis-logged entry (editing or voiding it in
// LogRepository) automatically makes every number here correct again,
// with no special-case "recalculate everything" step required anywhere.
//
// None of the logic below changed during this extraction — it's the
// exact same functions that used to live directly inside the dashboard
// component file, just moved here so they can be reused, tested, or
// reasoned about on their own.
import { realTimestampFromStored } from "./dateInputHelpers";

// ADDED 16 Sep 2026 — real gap: a combination product (PrEP —
// Emtricitabine 200mg/Tenofovir DP 245mg; co-codamol — Paracetamol
// 500mg/Codeine 30mg) has more than one active ingredient at its own
// strength, but the medication record only ever had one dose-strength
// value+unit — real accounts were jamming both numbers into one string
// ("200 , 245"), which isn't a real number, so anywhere that multiplied
// it by unitsPerDose (the Update-dose sheet's own description, dose
// history) silently rendered "NaN". `doseComponents` (an array of
// {label, value, unit}, one entry per active ingredient) is now the
// only source of truth; the old singular fields are deprecated.
export function getDoseComponents(med) {
  return med.doseComponents || [];
}

// Formats a dose-components list for display, one "Label 245mg"-style
// segment per ingredient joined by " / ", each scaled by unitsPerDose
// (taking 2 tablets doubles each ingredient's own dose, same as the
// old single-value multiply this replaces). A non-numeric legacy value
// (the "200 , 245" case above, already saved before this fix existed)
// is shown as-is rather than as "NaN" — an honest display of what was
// actually typed, not a guess at the real number.
export function formatDoseComponents(components, unitsPerDose = 1) {
  if (!components || components.length === 0) return null;
  return components.map((c) => {
    const numeric = Number(c.value);
    const total = Number.isFinite(numeric) && c.value !== "" ? +(numeric * unitsPerDose).toFixed(2) : c.value;
    const amount = `${total}${c.unit || ""}`;
    return c.label ? `${c.label} ${amount}` : amount;
  }).join(" / ");
}

// Days-remaining, dropping to hours/minutes under 1 day — so the display
// keeps counting down meaningfully right as stock actually runs low,
// instead of flooring to "0d remaining" and going silent.
export function formatRemaining(daysExact) {
  if (daysExact >= 1) return `${Math.floor(daysExact)}d remaining`;
  const totalMinutes = Math.max(0, Math.round(daysExact * 24 * 60));
  if (totalMinutes >= 60) return `~${Math.round(totalMinutes / 60)}h remaining`;
  return `~${totalMinutes}m remaining`;
}

// Works out a medication's current stock and whether it needs a refill,
// from its log history alone. `med` here is expected to already have its
// `logs` array attached (see loadMedications() in the dashboard file) —
// this function doesn't know or care where those logs actually came from.
export function computeStock(med) {
  if (!med.inventoryTracked) return { tracked: false };
  const currentStock = med.logs.filter((l) => !l.voided).reduce((sum, l) => sum + l.delta, 0);
  const needsAction = currentStock <= med.refillThreshold;
  let supplementary;
  if (med.usagePattern === "prn") {
    const dosesRemaining = med.unitsPerDose > 0 ? Math.floor(currentStock / med.unitsPerDose) : null;
    // FIXED 27 Sep 2026 — unitsPerContainer had no guard while unitsPerDose on
    // the line above did. The Add/Edit form's NumberField is min={0}, so 0 is
    // reachable, and the card then rendered the literal text
    // "8 doses left · Infinity containers" (or "-Infinity containers" at zero
    // stock). Verified live. A PRN medication legitimately may not track
    // containers at all, so the honest output is to omit the clause rather
    // than invent a number.
    const containers = med.unitsPerContainer > 0 ? `${Math.ceil(currentStock / med.unitsPerContainer)} containers` : null;
    supplementary = containers ? `${dosesRemaining} doses left · ${containers}` : `${dosesRemaining} doses left`;
  } else {
    // CHANGED 19 Aug 2026 — generalized via effectiveDoseIntervalHours()
    // so custom (every-N-days) scheduling gets a correct "days
    // remaining" figure too, not just daily meds. For daily this is
    // exactly the same math as before (unitsPerDose × dosesPerDay);
    // for custom it correctly averages out to less-than-one dose's
    // worth of consumption per day when the interval is more than a
    // day.
    const intervalHours = effectiveDoseIntervalHours(med);
    const dailyConsumption = intervalHours ? (med.unitsPerDose * 24) / intervalHours : 0;
    const daysRemainingExact = dailyConsumption > 0 ? currentStock / dailyConsumption : null;
    supplementary = daysRemainingExact !== null ? formatRemaining(daysRemainingExact) : "—";
  }
  const range = med.defaultRefillQuantity || med.refillThreshold || 1;
  const barPct = Math.max(0, Math.min(100, ((currentStock - med.refillThreshold) / range) * 100));
  return { tracked: true, currentStock, needsAction, supplementary, barPct };
}

// ADDED 26 Sep 2026 — two calendar-arithmetic helpers, added together
// because they exist for the same reason and were previously hand-inlined
// as raw millisecond maths in three separate places, which is how the DST
// bug below got introduced three times over.
//
//   wholeDaysBetween(a, b) - how many CALENDAR days separate two instants,
//     counting a 23- or 25-hour day as exactly one day.
//   addDays(ts, n)        - the midnight day key n calendar days away,
//     always landing on a real local midnight so it can be compared with
//     the keys doseDays is built from.

/** Normalise any instant to its local midnight day key. */
function midnightKey(ts) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
function wholeDaysBetween(from, to) {
  return Math.round((midnightKey(to) - midnightKey(from)) / 86400000);
}

/** The midnight day key `n` calendar days away from `ts`. */
function addDays(ts, n) {
  const d = new Date(midnightKey(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

// Small helper used only by computeAdherence below — how many of the
// last N days had a logged dose. `expectedDaysOverride`, when given,
// restricts which days actually count as "expected" — used for
// custom (every-N-days) scheduling below, where most calendar days
// were never due in the first place and shouldn't count against
// adherence at all.
function windowStats(doseDays, days, today, expectedDaysOverride) {
  let expected = 0, hit = 0;
  for (let i = 0; i < days; i++) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    const dayTime = day.getTime();
    if (expectedDaysOverride && !expectedDaysOverride.has(dayTime)) continue;
    expected += 1;
    if (doseDays.has(dayTime)) hit += 1;
  }
  // FIXED 27 Sep 2026 — `expected > 0 ? ... : 100` turns "nothing was due in
  // this window" into a perfect score. That is the right call for a window
  // that genuinely contains no due day, and the AdherencePill's own NaN guard
  // depends on it - but it is the WRONG answer for a custom (every-N-days)
  // medication that has never had a dose logged at all, because
  // computeExpectedDoseDays returns an empty set when there is no anchor
  // (nothing has ever been due). Measured: such a medication reported
  // "0/0 · 100%" on its card AND "100%" on Home's Status-at-a-glance ring
  // AND "100%" in Stats' overall adherence - and worse, it INFLATED a mixed
  // set, averaging to 90% when the only real medication was at 80%.
  //
  // So an empty window is only meaningful when the medication actually has
  // history. With no dose ever logged there is nothing to be adherent TO, and
  // reporting 0% is the honest answer: the medication has not been started.
  // `hasHistory` is the caller's own knowledge (does any dose log exist at
  // all), threaded in rather than re-derived here.
  const hasHistory = doseDays.size > 0;
  return {
    hit,
    expected,
    pct: expected > 0 ? Math.round((hit / expected) * 100) : (hasHistory ? 100 : 0),
  };
}

// ADDED 19 Aug 2026 — real feedback batch: custom "every N days"
// scheduling, the user's explicit scope call ("every n days for later meds
// schedules that may realistically get added" — day-of-week
// deliberately NOT built, wasn't asked for). This is the one new piece
// of real logic every other function below builds on: for a
// `usagePattern === "custom"` medication, which calendar days were
// actually EXPECTED, based on `scheduleIntervalDays` and phased off
// the very first dose ever logged (that dose sets which days of the
// cycle the schedule actually falls on — e.g. logging the first dose
// on a Tuesday for an every-3-days med means Tue/Fri/Mon/Thu... are
// the expected days going forward, not an arbitrary fixed calendar
// pattern). Returns null for non-custom meds — callers treat null as
// "every day is expected", the original behavior, unchanged.
// FIXED 26 Sep 2026 — a real DST bug, found by asking whether the "this
// refill" figure could ever legitimately reach 100% (it can, and it should).
//
// This function used to decide which days were due with raw millisecond
// modulo:
//
//     const diff = day.getTime() - anchor;
//     if (diff >= 0 && diff % intervalMs === 0) expected.add(...)
//
// where intervalMs is a flat scheduleIntervalDays * 86400000. Across a
// DST boundary that is wrong by exactly the offset change, so a dose taken
// on a genuine due day silently failed the test, was never added to
// `expected`, and a flawless every-N-days medication lost adherence it had
// actually earned. Measured, not assumed: anchoring a 14-day cycle on
// 1 Mar 2026, this dropped real due days in Europe/London (1), UTC (0),
// America/New_York (3) and Australia/Sydney (1).
//
// The fix is to do calendar arithmetic with setDate(), which is DST-correct
// because it moves the DATE rather than the elapsed milliseconds. The daily
// path in this same file already did it this way and was never affected,
// which is exactly why the bug survived in only the custom branch.
function computeExpectedDoseDays(med, doseDays, windowDays, today) {
  if (med.usagePattern !== "custom" || !med.scheduleIntervalDays) return null;
  const sortedDoseDays = Array.from(doseDays).sort((a, b) => a - b);
  const anchor = sortedDoseDays[0];
  if (anchor == null) return new Set(); // no dose logged yet — nothing's been "due" so far
  const anchorDate = new Date(anchor);
  const expected = new Set();
  for (let i = 0; i < windowDays; i++) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    // Whole calendar days between the anchor and this day, via the shared
    // helper, so a 23- or 25-hour day still counts as exactly one day.
    const elapsedDays = wholeDaysBetween(anchorDate.getTime(), day.getTime());
    if (elapsedDays >= 0 && elapsedDays % med.scheduleIntervalDays === 0) expected.add(day.getTime());
  }
  return expected;
}

// ADDED 19 Aug 2026 — shared by isDoseLockedOut/lockoutEndsEstimate/
// nextDoseEstimate below: the real gap in hours between one dose and
// the next, for whichever scheduling type a medication actually uses.
// Daily: 24h split across dosesPerDay. Custom: scheduleIntervalDays
// full days (one dose per dosing day — the user's ask was "every N days",
// not "N times a day, every M days" — the simpler, actually-requested
// case). PRN and anything unrecognized: no fixed interval, null.
export function effectiveDoseIntervalHours(med) {
  if (med.usagePattern === "daily" && med.dosesPerDay) return 24 / med.dosesPerDay;
  if (med.usagePattern === "custom" && med.scheduleIntervalDays) return med.scheduleIntervalDays * 24;
  return null;
}

// PRN never gets adherence — there's no schedule to measure against, so
// the concept doesn't apply. "Since refill" replaces a fixed 30-day
// window: measured from the most recent Refill log entry, a more
// meaningful baseline than an arbitrary calendar cut.
export function computeAdherence(med) {
  if (med.usagePattern === "prn") return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const doseDays = new Set(med.logs.filter((l) => l.type === "dose" && !l.voided).map((l) => { const d = new Date(l.date); d.setHours(0, 0, 0, 0); return d.getTime(); }));

  // CHANGED 19 Aug 2026 — real custom-scheduling support: for an
  // every-N-days medication, only the days actually due count toward
  // streak/adherence at all — see computeExpectedDoseDays() above for
  // the full reasoning. Daily meds are completely unaffected (every
  // day was already "expected" before, still is).
  // CHANGED 15 Sep 2026 — real report: the streak visibly dropped to 0
  // every day BEFORE that day's own dose was logged (both loops below
  // used to start at "today," i=0/cursor=today's own due slot — if
  // today hadn't been logged yet, the very first check failed and the
  // loop broke immediately, reporting 0 regardless of any real prior
  // streak). Not what "streak" should mean: a dose that isn't overdue
  // yet hasn't been missed. Real fix, matching the owner's own spec
  // ("dose 1 taken, dose 2 missed... streak persists until dose 3 is
  // due, then resets"): today's own slot no longer counts as a
  // streak-breaking check — only days/slots that are ALREADY fully in
  // the past can break the streak, with today's own dose (if already
  // logged) added back on top afterward. A slot that's merely due
  // today and not yet logged no longer zeroes the streak; it only
  // actually breaks once the calendar/interval genuinely moves past it
  // with no dose ever recorded.
  let streak = 0;
  if (med.usagePattern === "custom" && med.scheduleIntervalDays) {
    const sortedDoseDays = Array.from(doseDays).sort((a, b) => a - b);
    const anchor = sortedDoseDays[0];
    if (anchor != null) {
      // FIXED 26 Sep 2026 — same DST bug as computeExpectedDoseDays above,
      // and the same fix. This walked the schedule with flat millisecond
      // steps (anchor + stepsBack * intervalMs), so after a DST change the
      // cursor landed on 23:00 or 01:00 rather than on the midnight day key
      // that doseDays is built from. `doseDays.has(cursor)` then returned
      // false for a dose the user had genuinely taken, silently resetting a
      // real streak. Now walked by calendar day, matching the anchor's own
      // day-of-month cadence.
      const daysSinceAnchor = wholeDaysBetween(anchor, today.getTime());
      const stepsBack = Math.floor(daysSinceAnchor / med.scheduleIntervalDays);
      // FORWARD from the anchor to the most recent due slot at or before
      // today, then walk backwards from there. (An intermediate draft of this
      // fix used a negative offset and walked off the front of the anchor
      // entirely, reporting a streak of 0 for everyone - caught by the
      // DST tests asserting a real value rather than just a percentage.)
      let cursor = addDays(anchor, stepsBack * med.scheduleIntervalDays);
      const todayIsDueSlot = cursor === today.getTime();
      if (todayIsDueSlot) cursor = addDays(cursor, -med.scheduleIntervalDays);
      while (cursor >= anchor && doseDays.has(cursor)) { streak += 1; cursor = addDays(cursor, -med.scheduleIntervalDays); }
      if (todayIsDueSlot && doseDays.has(today.getTime())) streak += 1;
    }
  } else {
    for (let i = 1; i < 365; i++) { const day = new Date(today); day.setDate(day.getDate() - i); if (doseDays.has(day.getTime())) streak += 1; else break; }
    if (doseDays.has(today.getTime())) streak += 1;
  }

  const expected7 = computeExpectedDoseDays(med, doseDays, 7, today);
  const sevenDay = windowStats(doseDays, 7, today, expected7);

  const lastRefill = [...med.logs].filter((l) => l.type === "refill" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  // CHANGED 18 Aug 2026 — real feedback: "since refill" used to span the
  // FULL days elapsed since the last refill log entry, treating one
  // refill as one continuous block. That's wrong for meds dispensed in
  // multiple containers at once — the user's example: PrEP refilled as
  // 5“6 containers in a single order. A refill from months ago would
  // stretch the adherence window across every container in that order,
  // diluting the rate instead of showing how you're doing on the
  // container you're actually currently working through. Fixed by
  // windowing to the current CONTAINER's cycle, not the full refill-to-
  // today span — computed from unitsPerContainer/unitsPerDose/
  // dosesPerDay, the same fields already used for stock/refill math
  // elsewhere in this file, not a new concept.
  // CHANGED 19 Aug 2026 — generalized via effectiveDoseIntervalHours()
  // so custom (every-N-days) meds get a correct per-container cycle
  // length too, not just daily ones — same reasoning as computeStock's
  // own use of this helper above.
  const intervalHoursForContainer = effectiveDoseIntervalHours(med);
  const dailyConsumptionForContainer = intervalHoursForContainer ? (med.unitsPerDose * 24) / intervalHoursForContainer : 0;
  const daysPerContainer = med.unitsPerContainer > 0 && dailyConsumptionForContainer > 0
    ? Math.round(med.unitsPerContainer / dailyConsumptionForContainer)
    : null;
  let sinceRefill;
  if (lastRefill) {
    const refillDay = new Date(lastRefill.date); refillDay.setHours(0, 0, 0, 0);
    // FIXED 26 Sep 2026 — made DST-correct for consistency with the two fixes
    // above, and covered by a test. Being straight about this one: dividing
    // elapsed milliseconds by 86400000 here was NOT an observable bug, unlike
    // the other two. A single DST shift is one hour, and Math.round absorbs a
    // +/-1h error in a day count completely - it cannot cross a rounding
    // boundary, because that would need a 12-hour shift. Verified by
    // mutation: reverting this line fails nothing.
    //
    // Changed anyway because it is a latent trap rather than a live defect -
    // the identical line with Math.floor instead of Math.round would be wrong
    // at every DST boundary, and the "nothing else is wrong here" reasoning
    // that justifies a 0.5 rounding is not something a future editor of this
    // line can see. wholeDaysBetween() counts calendar days, so the question
    // does not arise. Left as a comment rather than a silent tidy because the
    // difference between "fixed a bug" and "removed a trap" is exactly the
    // distinction this file keeps losing track of.
    const daysSince = Math.max(1, wholeDaysBetween(refillDay.getTime(), today.getTime()) + 1);
    const windowDays = daysPerContainer && daysPerContainer > 0
      ? Math.min(daysSince, ((daysSince - 1) % daysPerContainer) + 1)
      : daysSince;
    const expectedSinceRefill = computeExpectedDoseDays(med, doseDays, windowDays, today);
    sinceRefill = windowStats(doseDays, windowDays, today, expectedSinceRefill);
  } else {
    sinceRefill = sevenDay;
  }

  return { streak, sevenDay, sinceRefill };
}

// New 18 Aug 2026, per the user's ask: prevents accidentally logging the
// same daily dose twice in one day. Locked out until 80% of the dosing
// interval has passed since the last dose — for a once-daily medication
// (24h interval), that's ~19.2h, meaning the button unlocks again only
// in roughly the last ~4.8h before the next dose is actually due ("~4h
// early at the earliest", per the user's own rounding). PRN and Custom
// Schedule medications are never locked — there's no fixed interval to
// measure against for PRN, and Custom Schedule doesn't have a UI to
  // build this against yet (Doc 5 §5 already flags Custom Schedule as
// editable-later, not editable-now).
// CHANGED 19 Aug 2026 — real custom-scheduling support, via the shared
// effectiveDoseIntervalHours() helper above. PRN still never locks (no
// fixed interval). Daily behavior is completely unchanged.
//
// REMOVED 26 Sep 2026 — the original isDoseLockedOut() and
// lockoutEndsEstimate() that used to live here, both built on an arbitrary
// 0.8 multiplier. Both now live further down, immediately after
// lockoutEndsAt(), because all three are one decision expressed three ways
// and keeping them adjacent is what stops them drifting apart again - which
// is exactly what had happened.

// ADDED 18 Aug 2026 — real feedback: tapping a locked "Log dose" button
// used to do nothing (native `disabled` blocks the click entirely, and
// the `title` tooltip it relied on for an explanation only shows on
// hover, which doesn't exist on a touchscreen). The user's ask: keep the
// button tappable, show a brief flash message instead of a silent
// no-op. This computes WHEN it unlocks - deliberately distinct from
// nextDoseEstimate() below, which estimates when the dose is actually DUE.
// Both now live together further down, sharing one lockoutEndsAt().
//
// REMOVED 26 Sep 2026 - the old 80%-based version of this. Its comment
// said the lockout "ends earlier, at 80%" than the due time, and that was
// the whole design at the time. It is gone for the reasons set out at the
// replacement below.

// ADDED 15 Sep 2026 — real ask: "thinking maybe remove the auto
// adjust, for reminder at same time." The existing behavior above
// (lockoutEndsAt/nextDoseEstimate computing forward from the literal
// last-logged dose timestamp) is real, intentional, and stays the
// default ("adaptive") — a late dose shifting the next reminder
// forward by the same lateness is correct for someone who's shifted
// their whole day. But it also means one late dose permanently drifts
// every future reminder, which isn't what everyone wants. "Fixed"
// mode uses the medication's own scheduledTimes[0] clock when present,
// while preserving the first logged dose's original calendar cadence.
// If no scheduled time is set, it falls back to the older first-dose
// clock anchor. Either way, one late or early dose only affects that
// one day's own reminder, not every reminder after it. Returns null
// (falls back to adaptive math at the call site) only if no scheduled
// time and no dose log exist — there's no anchor to hold fixed to.
function firstDoseTimestamp(med) {
  const doseLogs = (med.logs || []).filter((l) => l.type === "dose" && !l.voided);
  if (doseLogs.length === 0) return null;
  return Math.min(...doseLogs.map((l) => realTimestampFromStored(l.date)));
}

/**
 * The most recent `count` dose timestamps, oldest first.
 * Used to tell a deliberate shift (phasing/weaning) apart from a one-off.
 */
function recentDoseTimestamps(med, count) {
  const times = (med.logs || [])
    .filter((l) => l.type === "dose" && !l.voided)
    .map((l) => realTimestampFromStored(l.date))
    .sort((a, b) => a - b);
  return times.slice(-count);
}

/**
 * Is the user deliberately shifting their dose time, rather than being late?
 *
 * The owner's own distinction, and the reason lateness alone is not enough:
 * someone part-way through moving a midnight mirtazapine to 10pm is
 * INTENTIONALLY off their original schedule, and snapping them back to
 * midnight would fight the thing they are doing. But a single dose taken an
 * hour late is a blip, and should not move the schedule at all.
 *
 * The signal is therefore direction over TIME, not size. Lateness is measured
 * for the last few doses against each dose's OWN slot, and a shift is only
 * claimed when that lateness has moved consistently in one direction across
 * at least MIN_TREND_DOSES consecutive doses.
 *
 * Three is deliberate, and it is the whole safety argument here: with two
 * doses, "taken 6 hours late once" and "first step of a move to 06:00" are
 * literally the same observation, and this function cannot tell them apart.
 * One data point must never silently rewrite a schedule the user typed in, so
 * the burden of proof sits on the shift. A real weaning move clears three
 * doses easily, and anyone genuinely moving gets their schedule respected
 * from the third dose onward rather than being nagged in between.
 */
const MIN_TREND_DOSES = 3;

function isPhasingAwayFromSchedule(med, anchorMs, intervalHours, lastDoseMs) {
  const recent = recentDoseTimestamps(med, MIN_TREND_DOSES);
  if (recent.length < MIN_TREND_DOSES) return false;
  const intervalMs = intervalHours * 3600000;
  // Each dose's lateness is measured against ITS OWN slot, not the last
  // dose's slot - measuring against the newest slot is off by a whole
  // interval, which inverts the comparison and made every real shift look
  // like a blip.
  const slotFor = (doseMs) => anchorMs + Math.floor((doseMs - anchorMs) / intervalMs) * intervalMs;
  const lateness = recent.map((doseMs) => doseMs - slotFor(doseMs));
  // Strictly monotonic in one direction, all of it real lateness (not noise
  // around the slot). A flat run means a settled new habit rather than an
  // in-progress move, and a wobble means nothing at all.
  let later = true;
  let earlier = true;
  for (let i = 1; i < lateness.length; i += 1) {
    if (!(lateness[i] > lateness[i - 1])) later = false;
    if (!(lateness[i] < lateness[i - 1])) earlier = false;
  }
  return later || earlier;
}

// ADDED 26 Sep 2026 - how far past its scheduled slot a dose may be and
// still count as "on time".
//
// The owner's framing for it was "the inverse of the 80% rule": a dose that
// Both remaining numbers are taken from published NHS guidance rather than
// chosen for feel, and the reasoning is recorded here because the temptation
// to "tune" them later is exactly how the original 0.8 and my own first 0.2
// got in. Source: NHS Specialist Pharmacy Service, "Advising on missed or
// delayed doses of medicines" (sps.nhs.uk, reviewed 3 Jun 2026).
//
// 1. MINIMUM GAP BEFORE THE NEXT DOSE = HALF THE INTERVAL.
//
//    This is the real safety rule, and the guidance states it as an absolute
//    number that happens to be half the interval in every case NHS gives:
//
//      apixaban / dabigatran  12h interval -> 6h minimum gap
//      rivaroxaban           24h interval -> 12h minimum gap
//      antiepileptics (BD)   12h interval -> 6h before the next dose
//
//    "Take the missed dose as soon as you remember IF it's still more than
//    6 hours until your next scheduled dose" - i.e. never let the gap close
//    past half. This app will not tell anyone to skip or double a dose; it
//    only decides how early the button unlocks, so the floor is exactly this
//    and is the one value here that is genuinely load-bearing.
const DOUBLE_DOSE_FLOOR_FRACTION = 0.5;

// 2. HOW LATE A DOSE MAY BE TAKEN AND STILL BE WORTH TAKING = 2 HOURS.
//
//    "For most medicines, it is acceptable to take a dose up to 2 hours
//    late." That is an ABSOLUTE figure in the source, and my earlier
//    LATE_SNAPBACK_FRACTION of 0.2 was a percentage of the interval, which
//    for a once-daily tablet produced 4.8 hours of slack - nearly two and a
//    half times more permissive than the guidance supports. Deriving it from
//    a fraction was the actual bug: it scaled a rule the guidance states in
//    hours. It is now used to explain the state to the user rather than to
//    move the schedule, which is what the guidance actually uses it for.
const MAX_ACCEPTABLE_LAG_HOURS = 2;

// There is deliberately no third constant. An earlier draft had an
// EARLY_TOLERANCE_HOURS and a LATE_SNAPBACK_FRACTION; both are gone because
// neither had anything behind it. "Take a dose up to 2 hours early" is not a
// rule anyone publishes, and the snap-back fraction had no source at all. The
// half-interval floor already prevents a genuinely too-early next dose, which
// was the only safety job the early tolerance was doing.

// All three timing tolerances are declared together, immediately before the
// functions that use them, rather than each sitting next to its own
// function. They were originally scattered 100 lines apart with the lockout
// pair declared *after* a function that already used one of them - legal at
// runtime, but precisely the ordering fragility this file has been bitten by
// before (a past temporal-dead-zone crash on every render).

/**
 * The wall-clock anchor the schedule is counted forward from: the first dose
 * ever logged, re-anchored onto the user's intended clock time when they have
 * set one. Kept separate from fixedModeDueSlot() because the phasing check
 * needs the same anchor, and recomputing it there would be two definitions of
 * "the schedule" that could quietly disagree.
 */
function scheduleAnchorMs(med, lastDoseDate) {
  let anchorMs = firstDoseTimestamp(med) ?? (lastDoseDate ? realTimestampFromStored(lastDoseDate) : null);
  if (med.scheduledTimes?.length > 0) {
    const [h, m] = med.scheduledTimes[0].split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      // Keep the original day/cadence from the first logged dose, but use
      // the user's intended clock time when they have set one.
      const anchorDate = new Date(anchorMs ?? Date.now());
      anchorMs = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate(), h, m).getTime();
    }
  }
  return anchorMs;
}

/**
 * The next slot on the schedule, as a wall-clock time.
 *
 * This function is deliberately UNCONDITIONAL. It answers one question - "if
 * nothing else is going on, when is this medication due?" - and it never
 * looks at how late the last dose actually was, because the schedule is the
 * user's own stated intent and a single late dose does not get to overwrite
 * it. Every decision about lateness, phasing or skipping lives in the caller,
 * which keeps the rule in one readable place instead of half in and half out.
 *
 * A past slot is stepped over rather than offered, which is what gives the
 * "more than twice a day: skip the missed dose, wait until the next one is
 * due" behaviour from the NHS SPS guidance for free - a QDS slot that was
 * missed 30 minutes ago simply ceases to exist as an option.
 */
function fixedModeDueSlot(med, intervalHours, lastDoseDate) {
  const anchorMs = scheduleAnchorMs(med, lastDoseDate);
  if (anchorMs == null) return null;
  const intervalMs = intervalHours * 3600000;
  const now = Date.now();
  if (anchorMs > now) return anchorMs;
  const stepsForward = Math.ceil((now - anchorMs) / intervalMs) || 1;
  let dueMs = anchorMs + stepsForward * intervalMs;
  if (lastDoseDate) {
    const lastDoseMs = realTimestampFromStored(lastDoseDate);
    // Skip forward past any slot that has already gone, so a missed dose is
    // never still being offered as due.
    while (dueMs <= lastDoseMs) dueMs += intervalMs;
  }
  // The half-interval floor applies here as well as in lockoutEndsAt(). Without
  // it, snapping back to a schedule can hand back a due time sooner than the
  // dose button would even unlock - a reminder for a dose that cannot yet be
  // taken, which is the exact inconsistency between the two functions that
  // the old shared 0.8 was originally there to paper over.
  if (lastDoseDate) {
    const lastDoseMs = realTimestampFromStored(lastDoseDate);
    return Math.max(dueMs, lastDoseMs + intervalMs * DOUBLE_DOSE_FLOOR_FRACTION);
  }
  return dueMs;
}

// ADDED 26 Aug 2026 — real ask: custom dose reminder notifications.
// lockoutEndsEstimate() above only ever returns a display STRING
// ("~5h"), not usable for actually scheduling a notification at the
// real moment a dose becomes due. Same exact interval math, just
// returns the raw Date instead of formatting it.
// CHANGED 15 Sep 2026 — real `timingMode` param, "adaptive" (default,
// unchanged) or "fixed" (see firstDoseTimestamp/fixedModeDueSlot
// above). This file stays I/O-free per its own header — callers read
// MedicationPreferencesRepository.getPreferences().reminderTimingMode
// themselves and pass it in, the same "pure function takes data as a
// parameter" pattern already used elsewhere in this codebase.
// Deliberately NOT applied to lockoutEndsEstimate() above — that one's
// whole purpose is double-log prevention right after a real dose was
// just taken, which has to stay anchored to the ACTUAL last dose
// regardless of timing mode.
// ADDED 26 Sep 2026 — REPLACED the old 0.8 (80%) factor, which was an
// arbitrary figure with no pharmacological basis and which the owner
// reported as "never really worked" and causing repeated problems.
//
// Why there is no single defensible percentage: the interval at which a
// repeat dose meaningfully stacks on an un-eliminated previous one is set
// by each drug's own half-life, not by a global fraction. The
// pharmacokinetic literature ties the two together directly - dosing at an
// interval equal to the half-life gives a two-fold peak/trough fluctuation
// at steady state, and accumulation becomes significant once the interval
// falls below roughly four half-lives. So any global percentage is
// simultaneously too tight for some drugs and far too loose for others,
// and a single number that looks authoritative is worse than none.
//
// What replaced it is the rule the owner actually described wanting:
//   - Dosing up to an hour BEFORE your scheduled time is fine. A dose five
//     hours early (a 22:00 dose for a midnight medication) is not.
//   - But phasing is legitimate: if you are deliberately shifting a dose
//     earlier, what limits you is the floor - you may never take a dose
//     sooner than HALF the dosing interval after the last one. That is the
//     genuine double-dose guard, and it is the only part of this that is
//     pharmacological rather than preference.
//   - Late doses must not accumulate drift, so when a schedule exists the
//     next time is capped at (next scheduled slot + one hour) rather than
//     being recomputed from a late actual dose. This is what makes a late
//     dose walk back toward the schedule instead of dragging it along.
//     It also implements BOTH things the owner was unsure they wanted -
//     normalising back toward the schedule, and not drifting further than
//     the nearest reasonable time - because the tolerance band is exactly
//     that: never more than an hour ahead of where the schedule says.
//
// The two bounds are combined as max(halfIntervalFloor, toleranceCeiling),
// so whichever is LATER wins: the floor stops a double dose, the ceiling
// stops the schedule being dragged earlier. With no schedule there is no
// ceiling to respect, and only the floor applies - which is the old
// behaviour minus the made-up 20% of slack.
/**
 * The moment a dose may next be logged: the LATER of
 *   (a) half the dosing interval after the last actual dose, and
 *   (b) the next scheduled slot, when the medication has a schedule.
 * Returns null when the medication has no fixed interval (PRN) or no dose
 * has been logged yet - there is nothing to lock out from.
 *
 * Note there is no early tolerance term. An earlier version subtracted an
 * hour from the schedule to let a dose be taken slightly early, and it was
 * removed on the grounds that no guidance publishes such a rule - which is
 * true, but the real reason it had to go is stronger: the half-interval
 * floor is already earlier than any hour-early window for every frequency
 * this app supports, so the term could never be the binding bound. It was
 * unreachable arithmetic dressed up as a tolerance.
 *
 * The "just over or just under" case the owner asked for is NOT handled by
 * softening this function. It is handled by doseTimingAdvisory(), which
 * explains the situation without moving either bound - so this stays a hard
 * safety floor and the softness lives in the explanation, not the rule.
 */
export function lockoutEndsAt(med, lastDoseDate, timingMode = "adaptive") {
  // ADDED 26 Sep 2026 - a null guard. The previous version of this function
  // called effectiveDoseIntervalHours(med) straight away, which throws on a
  // null medication, so a caller holding an unresolved record crashed rather
  // than seeing "no lockout". Cheap to make total, and consistent with the
  // defensive-default habit the rest of this codebase keeps.
  if (!med || !lastDoseDate) return null;
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!intervalHours) return null;
  const lastMs = realTimestampFromStored(lastDoseDate);
  const floor = lastMs + intervalHours * DOUBLE_DOSE_FLOOR_FRACTION * 3600000;

  // A schedule is an explicit clock-time statement by the user, so it is
  // honoured regardless of the global timingMode - the same precedence
  // getNextNotificationTime() and nextDoseEstimate() already use. The old
  // code applied no schedule logic here at all, which meant that in fixed
  // mode the reminder could fire while the dose was still locked out: a
  // genuine inconsistency between three functions in this same file.
  //
  // With no schedule there is nothing to converge toward, so the ceiling is
  // set to the last dose itself - i.e. it adds no constraint, and the floor
  // alone decides. Leaving the ceiling at the full interval instead (as a
  // first attempt here did) silently made the floor unreachable and left the
  // lockout at 100% of the interval, which is the behaviour being replaced.
  const useFixed = timingMode === "fixed" || (med.scheduledTimes?.length > 0);
  const lastPlusInterval = lastMs + intervalHours * 3600000;
  let ceiling = lastMs;
  if (useFixed) {
    const dueMs = fixedModeDueSlot(med, intervalHours, lastDoseDate);
    // The schedule is a hard ceiling: never unlock before the stated time,
    // however late the last dose actually was. Capped at the plain interval
    // from the real dose so a schedule that is wildly out of step with
    // reality (a medication whose times were edited, say) still produces a
    // real interval rather than locking the user out for days.
    if (dueMs != null) {
      ceiling = Math.min(dueMs, lastPlusInterval);
    }
  }
  return new Date(Math.max(floor, ceiling));
}

/** True when the dose button should still be locked. */
export function isDoseLockedOut(med, lastDoseDate, timingMode = "adaptive") {
  const unlockAt = lockoutEndsAt(med, lastDoseDate, timingMode);
  if (!unlockAt) return false;
  return Date.now() < unlockAt.getTime();
}

/**
 * A gentle, informational note about taking a dose slightly outside the ideal
 * window - NOT a block.
 *
 * This exists because a hard cliff at exactly half the interval is the wrong
 * shape for real life. Nobody's watch is accurate to the minute, and the NHS
 * position is that a dose up to 2 hours off is perfectly acceptable. So inside
 * a short grace window around the boundary, the dose is allowed and this
 * returns a plain-language explanation of what it will mean for the NEXT dose.
 *
 * Three states, deliberately distinct rather than one boolean:
 *   null          - comfortably inside the window, say nothing
 *   "just-early"  - a little before the floor; allowed, next dose shifts later
 *   "just-late"   - a little after the due time; allowed, next dose is today
 *
 * The hard lockout is NOT relaxed by this. It is purely additive advice, so
 * there is no path by which this function can permit something unsafe.
 *
 * HONEST LIMITATION, found by measuring rather than assuming. I originally
 * described this as "deliberately silent in the common case". That was true
 * for a once-daily medication and wrong as a general claim. The window is
 * 2 hours either side of the floor, and the floor sits halfway through the
 * dosing interval, so the fraction of the cycle covered is 4h/interval:
 *
 *   1x/day (24h interval) -> 17% of the time
 *   2x/day (12h)          -> 33%
 *   3x/day  (8h)          -> 50%
 *   4x/day  (6h)          -> 67%   <-- a QDS med shows a message most of the day
 *
 * The 2-hour figure is the NHS-sourced number, so it is not mine to quietly
 * shrink, and the UI is the right place to decide how prominent this is
 * rather than the calculation layer. Left as-is and recorded here deliberately:
 * if it turns out to be annoying on a QDS medication, the fix is a
 * presentation decision (dismissible, or only on an actual log tap), not a
 * smaller magic number in here.
 */
export function doseTimingAdvisory(med, lastDoseDate, timingMode = "adaptive") {
  if (!med || !lastDoseDate) return null;
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!intervalHours) return null;

  const floorMs = realTimestampFromStored(lastDoseDate) + intervalHours * DOUBLE_DOSE_FLOOR_FRACTION * 3600000;
  const untilFloor = floorMs - Date.now();
  const graceMs = MAX_ACCEPTABLE_LAG_HOURS * 3600000;

  // Comfortably clear of the floor in either direction: nothing to say.
  if (Math.abs(untilFloor) > graceMs) return null;

  const hours = (ms) => `${Math.max(1, Math.round(Math.abs(ms) / 3600000))}h`;
  if (untilFloor > 0) {
    // Close to the floor but not past it - the user is about to take it early.
    return {
      kind: "just-early",
      hours: hours(untilFloor),
      message: `${hours(untilFloor)} before the safe window. Fine to log, but your next dose will shift a little later so the gap between doses does not get too short.`,
    };
  }
  // Past the floor, but by less than the accepted lateness. The dose is still
  // loggable; this only explains that the next one is due sooner than usual.
  return {
    kind: "just-late",
    hours: hours(untilFloor),
    message: `Logged ${hours(untilFloor)} ahead of the usual window. Still fine - the next dose stays on your normal schedule.`,
  };
}

/**
 * Human-readable time until the lockout lifts, e.g. "~5h" / "now".
 * Kept separate from nextDoseEstimate() deliberately: the lockout answers
 * "when may I take this", the next-dose estimate answers "when is it due".
 * They used to be conflated through a shared 0.8, which is how the two came
 * to disagree with each other.
 */
export function lockoutEndsEstimate(med, lastDoseDate, timingMode = "adaptive") {
  const unlockAt = lockoutEndsAt(med, lastDoseDate, timingMode);
  if (!unlockAt) return null;
  const hoursLeft = Math.round((unlockAt.getTime() - Date.now()) / 3600000);
  if (hoursLeft <= 0) return "now";
  if (hoursLeft < 24) return `~${hoursLeft}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}

/**
 * The next due time, honouring the medication's timing mode.
 *
 * "fixed" means exactly what it says: the same time every day, on the same
 * cadence, regardless of how late any individual dose was taken. That is the
 * entire point of the mode, and it is why the phasing check below is gated
 * behind "adaptive" rather than being applied whenever a schedule exists. An
 * earlier version let a detected shift override the schedule even in fixed
 * mode, which quietly turned "fixed" into "mostly fixed" and made the setting
 * a lie the user could not see.
 *
 * "adaptive" is where the weaning/phasing detection earns its place: a
 * demonstrated, multi-dose trend away from the schedule is respected, so
 * someone deliberately moving a midnight dose to 10pm is not dragged back.
 * One late dose is never enough, and an unproven trend always falls back to
 * the schedule.
 */
export function getNextNotificationTime(med, lastDoseDate, timingMode = "adaptive") {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!intervalHours) return null;

  // The schedule is only an input when the user has actually set one (or has
  // asked for fixed mode). Without it there is no clock time to honour, and
  // routing through fixedModeDueSlot() anyway would anchor an arbitrary slot
  // on the very first dose and then step it forward to today - so a dose
  // logged 11 days ago would come back due "11 days later" rather than in 24h.
  // That regression was caught by the pre-existing adaptive-mode test.
  const hasSchedule = (med.scheduledTimes?.length ?? 0) > 0;
  if (timingMode !== "fixed" && !hasSchedule) {
    if (!lastDoseDate) return null;
    return new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 3600000);
  }

  const dueMs = fixedModeDueSlot(med, intervalHours, lastDoseDate);

  if (shouldFollowDose(med, lastDoseDate, intervalHours, timingMode)) {
    const lastDoseMs = realTimestampFromStored(lastDoseDate);
    const followed = lastDoseMs + intervalHours * 3600000;
    const floor = lastDoseMs + intervalHours * DOUBLE_DOSE_FLOOR_FRACTION * 3600000;
    // Never let a followed dose rewind the schedule behind a slot that is
    // genuinely still ahead - max() against dueMs minus one interval keeps a
    // rapid shift from pulling the next dose earlier than the current slot.
    return new Date(Math.max(followed, floor));
  }
  if (dueMs != null) return new Date(dueMs);
  if (!lastDoseDate) return null;
  return new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 3600000);
}

/**
 * Should the next dose follow the dose actually taken, rather than the
 * schedule? True only in adaptive mode, only with a schedule to deviate from,
 * and only on a demonstrated trend.
 */
function shouldFollowDose(med, lastDoseDate, intervalHours, timingMode) {
  if (timingMode === "fixed") return false;
  if (!lastDoseDate) return false;
  if (!(med.scheduledTimes?.length > 0)) return false;
  const anchorMs = scheduleAnchorMs(med, lastDoseDate);
  if (anchorMs == null) return false;
  return isPhasingAwayFromSchedule(med, anchorMs, intervalHours, realTimestampFromStored(lastDoseDate));
}


// Estimated time until the next dose is due, from the last dose taken and
// the medication's dosing frequency. Returns null for PRN (no schedule)
// or when there's no last dose to count forward from yet.
// CHANGED 15 Sep 2026 — same real `timingMode` addition as lockoutEndsAt
// above, same reasoning.
export function nextDoseEstimate(med, lastDoseDate, timingMode = "adaptive") {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (med.usagePattern === "prn" || !intervalHours) return null;
  // If medication has scheduledTimes set, always use fixed-mode calculation
  // (user's explicit clock-time intent) regardless of global timingMode.
  // Same precedence rule as getNextNotificationTime() above, for the same
  // reason: no user-set schedule means no clock time to honour, and counting
  // forward from the real last dose is the only meaningful answer.
  const hasSchedule = (med.scheduledTimes?.length ?? 0) > 0;
  const useFixed = timingMode === "fixed" || hasSchedule;
  let next = null;
  if (useFixed) {
    if (shouldFollowDose(med, lastDoseDate, intervalHours, timingMode)) {
      const lastDoseMs = realTimestampFromStored(lastDoseDate);
      next = new Date(Math.max(
        lastDoseMs + intervalHours * 3600000,
        lastDoseMs + intervalHours * DOUBLE_DOSE_FLOOR_FRACTION * 3600000,
      ));
    } else {
      const dueMs = fixedModeDueSlot(med, intervalHours, lastDoseDate);
      if (dueMs != null) next = new Date(dueMs);
    }
  }
  if (!next) {
    if (!lastDoseDate) return null;
    next = new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 3600000);
  }
  const hoursLeft = Math.round((next.getTime() - Date.now()) / 3600000);
  if (hoursLeft <= 0) return "due now";
  if (hoursLeft < 24) return `~${hoursLeft}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}
