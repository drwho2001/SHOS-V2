// F4 (18 Nov) — cycle-stat copy: no alarm for a short history, no "irregular"
// label on 2 cycles, and honest hormonal-contraception context instead.
import { describe, it, expect } from "vitest";
import { cycleVariabilityAdvisory, hormonalContextNote, MIN_CYCLES_FOR_VARIABILITY } from "./cycleStatContext.js";

describe("cycle variability advisory", () => {
  it("does not show with no data or under 3 cycles", () => {
    expect(cycleVariabilityAdvisory(null).show).toBe(false);
    // 2 cycles = 1 gap: a range cannot establish irregularity.
    expect(cycleVariabilityAdvisory({ min: 22, max: 45, count: 1 }).show).toBe(false);
    expect(MIN_CYCLES_FOR_VARIABILITY).toBe(3);
  });

  it("stays quiet when the spread is small, even with a long history", () => {
    expect(cycleVariabilityAdvisory({ min: 27, max: 33, count: 8 }).show).toBe(false);
  });

  it("never uses the word 'irregular' when it does speak", () => {
    const a = cycleVariabilityAdvisory({ min: 21, max: 40, count: 5 });
    expect(a.show).toBe(true);
    expect(a.text.toLowerCase()).not.toContain("irregular");
    expect(a.text).toContain("21 to 40 days");
    expect(a.text).toMatch(/mentioning to a clinician/);
  });

  it("softens to an expected-change note during hormonal settling-in", () => {
    const a = cycleVariabilityAdvisory(
      { min: 21, max: 40, count: 5 },
      { methodName: "Depot", settlingIn: true }
    );
    expect(a.tone).toBe("context");
    expect(a.text).toContain("Depot");
    expect(a.text).toMatch(/first 3 months/);
    expect(a.text.toLowerCase()).not.toContain("irregular");
  });
});

describe("hormonal context note", () => {
  it("is empty without an active method", () => {
    expect(hormonalContextNote({ active: false })).toBe("");
  });

  it("is neutral, names the method, and never interprets the numbers", () => {
    const n = hormonalContextNote({ active: true, methodName: "Combined pill" });
    expect(n).toContain("Combined pill");
    expect(n.toLowerCase()).not.toContain("irregular");
    expect(n).toMatch(/worth mentioning to a clinician/);
  });
});
