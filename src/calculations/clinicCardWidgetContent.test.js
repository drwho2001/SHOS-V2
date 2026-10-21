// clinicCardWidgetContent.test.js
//
// ADDED 21 Oct 2026 - the pieces of the Clinic Card widget's text that are
// decided on the JS side.
//
// THE OWNER'S ASK: "the widget should launch maps if clinic location on
// widget is clicked, else opens the appointment info. but ideally includes
// postcode, address/#" - and the app had nowhere to put a postcode at all. A
// clinic visit now LINKS to a Locations record, and the widget shows the
// place's name and postcode, with the full address going to the Maps link.
//
// These three are PURE and exported, so they can be tested without a
// repository and without a device: the rules worth pinning down are the
// FALLBACKS - a visit with no linked place keeps its own free text, a linked
// id with no matching record does not blank the card - and those are exactly
// the parts a copy of the logic in a test file would get wrong.
//
// The clock: "12h time 4.00pm not 16:00". `toLocaleTimeString` follows the
// DEVICE locale, and this phone is 24-hour, so the card said 16:00 while the
// Next Dose card said 4:00am. formatClock12 is the shared form, and it has
// to match the Android side exactly - lower case, no space, no leading zero
// on the hour.

import { describe, it, expect } from "vitest";
import { placeForVisit, testNamesForVisit } from "./clinicVisitReminderSync.js";
import { formatClock12 } from "./dateInputHelpers.js";

const clinic = { id: "loc_1", name: "Conifer", address: "56 Dean Street", postcode: "HU1 1AA" };

describe("the clinic's place on the widget", () => {
  it("uses the linked Locations record", () => {
    const place = placeForVisit({ location: "Conifer", locationId: "loc_1" }, [clinic]);
    expect(place).toEqual({ name: "Conifer", address: "56 Dean Street", postcode: "HU1 1AA" });
  });

  it("falls back to the visit's own free text when there is no link", () => {
    // Every visit stored before the link existed has only this, and the card
    // must keep working for them.
    const place = placeForVisit({ location: "Conifer" }, [clinic]);
    expect(place).toEqual({ name: "Conifer", address: "", postcode: "" });
  });

  it("falls back when the linked record is gone", () => {
    // A place can be deleted from the registry while a visit still points at
    // it. The card shows the visit's own name rather than going blank.
    const place = placeForVisit({ location: "Conifer", locationId: "loc_gone" }, [clinic]);
    expect(place).toEqual({ name: "Conifer", address: "", postcode: "" });
  });

  it("prefers the linked record's name over the visit's free text", () => {
    // The visit's text is a snapshot of what was typed; the record is the
    // thing the user edits in Settings.
    const place = placeForVisit({ location: "Conifer Clinic", locationId: "loc_1" }, [clinic]);
    expect(place.name).toBe("Conifer");
  });
});

describe("the tests on the widget", () => {
  it("names the linked tests rather than counting them", () => {
    const tests = [
      { id: "t1", title: "HIV" },
      { id: "t2", title: "Syphilis" },
    ];
    expect(testNamesForVisit({ linkedTestIds: ["t1", "t2"] }, tests)).toBe("HIV, Syphilis");
  });

  it("skips a linked test that no longer exists", () => {
    expect(testNamesForVisit({ linkedTestIds: ["t_gone", "t1"] }, [{ id: "t1", title: "HIV" }])).toBe("HIV");
  });

  it("is empty when there are none", () => {
    expect(testNamesForVisit({}, [])).toBe("");
    expect(testNamesForVisit(undefined, [])).toBe("");
  });
});

describe("the twelve-hour clock", () => {
  it("reads the afternoon in the form the Next Dose card uses", () => {
    expect(formatClock12(new Date(2026, 9, 21, 16, 0))).toBe("4:00pm");
  });

  it("reads the morning", () => {
    expect(formatClock12(new Date(2026, 9, 21, 4, 0))).toBe("4:00am");
  });

  it("reads midnight and noon as twelve", () => {
    expect(formatClock12(new Date(2026, 9, 21, 0, 5))).toBe("12:05am");
    expect(formatClock12(new Date(2026, 9, 21, 12, 5))).toBe("12:05pm");
  });

  it("keeps the minutes padded and the suffix lower case", () => {
    // The Android side formats with SimpleDateFormat("h:mm", Locale.US) and
    // lower-cases the suffix, so the two cards read alike.
    expect(formatClock12(new Date(2026, 9, 21, 9, 5))).toBe("9:05am");
  });

  it("is empty for nothing", () => {
    expect(formatClock12(null)).toBe("");
    expect(formatClock12(undefined)).toBe("");
    expect(formatClock12(new Date("nonsense"))).toBe("");
  });
});
