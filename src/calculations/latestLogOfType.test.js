import { describe, it, expect } from "vitest";
import { latestLogOfType } from "./medicationCalculations";

// Companion to the t053 finding that produced this function: "the most recent
// non-voided log of type X" existed inline seven times across two calculation
// files and three module files. All seven were logically identical, so this was a
// latent split-brain rather than a live bug - they agreed by coincidence, not by
// construction.
//
// The voided filter is the load-bearing rule. A voided dose is one the user
// explicitly marked as NOT taken, so including it would report a dose as taken
// that was not - and one of the seven sites feeds a 72-hour DoxyPEP
// post-exposure deadline.

const at = (y, m, d, h = 9) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00.000Z`;

const med = (logs) => ({ id: "med_1", logs });

describe("latestLogOfType", () => {
  it("returns the newest matching log", () => {
    const logs = [
      { type: "dose", date: at(2026, 3, 1), voided: false },
      { type: "refill", date: at(2026, 3, 20), voided: false },
      { type: "dose", date: at(2026, 3, 10), voided: false },
    ];
    expect(latestLogOfType(med(logs), "dose").date).toBe(at(2026, 3, 10));
    expect(latestLogOfType(med(logs), "refill").date).toBe(at(2026, 3, 20));
  });

  it("ignores a voided log even when it is the newest", () => {
    // The safety-relevant case. A dose the user voided is one they marked as not
    // taken, so a newer voided entry must not win.
    const logs = [
      { type: "dose", date: at(2026, 3, 1), voided: false },
      { type: "dose", date: at(2026, 3, 12), voided: true },
    ];
    expect(latestLogOfType(med(logs), "dose").date).toBe(at(2026, 3, 1));
  });

  it("ignores logs of another type", () => {
    const logs = [
      { type: "dose", date: at(2026, 3, 1), voided: false },
      { type: "waste", date: at(2026, 3, 15), voided: false },
    ];
    expect(latestLogOfType(med(logs), "dose").date).toBe(at(2026, 3, 1));
  });

  it("on equal timestamps keeps the first, matching a stable sort", () => {
    // The originals used `.sort(desc)[0]`, and Array.prototype.sort is stable, so
    // a tie resolved to the FIRST such log in array order. A naive `>=` in a
    // linear scan would have silently changed which one is returned. Both are
    // defensible; changing it quietly is not.
    const first = { type: "dose", date: at(2026, 3, 5), voided: false, note: "first" };
    const second = { type: "dose", date: at(2026, 3, 5), voided: false, note: "second" };
    expect(latestLogOfType(med([first, second]), "dose").note).toBe("first");
    expect(latestLogOfType(med([second, first]), "dose").note).toBe("second");
  });

  it("returns undefined for no match, missing logs, or malformed elements", () => {
    expect(latestLogOfType(med([]), "dose")).toBeUndefined();
    expect(latestLogOfType({ id: "x" }, "dose")).toBeUndefined();
    expect(latestLogOfType(null, "dose")).toBeUndefined();
    // The originals would have thrown "Cannot read properties of null" here,
    // since they did `l.type` on every element. Backup import already filters
    // non-record elements, so this is defence rather than a live fix - but a
    // throw inside a reminder scheduler is not a good failure mode.
    expect(latestLogOfType(med([null, { type: "dose", date: at(2026, 3, 2) }]), "dose").date).toBe(
      at(2026, 3, 2)
    );
  });

  it("does not mutate the caller's array", () => {
    // Two of the originals spread defensively before sorting, which implies the
    // risk was believed real. filter() already copies, but this pins it anyway:
    // a medication's log order is persisted state, not a scratch buffer.
    const logs = [
      { type: "dose", date: at(2026, 3, 1), voided: false },
      { type: "dose", date: at(2026, 3, 9), voided: false },
    ];
    const order = logs.map((l) => l.date);
    latestLogOfType(med(logs), "dose");
    expect(logs.map((l) => l.date)).toEqual(order);
  });
});