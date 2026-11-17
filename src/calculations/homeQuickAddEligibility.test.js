// homeQuickAddEligibility.test.js — decision tests for Home's dose shortcuts.
// The Medication Dashboard's own lockout decisions are already tested in
// medicationLockout.test.js; these prove Home REACHES them (the old Home
// buttons bypassed them entirely) and that the ghosting/due list agree.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isQuickActionLocked, quickActionLockoutMessage, dueRoutineMedications } from "./homeQuickAddEligibility";

const NOW = new Date(2026, 10, 17, 12, 0, 0).getTime();
// The app stores "fake UTC": local wall-clock digits with a trailing Z.
// Building a real ISO instant here would shift with the machine timezone and
// silently make every lockout assertion wrong (see medicationLockout.test.js).
const storedLocal = (d) => {
  const p = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00.000Z`;
};
const hoursAgo = (h) => storedLocal(new Date(NOW - h * 3600000));
const DAILY = { id: "m1", name: "PrEP", usagePattern: "daily", dosesPerDay: 1, unitsPerDose: 1 };
const TWICE = { id: "m2", name: "Zapain", usagePattern: "daily", dosesPerDay: 2, unitsPerDose: 1 };
const PRN = { id: "m3", name: "Painkillers", usagePattern: "prn" };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

describe("isQuickActionLocked", () => {
  it("is false with no dose at all and null-safe with no medication", () => {
    expect(isQuickActionLocked(DAILY, [])).toBe(false);
    expect(isQuickActionLocked(null, [])).toBe(false);
  });

  it("uses the SAME rule as the Medication Dashboard", () => {
    expect(isQuickActionLocked(DAILY, [{ type: "dose", date: hoursAgo(1) }])).toBe(true);
    expect(isQuickActionLocked(DAILY, [{ type: "dose", date: hoursAgo(20) }])).toBe(false);
    // Twice-daily has a shorter interval, so the same 6h-old dose locks it.
    expect(isQuickActionLocked(TWICE, [{ type: "dose", date: hoursAgo(4) }])).toBe(true);
    expect(isQuickActionLocked(TWICE, [{ type: "dose", date: hoursAgo(20) }])).toBe(false);
  });

  it("ignores voided entries and non-dose logs", () => {
    const logs = [
      { type: "dose", date: hoursAgo(1), voided: true },
      { type: "refill", date: hoursAgo(1) },
    ];
    expect(isQuickActionLocked(DAILY, logs)).toBe(false);
  });
});

describe("quickActionLockoutMessage", () => {
  it("names the medication, the remaining lockout and the tap-again override", () => {
    const msg = quickActionLockoutMessage(DAILY, [{ type: "dose", date: hoursAgo(1) }]);
    expect(msg).toContain("PrEP");
    expect(msg).toMatch(/locked out for another ~/);
    expect(msg).toContain("Tap again");
  });

  it("does not claim a remaining time when the lockout has just expired", () => {
    expect(quickActionLockoutMessage(DAILY, [])).not.toContain("locked out");
  });
});

describe("dueRoutineMedications", () => {
  it("includes un-dosed daily meds, excludes archived/non-daily/locked-out", () => {
    const meds = [
      DAILY,
      TWICE,
      PRN,
      { ...DAILY, id: "m4", name: "Archived", isArchived: true },
    ];
    const logsByMed = {
      m1: [],
      m2: [{ type: "dose", date: hoursAgo(4) }],
    };
    const due = dueRoutineMedications(meds, logsByMed);
    expect(due.map((m) => m.id)).toEqual(["m1"]);
  });
});
