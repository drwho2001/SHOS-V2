// R5 (18 Nov 2026) — hCG sample type + optional quantitative serum value.
// Owner's rule: urine is the DEFAULT (a home pregnancy test is qualitative
// urine), blood is the optional quantitative lab test — NOT blood-only.
// Additive fields must round-trip through backup and stay backward-compatible
// with records written before they existed.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();

vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.stringify(value)); return true; }),
  },
}));

const { PregnancyRepository, DEFAULT_PREGNANCY, SAMPLE_TYPE_OPTIONS, HCG_UNIT } = await import("./pregnancyRepository.js");
const STORAGE_KEY = "shos_pregnancies";

describe("pregnancy hCG fields", () => {
  beforeEach(async () => {
    mockStore.clear();
    mockStore.set(STORAGE_KEY, []);
    await PregnancyRepository.replaceAll([]);
  });

  it("defaults to urine, with no serum value and no brand", () => {
    expect(DEFAULT_PREGNANCY.sampleType).toBe("Urine");
    expect(DEFAULT_PREGNANCY.hcgValue).toBeNull();
    expect(DEFAULT_PREGNANCY.brand).toBe("");
    expect(SAMPLE_TYPE_OPTIONS).toEqual(["Urine", "Blood"]);
    expect(HCG_UNIT).toBe("mIU/mL");
  });

  it("a urine test never carries a serum value even if one is passed in", async () => {
    const entry = await PregnancyRepository.create({ testDate: "2026-11-17", testResult: "Negative", sampleType: "Urine", hcgValue: 550, brand: "Clearblue" });
    expect(entry.sampleType).toBe("Urine");
    expect(entry.hcgValue).toBeNull();
    expect(entry.brand).toBe("Clearblue");
  });

  it("a blood test keeps its quantitative serum value and brand", async () => {
    const entry = await PregnancyRepository.create({ testDate: "2026-11-17", testResult: "Positive", sampleType: "Blood", hcgValue: 1250, brand: "Lab" });
    expect(entry.sampleType).toBe("Blood");
    expect(entry.hcgValue).toBe(1250);
  });

  it("switching a record back to urine clears the stale serum value", async () => {
    const entry = await PregnancyRepository.create({ testDate: "2026-11-17", testResult: "Positive", sampleType: "Blood", hcgValue: 1250 });
    const updated = await PregnancyRepository.update(entry.id, { sampleType: "Urine" });
    expect(updated.sampleType).toBe("Urine");
    expect(updated.hcgValue).toBeNull();
  });

  it("legacy records written before these fields read as plain urine tests", async () => {
    // Simulate a backup from an older version: no sampleType/hcgValue/brand.
    // replaceAll writes the raw shape (as a restore would); getAll merges
    // DEFAULT_PREGNANCY on read, which is exactly the backward-compat path.
    await PregnancyRepository.replaceAll([{ id: "legacy_1", testDate: "2026-01-01", testResult: "Negative", createdAt: "2026-01-01T00:00:00.000Z" }]);
    const all = await PregnancyRepository.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].sampleType).toBe("Urine");
    expect(all[0].hcgValue).toBeNull();
    expect(all[0].brand).toBe("");
  });

  it("survives a backup-style replaceAll round-trip", async () => {
    await PregnancyRepository.create({ testDate: "2026-11-17", testResult: "Positive", sampleType: "Blood", hcgValue: 990, brand: "Lab" });
    const exported = await PregnancyRepository.getAll();
    await PregnancyRepository.replaceAll(JSON.parse(JSON.stringify(exported)));
    const imported = (await PregnancyRepository.getAll())[0];
    expect(imported.sampleType).toBe("Blood");
    expect(imported.hcgValue).toBe(990);
    expect(imported.brand).toBe("Lab");
  });
});
