// simpleRegistry.test.js
//
// Guard for the one shared abstraction behind Kink/Chems/Protection/Symptoms/
// Organism/Results registries. Until now there was no behavioural test anywhere
// in the repo that an entry actually gets created, read back, updated, archived
// and cleared — only the factory's own comments claimed it worked.
//
// The mock pattern is the one already proven in clearSampleData.test.js: the
// real adapter needs an unlocked encryption vault, so without mocking, every
// assertion here would verify against module memory only. The in-memory map is
// reset between tests, and a fresh module registry (vi.resetModules()) is
// imported per test, so the factory's memoized cache never leaks between them.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockStore = new Map();

vi.mock("../storage/storageAdapter.js", () => ({
  localStorageAdapter: {
    load: vi.fn((key, fallback) => (mockStore.has(key) ? mockStore.get(key) : fallback)),
    save: vi.fn((key, value) => {
      mockStore.set(key, JSON.parse(JSON.stringify(value)));
      return true;
    }),
  },
}));

async function freshRegistry(seedNames = ["Condom", "PrEP", "PEP", "None"]) {
  vi.resetModules();
  const { createSimpleRegistry } = await import("./simpleRegistry.js");
  return createSimpleRegistry({ storageKey: "shos_smoke_test_registry", idPrefix: "smoke", seedNames });
}

beforeEach(() => mockStore.clear());

describe("createSimpleRegistry CRUD smoke", () => {
  it("seeds on first read and assigns sequential ids", async () => {
    const reg = await freshRegistry();
    const all = await reg.getAll();
    expect(all.map((e) => e.id)).toEqual(["smoke_001", "smoke_002", "smoke_003", "smoke_004"]);
    expect(all.map((e) => e.name)).toEqual(["Condom", "PrEP", "PEP", "None"]);
    expect(all.every((e) => e.isArchived === false)).toBe(true);
  });

  it("create() adds an entry with the next id and persists it", async () => {
    const reg = await freshRegistry();
    const created = await reg.create({ name: "Dental dam" });
    expect(created.id).toBe("smoke_005");
    expect(created.isArchived).toBe(false);

    // Reload — a fresh module proves it was persisted, not just cached.
    const reg2 = await freshRegistry(["Condom", "PrEP", "PEP", "None"]);
    const all = await reg2.getAll();
    expect(all.map((e) => e.name)).toContain("Dental dam");
    expect(all.find((e) => e.name === "Dental dam").id).toBe("smoke_005");
  });

  it("getById and getByName return records, and miss cleanly", async () => {
    const reg = await freshRegistry();
    const condom = await reg.getByName("condom"); // case-insensitive
    expect(condom.name).toBe("Condom");
    expect(await reg.getById(condom.id)).toMatchObject({ name: "Condom" });
    expect(await reg.getById("nope")).toBeNull();
    expect(await reg.getByName("nothing like this")).toBeNull();
  });

  it("update() / archive() / unarchive() round-trip", async () => {
    const reg = await freshRegistry();
    await reg.update("smoke_001", { name: "Condom (external)" });
    expect((await reg.getById("smoke_001")).name).toBe("Condom (external)");

    await reg.archive("smoke_002");
    expect((await reg.getById("smoke_002")).isArchived).toBe(true);
    await reg.unarchive("smoke_002");
    expect((await reg.getById("smoke_002")).isArchived).toBe(false);
  });

  it("findOrCreate() is idempotent and case-insensitive", async () => {
    const reg = await freshRegistry();
    const a = await reg.findOrCreate("PrEP");
    const b = await reg.findOrCreate("prep");
    expect(a.id).toBe(b.id);
    expect((await reg.getAll()).length).toBe(4); // no duplicate created

    const c = await reg.findOrCreate("Internal condom");
    expect(c.id).toBe("smoke_005");
    expect((await reg.getAll()).length).toBe(5);
  });

  it("findOrCreate() refuses blank input and returns null", async () => {
    const reg = await freshRegistry();
    expect(await reg.findOrCreate("")).toBeNull();
    expect(await reg.findOrCreate("   ")).toBeNull();
    expect((await reg.getAll()).length).toBe(4);
  });

  it("keeps next id correct when entries carry legacy or unrelated ids", async () => {
    mockStore.set("shos_smoke_test_registry", [
      { id: "legacy_contact_001", name: "Imported", createdAt: "2026-01-01T00:00:00.000Z", isArchived: false },
      { id: "smoke_007", name: "Imported high", createdAt: "2026-01-01T00:00:00.000Z", isArchived: false },
    ]);
    const reg = await freshRegistry();
    const created = await reg.create({ name: "Fresh" });
    expect(created.id).toBe("smoke_008"); // 007 + 1, not max(1)+seed count
  });

  it("replaceAll() swaps the list and persists it", async () => {
    const reg = await freshRegistry();
    await reg.replaceAll([{ id: "smoke_901", name: "Only this", createdAt: "2026-01-01T00:00:00.000Z", isArchived: true }]);
    const all = await reg.getAll();
    expect(all.map((e) => e.name)).toEqual(["Only this"]);
    expect(all[0].isArchived).toBe(true);

    // Reload — persisted, not just in memory.
    const reg2 = await freshRegistry();
    expect((await reg2.getAll()).map((e) => e.name)).toEqual(["Only this"]);
  });

  it("getAll() returns copies — mutating them does not corrupt the store", async () => {
    const reg = await freshRegistry();
    const all = await reg.getAll();
    all[0].name = "MUTATED";
    all[0].isArchived = true;
    const fresh = await reg.getAll();
    expect(fresh[0].name).toBe("Condom");
    expect(fresh[0].isArchived).toBe(false);
  });
});
