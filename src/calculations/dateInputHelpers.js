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
