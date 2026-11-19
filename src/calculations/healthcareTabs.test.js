import { describe, it, expect } from "vitest";
import { resolveVisibleTabs, wouldWrap, HEALTHCARE_VISIBLE_MAX, DEFAULT_VISIBLE_TABS, HEALTHCARE_TAB_KEYS } from "./healthcareTabs.js";

describe("healthcare visible tabs", () => {
  it("defaults to the three core tabs when unset or corrupt", () => {
    expect(resolveVisibleTabs(null)).toEqual(DEFAULT_VISIBLE_TABS);
    expect(resolveVisibleTabs("nonsense")).toEqual(DEFAULT_VISIBLE_TABS);
    expect(resolveVisibleTabs([])).toEqual(DEFAULT_VISIBLE_TABS);
  });

  it("drops unknown keys, dedupes and keeps canonical order", () => {
    const r = resolveVisibleTabs(["measurements", "fake", "testing", "measurements"]);
    expect(r).toEqual(["testing", "measurements"]);
  });

  it("never returns more than the one-line cap", () => {
    const r = resolveVisibleTabs(HEALTHCARE_TAB_KEYS);
    expect(r.length).toBeLessThanOrEqual(HEALTHCARE_VISIBLE_MAX);
    expect(HEALTHCARE_VISIBLE_MAX).toBe(3);
  });

  it("respects which tabs are actually available (e.g. reproductive health off)", () => {
    const r = resolveVisibleTabs(["menstrualHealth", "testing"], HEALTHCARE_TAB_KEYS.filter((k) => k !== "menstrualHealth"));
    expect(r).toEqual(["testing"]);
  });

  it("wouldWrap flags a past-cap selection", () => {
    expect(wouldWrap(["a", "b", "c"])).toBe(false);
    expect(wouldWrap(["a", "b", "c", "d"])).toBe(true);
  });
});
