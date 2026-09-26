import { describe, it, expect } from "vitest";
import { suggestedQuantity } from "./takeHomeQuantity.js";

// The owner's own example for wanting a unit switch: "if doxy course is less
// than full containers worth of pills." A 28-tablet pack is one container; a
// 14-day course is half of one, and no whole-container count expresses that.
const DAILY_28_PER_28 = {
  usagePattern: "daily",
  dosesPerDay: 1,
  unitsPerDose: 1,
  unitsPerContainer: 28,
};
const DAILY_2_PER_30 = {
  usagePattern: "daily",
  dosesPerDay: 2,
  unitsPerDose: 1,
  unitsPerContainer: 30,
};
const PRN_NO_PACK = { usagePattern: "prn", dosesPerDay: null, unitsPerDose: 2, unitsPerContainer: 0 };
const EVERY_14_DAYS = { usagePattern: "custom", dosesPerDay: 1, unitsPerDose: 1, scheduleIntervalDays: 14, unitsPerContainer: 10 };

describe("suggestedQuantity", () => {
  it("covers the requested window in units when asked for units", () => {
    // 1 tablet/day x 30 days = 30 tablets, not 2 containers of 28.
    expect(suggestedQuantity(DAILY_28_PER_28, "units")).toBe(30);
  });

  it("covers the same window in containers when asked for containers", () => {
    expect(suggestedQuantity(DAILY_28_PER_28, "containers")).toBeCloseTo(30 / 28, 2);
  });

  it("keeps a partial container rather than rounding it up to a whole one", () => {
    // The whole point of the unit switch. One tablet every 4 days over a
    // 30-day window is 7.5 tablets, which is 0.27 of a 28-tablet pack. An
    // earlier version clamped this to a 0.5 minimum, which is what a real
    // "less than full containers worth of pills" course would land below.
    expect(suggestedQuantity({ ...DAILY_28_PER_28, dosesPerDay: 0.25 }, "containers")).toBe(0.27);
    expect(suggestedQuantity({ ...DAILY_28_PER_28, dosesPerDay: 0.25 }, "units")).toBe(8);
  });

  it("handles multiple doses per day", () => {
    expect(suggestedQuantity(DAILY_2_PER_30, "units")).toBe(60);
  });

  it("uses defaultRefillQuantity when the user has stated one", () => {
    // Only meaningful in containers - a stated reorder quantity is a pack count.
    const med = { ...DAILY_28_PER_28, defaultRefillQuantity: 2 };
    expect(suggestedQuantity(med, "containers")).toBe(2);
  });

  it("ignores defaultRefillQuantity for a unit-based answer and derives instead", () => {
    const med = { ...DAILY_28_PER_28, defaultRefillQuantity: 2 };
    expect(suggestedQuantity(med, "units")).toBe(30);
  });

  it("averages out a custom every-N-days schedule", () => {
    // 1 tablet every 14 days over a 30-day window is ~2 tablets, not 30.
    expect(suggestedQuantity(EVERY_14_DAYS, "units")).toBe(2);
  });

  it("returns null rather than inventing a number when there is nothing to derive from", () => {
    // PRN has no schedule; an unknown pack size has no container answer.
    expect(suggestedQuantity(PRN_NO_PACK, "units")).toBeNull();
    expect(suggestedQuantity(PRN_NO_PACK, "containers")).toBeNull();
    expect(suggestedQuantity({ ...DAILY_28_PER_28, unitsPerContainer: 0 }, "containers")).toBeNull();
    expect(suggestedQuantity({ ...DAILY_28_PER_28, dosesPerDay: 0 }, "units")).toBeNull();
  });

  it("handles missing and malformed input without throwing", () => {
    expect(suggestedQuantity(null, "units")).toBeNull();
    expect(suggestedQuantity(undefined, "containers")).toBeNull();
    expect(suggestedQuantity({}, "units")).toBeNull();
  });
});
