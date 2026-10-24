// Pure helpers for the home-screen cycle WIDGET.
//
// EXTRACTED 29 Sep 2026 (t020) because the logic lived inline in a large JSX
// file, inside an async function, behind a Capacitor plugin bridge - which means
// none of it could be tested without a device. The three defects below were all
// invisible for the same reason, and only the third was found by reading rather
// than by running timezone variants.
//
// THE CONVENTION, WHICH IS THE WHOLE PROBLEM HERE. `startDate` is a STORED value:
// fake-UTC digits holding the user's own wall-clock day. "Now" is a REAL instant.
// Those are two different frames, and the original code divided one by the other:
//
//   Math.floor((now - startDate) / 86400000)
//
// which is the elapsed-milliseconds anti-pattern this project has now been bitten
// by twice. Concretely: a cycle that started 10 Sep, at 22:00 local on 10 Sep in
// New York, is 1.08 "days" later by that maths, so it reported cycle day 2 while
// the user was still on day 1 - and the phase boundaries are derived from
// cycleDay, so the wrong DAY also meant the wrong PHASE on the home screen.
//
// So: the stored side is compared as a calendar DAY KEY, and the real side is
// reduced to the user's LOCAL day, because "which day of my cycle am I on" is a
// question a person answers in their own days. That is not the same frame as the
// stored value, and pretending otherwise is the bug.
//
// The day-key primitives themselves are NOT defined here. They live in
// dateInputHelpers, which owns the stored-frame vs real-instant question for the
// whole app - because this file's own copies were the second and third versions
// written in a single day, which is the duplication the canonical module exists
// to stop.
import { storedDayKey, localDayKey, calendarDaysBetween } from "./dateInputHelpers";

const dayNumber = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86400000);

/**
 * Which day of the cycle is the user on? Day 1 is the start date itself.
 *
 * Returns null when there is no usable start date, so the caller can decline to
 * say anything rather than inventing a day. Clamped at 1 because a cycle that
 * has not started yet, or a future-dated record, must not report day 0 or a
 * negative - a widget showing "day -3" is worse than showing nothing.
 */
export function getCycleDay(startDateStored, now = new Date()) {
  const start = storedDayKey(startDateStored);
  if (!start) return null;
  return Math.max(1, dayNumber(localDayKey(now)) - dayNumber(start) + 1);
}

/**
 * The cycle phase, from the same day boundaries the app's own cycle view uses.
 * Exported rather than inlined so the widget and the screen cannot drift apart
 * into reporting different phases for the same day.
 */
export function getCyclePhase(cycleDay) {
  if (!Number.isFinite(cycleDay)) return null;
  if (cycleDay <= 7) return "Menstrual";
  if (cycleDay <= 14) return "Follicular";
  if (cycleDay <= 21) return "Ovulatory";
  return "Luteal";
}

/**
 * The stored day key the next period is predicted to start, or null.
 *
 * FIXED 29 Sep 2026: the original was
 * `new Date(startDate.getTime() + avgLength * 24 * 60 * 60 * 1000)` with NO guard
 * on avgLength, and `getAverageCycleLengthDays()` returns **null** when there are
 * fewer than two logged cycles. `null * 86400000` is 0, so the prediction
 * collapsed onto the start date itself - the widget told a user with one recorded
 * cycle that their next period was due on the day their last one started.
 *
 * That is not a timezone bug and no amount of running timezone variants would
 * have found it, which is the argument for extracting this at all: it is now one
 * branch with a test, instead of an expression inside a device-only code path.
 */
export function getNextPeriodDayKey(startDateStored, avgLengthDays) {
  const start = storedDayKey(startDateStored);
  if (!start) return null;
  if (!Number.isFinite(avgLengthDays) || avgLengthDays <= 0) return null;
  // In MILLISECONDS from the epoch, not a day number. My first version added a
  // day-count to a day-number and called the result a timestamp, which put
  // every prediction in 1970 - and the test caught it, which is the only reason
  // this function is extracted and pure in the first place.
  return new Date(dayNumber(start) * 86400000 + Math.round(avgLengthDays) * 86400000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Symptom correlation across cycles - EXPERIMENTAL, INFORMATIONAL ONLY.
 *
 * Returns an array of { symptomId, count, total } showing how many of the
 * last N cycles included each symptom. This is a DESCRIPTION of logged
 * data, not a prediction and not a diagnosis.
 *
 * SAFETY: The app is not a diagnosis engine. This function must never be
 * used to suggest a condition, recommend treatment, or make any clinical
 * claim. It is a pattern-recognition aid for the user's own awareness,
 * labelled "experimental" in the UI, with a prompt to verify with a
 * clinician independently.
 *
 * @param {Array<{symptomIds: string[]}>} cycles - most recent first
 * @param {number} lookback - how many cycles to consider (default 6)
 * @returns {Array<{symptomId: string, count: number, total: number, frequency: number}>}
 */
export function getCycleSymptomCorrelation(cycles, lookback = 6) {
  if (!Array.isArray(cycles) || cycles.length === 0) return [];
  const recent = cycles.slice(0, Math.min(lookback, cycles.length));
  const total = recent.length;
  if (total === 0) return [];
  const counts = new Map();
  for (const c of recent) {
    const ids = Array.isArray(c.symptomIds) ? c.symptomIds : [];
    for (const id of ids) {
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  const result = [];
  for (const [symptomId, count] of counts) {
    result.push({
      symptomId,
      count,
      total,
      frequency: Math.round((count / total) * 100),
    });
  }
  result.sort((a, b) => b.frequency - a.frequency || a.symptomId.localeCompare(b.symptomId));
  return result;
}

/**
 * How many days until the predicted next period, or null if there is no
 * prediction. Negative when the prediction has passed - that is not an
 * error, it is the normal "overdue" state, and the caller decides how to
 * word it. Zero means "today".
 *
 * WHY THIS EXISTS. The widget used to show only the DATE of the next
 * period, which answers "when" but not "how long" - and "how long" is the
 * question a person actually asks when they glance at a widget. A date
 * alone requires the reader to do the subtraction themselves, on a screen
 * they are looking at for two seconds.
 *
 * The prediction is an ESTIMATE, and this number is an estimate of an
 * estimate. It must never be presented as a countdown to a certain event.
 */
export function getDaysUntilNextPeriod(startDateStored, avgLengthDays, now = new Date()) {
  const nextKey = getNextPeriodDayKey(startDateStored, avgLengthDays);
  if (!nextKey) return null;
  const today = localDayKey(now);
  return calendarDaysBetween(today, nextKey);
}

/**
 * A plain-language summary of cycle regularity, or null when there is not
 * enough history to say anything honest.
 *
 * Returns { min, max, average, count } so the caller can show a range
 * ("26-30 days") rather than a single number that implies more precision
 * than the data supports. A single average of 28 hides a range of 24-32,
 * which is the difference between "regular" and "worth mentioning to a
 * clinician."
 *
 * SAFETY. This is a DESCRIPTION of logged data, not a prediction and not
 * a diagnosis. It says what happened; it does not say what will happen or
 * what it means clinically. The app's standing rule applies: no automated
 * clinical risk scoring, no diagnosis engine.
 */
export function getCycleRegularity(cycleStartDates) {
  if (!Array.isArray(cycleStartDates) || cycleStartDates.length < 2) return null;
  const sorted = [...cycleStartDates]
    .map((d) => storedDayKey(d))
    .filter(Boolean)
    .sort();
  if (sorted.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const days = calendarDaysBetween(sorted[i - 1], sorted[i]);
    if (days > 0) gaps.push(days);
  }
  if (!gaps.length) return null;
  return {
    min: Math.min(...gaps),
    max: Math.max(...gaps),
    average: Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length),
    count: gaps.length,
  };
}

/**
 * Render a predicted day key for the widget.
 *
 * FIXED 29 Sep 2026: the original called `toLocaleDateString` with no
 * `timeZone` on a UTC-derived date, so west of UTC the widget showed the
 * PREVIOUS day - a predicted period start, on the home screen, one day early.
 *
 * `timeZone: "UTC"` is correct here precisely BECAUSE the day key came from
 * stored-frame arithmetic. The one place this must not be copied is a value
 * that is genuinely a real instant, where the device's own zone is right.
 */
export function formatDayKeyForDisplay(dayKey) {
  if (!dayKey) return null;
  const d = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}
