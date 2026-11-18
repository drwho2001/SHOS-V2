// F2 (18 Nov) — Testing owns pregnancy tests. Migration must not lose history.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();
vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => { mockStore.set(key, JSON.stringify(value)); return true; }),
  },
}));

const { PregnancyRepository } = await import("./pregnancyRepository.js");
const { TestingRepository } = await import("./testingRepository.js");
const { runPregnancyTestOwnershipMigration, PREGNANCY_TEST_OWNERSHIP_FLAG } = await import("./pregnancyTestOwnershipMigration.js");

describe("pregnancy test ownership migration", () => {
  beforeEach(async () => {
    mockStore.clear();
    await PregnancyRepository.replaceAll([]);
    await TestingRepository.replaceAll([]);
  });

  it("is a no-op on a fresh install and sets the flag", async () => {
    const result = await runPregnancyTestOwnershipMigration();
    expect(result.migrated).toBe(0);
    expect(await TestingRepository.getAll()).toEqual([]);
    expect(Boolean(mockStore.get(PREGNANCY_TEST_OWNERSHIP_FLAG))).toBe(true);
  });

  it("creates a Testing record for each legacy pregnancy test and links it", async () => {
    await PregnancyRepository.create({ testDate: "2026-10-01", testResult: "Positive", sampleType: "Urine", brand: "Clearblue" });
    const result = await runPregnancyTestOwnershipMigration();
    expect(result.migrated).toBe(1);

    const tests = await TestingRepository.getAll();
    expect(tests).toHaveLength(1);
    expect(tests[0].testingFor).toContain("Pregnancy");
    expect(tests[0].date).toBe("2026-10-01");
    expect(tests[0].title).toBe("Pregnancy test");
    expect(tests[0].notes).toContain("Brand: Clearblue");

    const pregnancy = (await PregnancyRepository.getAll())[0];
    expect(pregnancy.testId).toBe(tests[0].id);
    // No history lost on the original record.
    expect(pregnancy.testDate).toBe("2026-10-01");
    expect(pregnancy.testResult).toBe("Positive");
  });

  it("is idempotent — a second run or a backup restore cannot duplicate", async () => {
    await PregnancyRepository.create({ testDate: "2026-10-01", testResult: "Negative" });
    await runPregnancyTestOwnershipMigration();
    await runPregnancyTestOwnershipMigration();
    expect(await TestingRepository.getAll()).toHaveLength(1);
  });

  it("links to an existing Testing record for the same date instead of creating one", async () => {
    const test = await TestingRepository.create({ title: "Home test", testingFor: ["Pregnancy"], date: "2026-10-01" });
    await PregnancyRepository.create({ testDate: "2026-10-01", testResult: "Positive" });
    await runPregnancyTestOwnershipMigration();
    expect(await TestingRepository.getAll()).toHaveLength(1);
    expect((await PregnancyRepository.getAll())[0].testId).toBe(test.id);
  });

  it("does not create a Test for pregnancy state with no legacy test date", async () => {
    await PregnancyRepository.create({ estimatedDueDate: "2027-01-01", status: "Ongoing" });
    await runPregnancyTestOwnershipMigration();
    expect(await TestingRepository.getAll()).toHaveLength(0);
  });
});
