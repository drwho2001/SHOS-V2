// dateInputHelpers.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: a "Now" quick-fill button on every date/time input,
// filling in the device's actual current local date/time. Built as
// its own shared file rather than duplicated per-module, since the
// same real bug (round-tripping through `new Date(...).toISOString()`,
// which silently converts local time to UTC) was JUST found and fixed
// in Encounters' own DateTimeField — every "Now" button needs the same
// care, not a fresh chance to reintroduce it in a different file.
//
// The user's own explicit, repeated principle: whatever time is captured
// is correct for his geography at that moment and must never be
// shifted for BST/UTC/DST after the fact. For "Now" specifically, that
// means reading the device's LOCAL wall-clock components directly
// (getFullYear/getMonth/getDate/getHours/getMinutes — the local
// getters, not getUTCFullYear etc.) and formatting them by hand, never
// calling .toISOString() on a bare `new Date()`, which outputs UTC and
// would shift the displayed number exactly like the bug just fixed.

function pad(n) {
  return String(n).padStart(2, "0");
}

// For type="date" inputs — returns "YYYY-MM-DD" for today, local time.
export function nowAsDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// For type="datetime-local" inputs — returns "YYYY-MM-DDTHH:mm" for
// right now, local time (matches what the datetime-local input itself
// expects as a raw value).
export function nowAsDateTimeLocalString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Matches the app's real stored format (a "Z"-suffixed ISO string that
// represents literal wall-clock time, not true UTC — same convention
// as every other date in this app, established during the real data
// migration and reconfirmed since). Used where a field stores the full
// ISO string directly rather than routing through a date-only <input>.
export function nowAsStoredDateTime() {
  return `${nowAsDateTimeLocalString()}:00.000Z`;
}

export function nowAsStoredDate() {
  return `${nowAsDateString()}T00:00:00.000Z`;
}

// ADDED — real ask: Clinic Card's "TOC 2 week" quick-add shortcut
// needs a real date N days out, not just "now". Built the same safe
// way as everything else in this file — adds to the LOCAL day
// component directly (JS's Date object correctly rolls over
// month/year boundaries when you set an out-of-range day, e.g.
// setDate(35) in January correctly becomes February), then reads the
// result back via the local getters, never via .toISOString() on a
// bare Date, which is the pattern that caused the real shift bug this
// whole file exists to prevent.
export function inDaysAsStoredDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00.000Z`;
}

// ADDED — real bug found while fixing notification scheduling: this
// app's stored dates are a deliberate lie (see file header) — the "Z"
// suffix is NOT real UTC, so `new Date(storedString).getTime()` returns
// an epoch that's shifted by the device's real UTC offset (0 in GMT,
// 1h in BST) from the instant actually meant. DISPLAY code already
// undoes this correctly by reading the digits back via
// `toLocaleString(..., { timeZone: "UTC" })` — see e.g. Medication
// Dashboard's formatLastDose(). But several places also do real
// ARITHMETIC against `Date.now()`/`new Date()` (dose lockout timing,
// DoxyPEP's 72h window, clinic-visit reminder offsets) — mixing a
// fake-UTC epoch with a real one there doesn't just mis-DISPLAY a
// time, it silently shifts the actual computed deadline by the same
// offset, which is why medication reminders/DoxyPEP's countdown/clinic
// reminders could fire up to an hour later (or earlier) than the real
// due moment depending on BST/GMT. This is the read-back-correctly
// equivalent for arithmetic: parse the stored string, read its digits
// back literally via the UTC getters (undoing the "Z" lie), then
// rebuild a genuine local-time Date from those same digits — whose
// .getTime() is the real, correct instant, safe to diff against
// Date.now() or pass straight to a notification scheduler.
export function realTimestampFromStored(storedIso) {
  const d = new Date(storedIso);
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
  ).getTime();
}

// ---------------------------------------------------------------------------
// DISPLAY — the other half of the same problem, and the fix for a real
// cross-platform bug.
//
// The file header explains that a STORED date is a deliberate "Z"-suffixed
// lie: the digits are literal wall-clock time and the Z is not true UTC. So
// `new Date("2026-03-01T00:30:00.000Z")` is a real instant 30 minutes AFTER
// UTC midnight, and asking the browser to render it in the LOCAL timezone
// re-applies the very offset the storage format was invented to avoid.
//
// A handful of call sites had worked this out individually — ClinicVisits'
// formatDate carries a comment explaining exactly this, and it passes
// `timeZone: "UTC"`. The other copies of the same function did not, so the
// app rendered the SAME saved date differently depending on which screen you
// looked at it on, and differently again depending on where the device was.
// Measured: identical input rendered as "1 Mar" in London and "28 Feb" in
// New York. Invisible in the UK, so it was never caught by eye.
//
// These two helpers make the correct choice the easy one. They are
// deliberately NOT interchangeable:
//
//   formatStoredDate / formatStoredDateTime
//     For a STORED date (the fake-UTC lie). Reads the digits back literally.
//   formatInstantDate / formatInstantDateTime
//     For a REAL instant — `createdAt`/`updatedAt`, which come from a genuine
//     `new Date().toISOString()` and ARE true UTC. These must render in local
//     time, because the user is looking at when something really happened
//     relative to themselves.
//
// Getting this backwards is the trap the naming exists to prevent: pinning a
// real instant to "UTC" shows an event at the wrong local time, and letting a
// stored date render locally shifts its date. See dateDisplay.test.js, which
// asserts the two families disagree where they must and agree where they must.

/** Renders a STORED date (fake-UTC digits) as e.g. "1 Mar 2026". */
export function formatStoredDate(storedIso) {
  if (!storedIso) return "-";
  return new Date(storedIso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

/** Renders a STORED date-time (fake-UTC digits) as e.g. "1 Mar 2026, 09:30". */
export function formatStoredDateTime(storedIso) {
  if (!storedIso) return "-";
  const d = new Date(storedIso);
  return `${d.toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`;
}

/** Renders a REAL instant (createdAt/updatedAt) in the device's local time. */
export function formatInstantDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

/** Renders a REAL instant (createdAt/updatedAt) in local date + time. */
export function formatInstantDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

// ────────────────────────────────────────────────────────────────────────────
// CALENDAR-DAY PRIMITIVES
//
// ADDED 29 Sep 2026 (t020). This file already answers "which frame is this
// date in?" for rendering - formatStoredDate reads a stored wall-clock value in
// UTC, formatInstantDate reads a real instant locally. It did NOT answer that
// question for ARITHMETIC, so the same day-key logic was written three times
// in one day: here, in menstrualCalculations.js, and in statsCalculations.js.
// Two of those three were written hours apart in the same session, by the same
// person, fixing the same bug class. That is precisely the duplication this
// module exists to prevent, and it is recorded here so the next person does not
// add a fourth.
//
// The distinction that matters, and is easy to lose:
//
//   A STORED value holds the user's own wall-clock day. Its calendar day is the
//   digits they typed, read with NO conversion.
//   A REAL INSTANT is a moment. Its calendar day depends on the device's zone.
//
//   So `localDayKey` is not "the same kind of thing" as `storedDayKey` - it is
//   deliberately the other frame. Questions a person answers in their own days
//   ("how many days since I last tested") MUST combine the two, which is
//   `calendarDaysBetween(storedDayKey(x), localDayKey(now))`.
// ────────────────────────────────────────────────────────────────────────────

/**
 * The calendar day a STORED value names, as YYYY-MM-DD.
 *
 * Never shifts. A stored "2026-09-01" is the 1st, in every timezone, because
 * that is the day the user typed. Returns null for anything that is not a
 * usable date, so callers must handle absence rather than reading "Invalid
 * Date" out of a Number.
 */
export function storedDayKey(storedIso) {
  if (typeof storedIso !== "string" || storedIso.length < 10) return null;
  if (storedIso.slice(4, 5) !== "-" || storedIso.slice(7, 8) !== "-") return null;
  return storedIso.slice(0, 10);
}

/** Today in the USER'S OWN timezone, as YYYY-MM-DD. */
export function localDayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Whole calendar days from `fromKey` to `toKey`, both YYYY-MM-DD.
 *
 * Calendar arithmetic on UTC midnight, NOT elapsed milliseconds. Dividing an
 * elapsed span by 86400000 is the anti-pattern this project has been bitten by
 * repeatedly: the answer shifts with the device's offset and by an hour across
 * a DST boundary, and it is the reason a fully-dosed month once read 97%.
 *
 * Returns null if either side is unusable, so a caller cannot accidentally
 * treat "no data" as "zero days ago".
 */
export function calendarDaysBetween(fromKey, toKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey || "") || !/^\d{4}-\d{2}-\d{2}$/.test(toKey || "")) return null;
  return Math.round(Date.parse(`${toKey}T00:00:00Z`) / 86400000) - Math.round(Date.parse(`${fromKey}T00:00:00Z`) / 86400000);
}

/**
 * How many days have passed since a STORED value, in the user's own days.
 *
 * This is the shape most of the app's "days since" figures need, and the one
 * that was being written inline in at least five places, each with its own
 * version of the bug. Day 1 is the stored day itself - 0 days ago, not 1.
 *
 * `now` is a parameter so tests can pin it without faking the global clock, and
 * defaults to the real now so call sites stay readable.
 */
export function daysSinceStoredDay(storedIso, now = new Date()) {
  const from = storedDayKey(storedIso);
  if (!from) return null;
  return calendarDaysBetween(from, localDayKey(now));
}
