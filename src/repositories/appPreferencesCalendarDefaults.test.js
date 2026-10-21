// The calendar sync families are OPT-IN, and this file is the guard that
// keeps them that way.
//
// WHY IT IS WORTH A FILE OF ITS OWN. Every privacy-adjacent feature in
// this app is off by default, and the calendar is where that matters most:
// a synced event can surface on a lock screen, in a synced calendar's own
// smart-features summary, or in a calendar that the user has shared with
// someone. There are now three families on that surface - the
// appointments, the vaccination doses and the planned events - and each one
// got its own switch when it was added. A fourth family added later would
// be just as easy to leave on.
//
// So the assertion is on the SHAPE, not on three named keys: every BOOLEAN
// "calendarSync" preference in the defaults has to be off. A new family
// that ships switched on fails here, whatever it is called. (The
// target-calendar name is not a switch - it is null until the user picks
// one - so the assertion is on the booleans.)
import { describe, it, expect } from "vitest";
import { DEFAULT_APP_PREFERENCES } from "./appPreferencesRepository";

describe("the calendar sync preferences", () => {
  it("every switch among them is off by default", () => {
    const switches = Object.keys(DEFAULT_APP_PREFERENCES).filter(
      (k) => k.startsWith("calendarSync") && typeof DEFAULT_APP_PREFERENCES[k] === "boolean"
    );
    // Anti-vacuity: a filter that matched nothing would pass trivially.
    expect(switches.length).toBeGreaterThan(2);
    switches.forEach((key) => {
      expect(`${key}=${DEFAULT_APP_PREFERENCES[key]}`).toBe(`${key}=false`);
    });
  });

  it("the planned family has its OWN switch, and it is off", () => {
    // Turning on "sync my appointments" must not start putting a test date
    // or a vaccine name on the phone's calendar, and the planned family is
    // no exception: it is health data with a date on it. (That the three
    // switches are genuinely INDEPENDENT - that turning the doses on does
    // not write a plan, and turning the plans on does not write a dose - is
    // asserted against the service itself, in calendarSyncPlanned.test.js.)
    expect(DEFAULT_APP_PREFERENCES).toHaveProperty("calendarSyncPlanned", false);
  });
});
