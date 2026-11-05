import { describe, it, expect, vi } from "vitest";

// B7 migration at the repository boundary.
//
// The pure normaliser is covered in calculations/testingSettings.test.js. This
// file exists because a correct function that nothing calls is the exact
// failure this repo has shipped before: the migration has to happen when
// records are LOADED from storage, not only when a new one is written.
const mockStore = new Map();

vi.mock("../storage/storageAdapter", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => {
      mockStore.set(key, value);
      return true;
    }),
  },
}));

const STORAGE_KEY = "shos_tests";

// Deliberately seeded BEFORE the module is imported, so the first getAll()
// exercises ensureLoaded()'s migration path rather than replaceAll().
mockStore.set(STORAGE_KEY, [
  { id: "test_001", setting: "🏠 Home" },
  { id: "test_002", setting: "🏥😎 Clinic - Routine" },
  { id: "test_003", setting: "🏥🤢 Clinic - Symptomatic" },
  { id: "test_004", setting: "home" },
  { id: "test_005", setting: "" },
]);

const { TestingRepository } = await import("./testingRepository.js");

describe("TestingRepository Setting migration", () => {
  it("converts legacy display strings to stable keys on load", async () => {
    const tests = await TestingRepository.getAll();
    const byId = Object.fromEntries(tests.map((t) => [t.id, t.setting]));

    expect(byId.test_001).toBe("home");
    expect(byId.test_002).toBe("clinicRoutine");
    expect(byId.test_003).toBe("clinicSymptomatic");
    // Already-migrated and empty values are left alone.
    expect(byId.test_004).toBe("home");
    expect(byId.test_005).toBe("");
  });

  it("persists the migrated values once, without stamping the records as edited", async () => {
    const stored = mockStore.get(STORAGE_KEY);
    const byId = Object.fromEntries(stored.map((t) => [t.id, t.setting]));

    expect(byId.test_001).toBe("home");
    expect(byId.test_002).toBe("clinicRoutine");
    // Migration is not an edit: isSeed/isDemo must not be stamped here, or
    // clearSampleData would stop recognising untouched demo records.
    for (const record of stored) {
      expect(record.isSeed).toBeUndefined();
      expect(record.isDemo).toBeUndefined();
    }
  });

  it("normalises a legacy value written through create()", async () => {
    const created = await TestingRepository.create({ title: "Legacy write", setting: "🏠 Home" });
    expect(created.setting).toBe("home");
  });

  it("normalises a legacy value written through update()", async () => {
    const updated = await TestingRepository.update("test_002", { setting: "🏥➕ Clinic - Positive test" });
    expect(updated.setting).toBe("clinicPositive");
  });
});
