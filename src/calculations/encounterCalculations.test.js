import { describe, expect, it } from "vitest";
import { contactEncounterSummaries, contactEncounterSummary } from "./encounterCalculations.js";

const encounters = [
  { id: "e1", attendeeIds: ["c1"], date: "2026-01-02T10:00:00.000Z", enjoymentRating: 40 },
  { id: "e2", attendeeIds: ["c1"], date: "2026-01-01T10:00:00.000Z", enjoymentRating: null },
  { id: "e3", attendeeIds: ["c1"], date: "2026-01-03T10:00:00.000Z", enjoymentRating: 80 },
  { id: "e4", attendeeIds: ["c1"], date: "2026-01-04T10:00:00.000Z", enjoymentRating: 100, isArchived: true },
];

describe("contact encounter summary card ratings", () => {
  it("counts rated encounters and selects the earliest rated score", () => {
    expect(contactEncounterSummary(encounters, "c1")).toMatchObject({
      count: 3,
      ratedCount: 2,
      firstRatedEnjoyment: 40,
      averageEnjoyment: 60,
    });
  });

  it("keeps the list precomputation in parity with the single-contact summary", () => {
    const summary = contactEncounterSummaries(encounters).get("c1");
    expect(summary).toMatchObject(contactEncounterSummary(encounters, "c1"));
  });
});
