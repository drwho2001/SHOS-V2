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

/** Reduce a Date to the user's own local calendar day, as YYYY-MM-DD. */
export function localDayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Reduce a STORED date value to its own day, as YYYY-MM-DD. Never shifts. */
export function storedDayKey(storedIso) {
  if (typeof storedIso !== "string" || storedIso.length < 10) return null;
  return storedIso.slice(0, 10);
}

const dayNumber = (key) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86400000);

/**
 * Which day of the cycle is the user on? Day 1 is the start date itself.
 *
 * Returns null when there is no usable start date, so the caller can decline to
 * say anything rather than inventing a day. Clamped at 1 because a cycle that
 * has not started yet, or a future-dated record, must not report day 0 or a
 * negative - a widget showing "day -3" is worse than showing nothing.
 */
export function getCycleDayForWidget(startDateStored, now = new Date()) {
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
export function formatWidgetDayKey(dayKey) {
  if (!dayKey) return null;
  const d = new Date(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  });
}
