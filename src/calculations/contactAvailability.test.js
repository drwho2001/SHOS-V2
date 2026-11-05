import { describe, expect, it } from "vitest";
import {
  formatAvailabilitySummary,
  getContactTimeZone,
  hasWeeklyAvailability,
  isContactAvailableAt,
  isContactAvailableSoon,
  isValidAvailabilityWindow,
  isValidTimeZone,
  localDateTimeInputValue,
  parseAvailabilityTime,
} from "./contactAvailability.js";

const weekdayWindow = { days: [1, 2, 3, 4, 5], start: "18:00", end: "22:00" };

describe("contact weekly availability", () => {
  it("validates time windows and IANA timezones defensively", () => {
    expect(isValidAvailabilityWindow(weekdayWindow)).toBe(true);
    expect(isValidAvailabilityWindow({ days: [], start: "09:00", end: "10:00" })).toBe(false);
    expect(isValidAvailabilityWindow({ days: [1], start: "09:00", end: "09:00" })).toBe(false);
    expect(parseAvailabilityTime("23:59")).toBe(1439);
    expect(parseAvailabilityTime("24:00")).toBeNull();
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Not/A_Timezone")).toBe(false);
    expect(getContactTimeZone({ availabilityTimeZone: "Not/A_Timezone" })).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  });

  it("evaluates weekly windows using the contact's own timezone", () => {
    const contact = {
      availabilityTimeZone: "America/New_York",
      weeklyAvailability: [{ days: [0], start: "09:00", end: "11:00" }],
    };
    expect(isContactAvailableAt(contact, new Date("2026-06-07T13:00:00.000Z"))).toBe(true); // 09:00 EDT Sunday
    expect(isContactAvailableAt(contact, new Date("2026-06-07T15:00:00.000Z"))).toBe(false); // end is exclusive
    expect(isContactAvailableAt(contact, new Date("2026-06-08T13:00:00.000Z"))).toBe(false); // Monday
  });

  it("handles recurring windows that pass midnight", () => {
    const contact = {
      availabilityTimeZone: "Europe/London",
      weeklyAvailability: [{ days: [0], start: "22:00", end: "02:00" }],
    };
    expect(isContactAvailableAt(contact, new Date("2026-06-07T23:00:00.000Z"))).toBe(true);
    expect(isContactAvailableAt(contact, new Date("2026-06-08T00:30:00.000Z"))).toBe(true); // 01:30 BST Monday
    expect(isContactAvailableAt(contact, new Date("2026-06-08T01:00:00.000Z"))).toBe(false); // 02:00 BST end
  });

  it("lets the latest matching date exception override the weekly schedule", () => {
    const base = {
      availabilityTimeZone: "Europe/London",
      weeklyAvailability: [{ days: [0], start: "09:00", end: "17:00" }],
    };
    const instant = new Date("2026-06-07T08:45:00.000Z"); // 09:45 BST Sunday
    expect(isContactAvailableAt({ ...base, availabilityExceptions: [{ date: "2026-06-07", type: "Unavailable" }] }, instant)).toBe(false);
    expect(isContactAvailableAt({ ...base, availabilityExceptions: [{ date: "2026-06-07", type: "Available", start: "18:00", end: "20:00" }] }, instant)).toBe(true);
    expect(isContactAvailableAt({ ...base, availabilityExceptions: [
      { date: "2026-06-07", type: "Unavailable" },
      { date: "2026-06-07", type: "Available", start: "09:30", end: "10:30" },
    ] }, instant)).toBe(true);
  });

  it("includes a scheduled start in the next 24 hours but ignores one after the horizon", () => {
    const contact = {
      availabilityTimeZone: "UTC",
      weeklyAvailability: [{ days: [1], start: "18:00", end: "19:00" }], // Monday
    };
    expect(isContactAvailableSoon(contact, new Date("2026-06-08T17:59:00.000Z"), 2)).toBe(true);
    expect(isContactAvailableSoon(contact, new Date("2026-06-08T17:59:00.000Z"), 0)).toBe(false);
    expect(isContactAvailableSoon({ ...contact, weeklyAvailability: [] }, new Date("2026-06-08T17:59:00.000Z"))).toBe(false);
    expect(hasWeeklyAvailability(contact)).toBe(true);
  });

  it("formats a compact summary grouped by weekly windows", () => {
    expect(formatAvailabilitySummary({ weeklyAvailability: [
      weekdayWindow,
      { days: [6], start: "14:00", end: "16:00" },
    ] })).toBe("Usually Mon–Fri evenings · Sat afternoons");
    expect(formatAvailabilitySummary({ weeklyAvailability: [] })).toBe("");
  });

  it("formats datetime-local values in device-local wall time", () => {
    const date = new Date(2026, 5, 8, 9, 7);
    expect(localDateTimeInputValue(date)).toBe("2026-06-08T09:07");
  });
});
