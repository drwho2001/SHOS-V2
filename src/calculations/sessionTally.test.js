import { describe, expect, it } from "vitest";
import { chronologicalSessionEncounters, sessionTally } from "./sessionTally.js";

describe("sessionTally", () => {
  it("derives people, kinks and loads while ignoring archived activities", () => {
    expect(sessionTally([
      { attendeeIds: ["a", "b"], kinksInvolved: [{ kinkId: "k1" }], loadsCount: 2, fistCount: 1 },
      { attendeeIds: ["b", "c"], kinksInvolved: [{ kinkId: "k2" }], loadsCount: 1, fistCount: 2 },
      { isArchived: true, attendeeIds: ["d"], kinksInvolved: [{ kinkId: "k3" }], loadsCount: 99, fistCount: 99 },
    ])).toEqual({ activityCount: 2, people: 3, kinks: 2, loads: 3, fists: 3 });
  });

  it("uses detailed fisting counts instead of adding them to legacy counters", () => {
    expect(sessionTally([
      { fistCount: 3, activityDetails: [{ kinkId: "fisting", count: 2 }] },
      { fistCount: 4, activityDetails: [{ kinkId: "other", count: 9 }] },
    ], { fistingKinkIds: ["fisting"] }).fists).toBe(2);
  });

  it("falls back to legacy fistCount when no fisting detail exists", () => {
    expect(sessionTally([{ fistCount: 3 }, { fistCount: 2 }], { fistingKinkIds: ["fisting"] }).fists).toBe(5);
  });

  it("orders live activities by stored wall-clock date", () => {
    expect(chronologicalSessionEncounters([
      { id: "late", date: "2026-10-28T02:00:00.000Z" },
      { id: "early", date: "2026-10-28T00:30:00.000Z" },
      { id: "archived", date: "2026-10-28T00:00:00.000Z", isArchived: true },
    ]).map((entry) => entry.id)).toEqual(["early", "late"]);
  });
});
