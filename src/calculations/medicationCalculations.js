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
    supplementary = `${dosesRemaining} doses left · ${Math.ceil(currentStock / med.unitsPerContainer)} containers`;
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
  return { hit, expected, pct: expected > 0 ? Math.round((hit / expected) * 100) : 100 };
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
function computeExpectedDoseDays(med, doseDays, windowDays, today) {
  if (med.usagePattern !== "custom" || !med.scheduleIntervalDays) return null;
  const sortedDoseDays = Array.from(doseDays).sort((a, b) => a - b);
  const anchor = sortedDoseDays[0];
  if (anchor == null) return new Set(); // no dose logged yet — nothing's been "due" so far
  const intervalMs = med.scheduleIntervalDays * 86400000;
  const expected = new Set();
  for (let i = 0; i < windowDays; i++) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    const diff = day.getTime() - anchor;
    if (diff >= 0 && diff % intervalMs === 0) expected.add(day.getTime());
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
  let streak = 0;
  if (med.usagePattern === "custom" && med.scheduleIntervalDays) {
    const sortedDoseDays = Array.from(doseDays).sort((a, b) => a - b);
    const anchor = sortedDoseDays[0];
    if (anchor != null) {
      const intervalMs = med.scheduleIntervalDays * 86400000;
      const stepsBack = Math.floor((today.getTime() - anchor) / intervalMs);
      let cursor = anchor + stepsBack * intervalMs;
      while (cursor >= anchor && doseDays.has(cursor)) { streak += 1; cursor -= intervalMs; }
    }
  } else {
    for (let i = 0; i < 365; i++) { const day = new Date(today); day.setDate(day.getDate() - i); if (doseDays.has(day.getTime())) streak += 1; else break; }
  }

  const expected7 = computeExpectedDoseDays(med, doseDays, 7, today);
  const sevenDay = windowStats(doseDays, 7, today, expected7);

  const lastRefill = [...med.logs].filter((l) => l.type === "refill" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  // CHANGED 18 Aug 2026 — real feedback: "since refill" used to span the
  // FULL days elapsed since the last refill log entry, treating one
  // refill as one continuous block. That's wrong for meds dispensed in
  // multiple containers at once — the user's example: PrEP refilled as
  // 5–6 containers in a single order. A refill from months ago would
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
    const daysSince = Math.max(1, Math.round((today.getTime() - refillDay.getTime()) / 86400000) + 1);
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
export function isDoseLockedOut(med, lastDoseDate) {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!lastDoseDate || !intervalHours) return false;
  const hoursSinceLastDose = (Date.now() - realTimestampFromStored(lastDoseDate)) / 3600000;
  return hoursSinceLastDose < intervalHours * 0.8;
}

// ADDED 18 Aug 2026 — real feedback: tapping a locked "Log dose" button
// used to do nothing (native `disabled` blocks the click entirely, and
// the `title` tooltip it relied on for an explanation only shows on
// hover, which doesn't exist on a touchscreen). The user's ask: keep the
// button tappable, show a brief flash message instead of a silent
// no-op. This computes WHEN it unlocks — deliberately distinct from
// nextDoseEstimate() below, which estimates when the dose is actually
// DUE (100% of the interval) — lockout ends earlier, at 80%. Reusing
// nextDoseEstimate's number here would tell the user the wrong time.
export function lockoutEndsEstimate(med, lastDoseDate) {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!lastDoseDate || !intervalHours) return null;
  const unlockAt = new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 0.8 * 3600000);
  const hoursLeft = Math.round((unlockAt.getTime() - Date.now()) / 3600000);
  if (hoursLeft <= 0) return "now";
  if (hoursLeft < 24) return `~${hoursLeft}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}

// ADDED 26 Aug 2026 — real ask: custom dose reminder notifications.
// lockoutEndsEstimate() above only ever returns a display STRING
// ("~5h"), not usable for actually scheduling a notification at the
// real moment a dose becomes due. Same exact interval math, just
// returns the raw Date instead of formatting it.
export function lockoutEndsAt(med, lastDoseDate) {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!lastDoseDate || !intervalHours) return null;
  return new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 0.8 * 3600000);
}


// Estimated time until the next dose is due, from the last dose taken and
// the medication's dosing frequency. Returns null for PRN (no schedule)
// or when there's no last dose to count forward from yet.
export function nextDoseEstimate(med, lastDoseDate) {
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!lastDoseDate || med.usagePattern === "prn" || !intervalHours) return null;
  const next = new Date(realTimestampFromStored(lastDoseDate) + intervalHours * 3600000);
  const hoursLeft = Math.round((next.getTime() - Date.now()) / 3600000);
  if (hoursLeft <= 0) return "due now";
  if (hoursLeft < 24) return `~${hoursLeft}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}
