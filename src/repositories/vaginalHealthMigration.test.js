// R7/D1=B (18 Nov) — the Vaginal health tab is removed; existing REAL clinical
// records are copied once into Symptom Log and the old repository is kept as a
// read-only backup shim. This test locks the safety properties: lossless,
// idempotent, no fabricated clinical records, no deletion of the source.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();

vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.stringify(value)); return true; }),
  },
}));

const { VaginalHealthRepository } = await import("./vaginalHealthRepository.js");
const { SymptomLogRepository } = await import("./symptomLogRepository.js");
const { runVaginalHealthMigration, VAGINAL_HEALTH_MIGRATED_FLAG } = await import("./vaginalHealthMigration.js");

describe("vaginal health removal migration", () => {
  beforeEach(async () => {
    mockStore.clear();
    await VaginalHealthRepository.replaceAll([]);
    await SymptomLogRepository.replaceAll([]);
  });

  it("does nothing harmful on a fresh install (no records)", async () => {
    const result = await runVaginalHealthMigration();
    expect(result.migrated).toBe(0);
    expect(await SymptomLogRepository.getAll()).toEqual([]);
    // The adapter serialises on save; the migration only needs a truthy read.
    expect(Boolean(mockStore.get(VAGINAL_HEALTH_MIGRATED_FLAG))).toBe(true);
  });

  it("copies each record into Symptom Log, preserving every field verbatim", async () => {
    await VaginalHealthRepository.create({
      condition: "bv",
      date: "2026-11-10",
      treatment: "Metronidazole",
      outcome: "resolved",
      notes: "Discharge, treated at clinic.",
    });
    const result = await runVaginalHealthMigration();
    expect(result.migrated).toBe(1);

    const symptoms = await SymptomLogRepository.getAll();
    expect(symptoms).toHaveLength(1);
    expect(symptoms[0].title).toBe("bv");
    expect(symptoms[0].dateStarted).toBe("2026-11-10");
    expect(symptoms[0].notes).toContain("Discharge, treated at clinic.");
    expect(symptoms[0].notes).toContain("Treatment: Metronidazole");
    expect(symptoms[0].notes).toContain("Outcome: resolved");
    // No fabricated severity, test, medication or clinic visit.
    expect(symptoms[0].severity).toBe("");
    expect(symptoms[0].relatedTestIds).toEqual([]);
    expect(symptoms[0].relatedEncounterIds).toEqual([]);
  });

  it("keeps the source records — the read-only backup shim stays intact", async () => {
    await VaginalHealthRepository.create({ condition: "thrush", date: "2026-11-01", notes: "Itchy" });
    await runVaginalHealthMigration();
    expect(await VaginalHealthRepository.getAll()).toHaveLength(1);
  });

  it("is idempotent — a second run or a backup restore cannot duplicate", async () => {
    await VaginalHealthRepository.create({ condition: "bv", date: "2026-11-10", notes: "x" });
    await runVaginalHealthMigration();
    await runVaginalHealthMigration();
    expect(await SymptomLogRepository.getAll()).toHaveLength(1);
  });

  it("recovers from a partial failure without duplicating the record already copied", async () => {
    await SymptomLogRepository.create({ title: "bv", dateStarted: "2026-11-10", notes: "[migrated from vaginal health]\nOriginal record: vh_001" });
    await VaginalHealthRepository.replaceAll([{ id: "vh_001", condition: "bv", date: "2026-11-10", notes: "x" }]);
    await runVaginalHealthMigration();
    expect(await SymptomLogRepository.getAll()).toHaveLength(1);
  });
});
