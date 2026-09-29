import { describe, it, expect } from 'vitest';
import {
  nowAsStoredDateTime,
  nowAsDateString,
  nowAsDateTimeLocalString,
  nowAsStoredDate,
  inDaysAsStoredDate,
  realTimestampFromStored,
  storedDayKey,
  localDayKey,
  calendarDaysBetween,
  daysSinceStoredDay,
} from './dateInputHelpers';

describe('dateInputHelpers', () => {
  describe('nowAsStoredDateTime', () => {
    it('returns string in fake-UTC format', () => {
      const result = nowAsStoredDateTime();
      // Format: YYYY-MM-DDTHH:mm:00.000Z
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
    });

    it('seconds and milliseconds are zeroed', () => {
      const result = nowAsStoredDateTime();
      expect(result.endsWith(':00.000Z')).toBe(true);
    });
  });

  describe('nowAsDateString', () => {
    it('returns YYYY-MM-DD format', () => {
      const result = nowAsDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('nowAsDateTimeLocalString', () => {
    it('returns YYYY-MM-DDTHH:mm format', () => {
      const result = nowAsDateTimeLocalString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });

  describe('nowAsStoredDate', () => {
    it('returns fake-UTC format with midnight time', () => {
      const result = nowAsStoredDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
  });

  describe('inDaysAsStoredDate', () => {
    it('returns YYYY-MM-DD from fake-UTC string with days offset', () => {
      const result = inDaysAsStoredDate(0);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it('handles future dates', () => {
      const result = inDaysAsStoredDate(5);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it('handles past dates', () => {
      const result = inDaysAsStoredDate(-5);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
  });

  describe('realTimestampFromStored', () => {
    it('parses fake-UTC as local time', () => {
      // Fake-UTC: 2026-09-15T08:00:00.000Z (literal 08:00 local)
      const stored = '2026-09-15T08:00:00.000Z';
      const result = realTimestampFromStored(stored);
      // Should be treated as 08:00 local, not 08:00 UTC
      const expected = new Date(2026, 8, 15, 8, 0, 0).getTime(); // month is 0-indexed
      expect(result).toBe(expected);
    });

    it('handles midnight correctly', () => {
      const stored = '2026-01-01T00:00:00.000Z';
      const result = realTimestampFromStored(stored);
      const expected = new Date(2026, 0, 1, 0, 0, 0).getTime();
      expect(result).toBe(expected);
    });
  });

  // ADDED 25 Sep 2026 - regression cover for a real bug the owner hit
  // during early development: a time they entered came back shifted by an
  // hour. Cause was a STORED field being written with
  // nowAsDateTimeLocalString() (the raw, UNSUFFIXED value a
  // <input type="datetime-local"> expects) instead of
  // nowAsStoredDateTime(). Without the fake-UTC suffix, `new Date(stored)`
  // is parsed by JS as LOCAL time, while display code reads the digits back
  // with timeZone:"UTC" - so the value displayed (and any reminder offset
  // computed from it) one hour early for as long as the device was on BST.
  //
  // This is invisible in GMT and in CI (which runs UTC), which is exactly
  // why it survived. The property asserted below holds in EVERY timezone,
  // so it catches the regression regardless of where the suite runs.
  describe('stored datetime round-trips to the wall clock the user entered', () => {
    it('nowAsStoredDateTime() recovers the same local hour it was created at', () => {
      const stored = nowAsStoredDateTime();
      const back = new Date(realTimestampFromStored(stored));
      const now = new Date();
      expect(back.getFullYear()).toBe(now.getFullYear());
      expect(back.getMonth()).toBe(now.getMonth());
      expect(back.getDate()).toBe(now.getDate());
      expect(back.getHours()).toBe(now.getHours());
      expect(back.getMinutes()).toBe(now.getMinutes());
    });

    it('the unsuffixed form silently shifts the wall clock (why the suffix exists)', () => {
      // This is the actual bug the owner hit, asserted through the one
      // observable that matters: the LOCAL hour a user would see.
      //
      // realTimestampFromStored() does `new Date(storedIso)` and then
      // re-reads that result's UTC components, rebuilding them as a local
      // Date. With the fake-UTC suffix that round-trips faithfully. Without
      // it, JS parses the bare datetime-local string as LOCAL time, so the
      // UTC components are already an hour (or 5h30m, or 9h30m) off before
      // the function ever reinterprets them - the digits the user entered
      // come back shifted.
      //
      // Written with local getHours() rather than any offset arithmetic
      // after two earlier versions failed for reasons unrelated to the app:
      // one sampled the current device offset while using a fixed JANUARY
      // date (the UK is GMT in January, BST in July), and the next read
      // the offset back via new Date(timestamp).getTimezoneOffset(), which
      // reports 0 under this project's test runner even while string
      // parsing is genuinely local. The equivalent logic was verified
      // correct in plain node across Europe/London, UTC, America/New_York
      // and Australia/Sydney. A local hour is offset-aware for free, so
      // there is nothing left here that a runner can contradict.
      const suffixed = "2026-07-15T12:00:00.000Z"; // 12:00 wall clock
      const bare = "2026-07-15T12:00"; // 12:00 wall clock, wrongly stored

      // The convention the app actually stores and reads: the wall clock
      // the user entered is what comes back out.
      expect(new Date(realTimestampFromStored(suffixed)).getHours()).toBe(12);

      // The bare form does NOT survive that on a device with a real offset -
      // measured, not asserted numerically: 11:00 in London BST, 16:00 in
      // New York, 02:00 in Sydney for the same "12:00" the user typed.
      // Skipped only where there is genuinely no offset to observe.
      if (Intl.DateTimeFormat().resolvedOptions().timeZone !== "UTC") {
        expect(new Date(realTimestampFromStored(bare)).getHours()).not.toBe(12);
      }

      expect(nowAsStoredDateTime().endsWith(":00.000Z")).toBe(true);
    });
  });

  // The bug above was not a flaw in dateInputHelpers - it was a caller
  // storing the wrong helper's output. Unit tests here can't see a module's
  // choice of helper, so guard the call pattern directly: the input-only
  // helper is ONLY ever correct when the caller appends the fake-UTC suffix
  // itself. Every current call site does exactly that, and any that stops
  // silently reintroduces a stored value that displays an hour off for half
  // the year on a BST/GMT device - the precise failure the owner reported.
  describe('stored datetime helper misuse across modules', () => {
    it('nowAsDateTimeLocalString() is never used without the fake-UTC suffix', () => {
      const fs = require("fs");
      const path = require("path");
      const srcDir = path.join(__dirname, "..", "modules");
      const offenders = [];
      for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith(".jsx") && !file.endsWith(".js")) continue;
        const full = path.join(srcDir, file);
        const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
        lines.forEach((line, i) => {
          if (!line.includes("nowAsDateTimeLocalString()")) return;
          if (line.includes(":00.000Z")) return; // correctly converted
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
          offenders.push(`${file}:${i + 1}`);
        });
      }
      expect(offenders).toEqual([]);
    });
  });
});
// ADDED 29 Sep 2026 (t020) - the calendar-day primitives, which exist because
// the same day-key logic had been written in THREE places in one day (twice by
// me, hours apart, while fixing the same bug class). These are the tests that
// make the third copy unnecessary.
//
// Fixtures are built from LOCAL date components, not UTC strings, so that "the
// local day is X" is true in every timezone. A version of this file asserted
// that noon UTC is the same day everywhere, which is false and which
// Pacific/Chatham (+12:45) proved.
describe('calendar-day primitives', () => {
  describe('storedDayKey', () => {
    it('reads the day the user typed, in every timezone', () => {
      // A stored "2026-09-01" is UTC midnight, which is 31 August in the west.
      // The key must be the digits, never the shifted day.
      expect(storedDayKey('2026-09-01')).toBe('2026-09-01');
      expect(storedDayKey('2026-09-01T14:30:00.000Z')).toBe('2026-09-01');
    });

    it('refuses anything that is not a usable date', () => {
      // null rather than a bogus key, so a caller cannot turn "no data" into a
      // NaN that later compares false against everything and looks like a
      // deliberate answer.
      expect(storedDayKey(null)).toBeNull();
      expect(storedDayKey('')).toBeNull();
      expect(storedDayKey('nonsense')).toBeNull();
      expect(storedDayKey('2026/09/01')).toBeNull();
      expect(storedDayKey(12345)).toBeNull();
    });
  });

  describe('localDayKey', () => {
    it('is the device"s own day', () => {
      expect(localDayKey(new Date(2026, 8, 1, 0, 30, 0))).toBe('2026-09-01');
      expect(localDayKey(new Date(2026, 8, 1, 23, 59, 0))).toBe('2026-09-01');
      expect(localDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('calendarDaysBetween', () => {
    it('counts whole days, not elapsed hours', () => {
      expect(calendarDaysBetween('2026-09-01', '2026-09-04')).toBe(3);
      expect(calendarDaysBetween('2026-09-04', '2026-09-01')).toBe(-3);
    });

    it('is exact across a month and a year boundary', () => {
      expect(calendarDaysBetween('2026-08-31', '2026-09-01')).toBe(1);
      expect(calendarDaysBetween('2026-12-31', '2027-01-01')).toBe(1);
      expect(calendarDaysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
      expect(calendarDaysBetween('2026-02-28', '2026-03-01')).toBe(1);
    });

    it('crossing a DST boundary still counts calendar days', () => {
      // This is the whole point. An elapsed-milliseconds divide is an hour short
      // across a DST change, and Math.floor turns that into a whole day lost -
      // the bug that made a fully-dosed month read 97%.
      expect(calendarDaysBetween('2026-03-28', '2026-03-30')).toBe(2);
      expect(calendarDaysBetween('2026-10-31', '2026-11-02')).toBe(2);
    });

    it('returns null rather than guessing on bad input', () => {
      expect(calendarDaysBetween(null, '2026-09-01')).toBeNull();
      expect(calendarDaysBetween('2026-09-01', null)).toBeNull();
      expect(calendarDaysBetween('nope', '2026-09-01')).toBeNull();
    });
  });

  describe('daysSinceStoredDay', () => {
    it('the day itself is 0 days ago, not 1', () => {
      expect(daysSinceStoredDay('2026-09-01', new Date(2026, 8, 1, 23, 0, 0))).toBe(0);
    });

    it('counts in the user"s own days, which is what a person means', () => {
      // THE CASE THAT WAS WRONG. A test logged at 23:00 on 25 Sep, read 8 days
      // later at 09:00 on 3 Oct, is EIGHT days in the user's frame. Dividing
      // elapsed milliseconds between a real instant and the stored wall-clock
      // gave 7 in any zone behind UTC, and that figure decides a clinical
      // "still within the BASHH testing interval" verdict.
      expect(daysSinceStoredDay('2026-09-25T23:00:00.000Z', new Date(2026, 9, 3, 9, 0, 0))).toBe(8);
    });

    it('agrees with a plain count on a mid-morning record', () => {
      expect(daysSinceStoredDay('2026-09-01T09:30:00.000Z', new Date(2026, 8, 4, 9, 30, 0))).toBe(3);
    });

    it('is null with no date, never a number that compares as "recent"', () => {
      expect(daysSinceStoredDay(null, new Date(2026, 8, 1))).toBeNull();
      expect(daysSinceStoredDay('', new Date(2026, 8, 1))).toBeNull();
    });
  });
});
