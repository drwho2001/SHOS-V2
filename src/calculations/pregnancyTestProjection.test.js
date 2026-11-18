// F2 — Pregnancy is a read-only projection of the Testing-owned test.
import { describe, it, expect } from "vitest";
import { projectPregnancyTest, pregnancyTests } from "./pregnancyTestProjection.js";

describe("pregnancy test projection", () => {
  it("filters only pregnancy tests, newest first", () => {
    const list = pregnancyTests([
      { id: "a", testingFor: ["HIV"], date: "2026-11-01" },
      { id: "b", testingFor: ["Pregnancy"], date: "2026-10-01" },
      { id: "c", testingFor: ["Pregnancy"], date: "2026-10-20" },
    ]);
    expect(list.map((t) => t.id)).toEqual(["c", "b"]);
  });

  it("resolves the result name and keeps sample/serum facts", () => {
    const test = {
      id: "t1", title: "Pregnancy test", date: "2026-10-01",
      testingFor: ["Pregnancy"], sampleType: ["Blood"], resultIds: ["r1"],
      notes: "Brand: Clearblue\nSerum hCG 1250 mIU/mL",
    };
    const p = projectPregnancyTest(test, new Map([["r1", "Positive"]]));
    expect(p.resultLabel).toBe("Positive");
    expect(p.sampleLabel).toBe("Blood");
    expect(p.hcg).toContain("1250");
    expect(p.brand).toContain("Clearblue");
  });

  it("returns null with no test (no fake record)", () => {
    expect(projectPregnancyTest(null)).toBeNull();
  });
});
