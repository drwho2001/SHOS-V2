// Import v1 (18 Nov) — on-device CSV import of period data: SHOS round-trip and
// Clue-format CSV, explicit UK/US dates, preview before save, no overwrite.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();
vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.stringify(value)); return true; }),
  },
}));

const { parseCsv, importFormat, parseImportDate, buildPeriodImportPreview, savePeriodImport } = await import("./periodCsvImport.js");
const { MenstrualCycleRepository } = await import("../repositories/menstrualCycleRepository.js");

// Deliberately synthetic — no real person's cycle data in the repo.
const CLUE_SAMPLE = [
  "Cycle Start Date,Cycle End Date,Flow",
  "05/11/2026,10/11/2026,Medium",
  "03/12/2026,08/12/2026,Heavy",
].join("\n");

const SHOS_SAMPLE = [
  "id,startDate,endDate,flow,isArchived",
  "cycle_001,2026-11-05,2026-11-10,Medium,false",
  "cycle_002,2026-12-03,2026-12-08,Heavy,false",
].join("\n");

describe("period CSV import", () => {
  beforeEach(async () => {
    mockStore.clear();
    await MenstrualCycleRepository.replaceAll([]);
  });

  it("parses quoted cells with commas, doubled quotes and newlines", () => {
    const rows = parseCsv('a,b,c\n"x, y","he said ""hi""","line1\nline2"');
    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["x, y", 'he said "hi"', "line1\nline2"]);
  });

  it("detects SHOS and Clue formats, rejects unknown", () => {
    expect(importFormat(["id", "startDate", "endDate"])).toBe("shos");
    expect(importFormat(["Cycle Start Date", "Cycle End Date"])).toBe("clue");
    expect(importFormat(["name", "age"])).toBe("unknown");
  });

  it("reads ISO unambiguously, and UK/US differently for ambiguous dates", () => {
    expect(parseImportDate("2026-11-05", "UK")).toBe("2026-11-05");
    expect(parseImportDate("05/11/2026", "UK")).toBe("2026-11-05");
    expect(parseImportDate("05/11/2026", "US")).toBe("2026-05-11");
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(parseImportDate("31/02/2026", "UK")).toBeNull();
    expect(parseImportDate("13/13/2026", "US")).toBeNull();
    expect(parseImportDate("not a date", "UK")).toBeNull();
  });

  it("previews a Clue CSV with UK dates and preserves flow", () => {
    const p = buildPeriodImportPreview(CLUE_SAMPLE, "UK", []);
    expect(p.format).toBe("clue");
    expect(p.errors).toEqual([]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0]).toMatchObject({ startDate: "2026-11-05", endDate: "2026-11-10", flow: "Medium" });
    expect(p.rows[1].startDate).toBe("2026-12-03");
    expect(p.rows[0].notes).toContain("Clue");
  });

  it("round-trips SHOS's own CSV", () => {
    const p = buildPeriodImportPreview(SHOS_SAMPLE, "UK", []);
    expect(p.format).toBe("shos");
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0].startDate).toBe("2026-11-05");
    expect(p.rows[0].notes).toContain("SHOS");
  });

  it("dedupes against existing records and within the file, never overwriting", () => {
    const p = buildPeriodImportPreview(CLUE_SAMPLE, "UK", [{ startDate: "2026-11-05" }]);
    expect(p.rows).toHaveLength(1);
    expect(p.duplicates).toBe(1);
    const dupInFile = buildPeriodImportPreview(CLUE_SAMPLE + "\n05/11/2026,10/11/2026,Medium", "UK", []);
    expect(dupInFile.rows).toHaveLength(2);
    expect(dupInFile.duplicates).toBe(1);
  });

  it("reports unreadable rows rather than silently dropping them", () => {
    const p = buildPeriodImportPreview("Cycle Start Date,Cycle End Date\nnope,10/11/2026\n03/12/2026,02/12/2026", "UK", []);
    expect(p.rows).toHaveLength(0);
    expect(p.errors.length).toBe(2);
    expect(p.errors[0]).toMatch(/start date/);
    expect(p.errors[1]).toMatch(/before the start/);
  });

  it("writes only on explicit save, and only the previewed rows", async () => {
    const p = buildPeriodImportPreview(CLUE_SAMPLE, "UK", []);
    expect(await MenstrualCycleRepository.getAll()).toHaveLength(0); // preview wrote nothing
    const saved = await savePeriodImport(p.rows);
    expect(saved).toBe(2);
    expect(await MenstrualCycleRepository.getAll()).toHaveLength(2);
  });
});
