import { describe, it, expect, vi } from "vitest";

// Storage mock: only used by hasDemoSnapshot/describeDemoSnapshot.
const store = new Map();
vi.mock("../storage/storageAdapter.js", () => ({
  localStorageAdapter: {
    load: async (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    save: async (key, value) => { store.set(key, value); return true; },
  },
}));

import { missingById, hasDemoSnapshot, describeDemoSnapshot } from "./demoRestore.js";

describe("missingById — the never-overwrite merge rule", () => {
  it("adds only ids that are absent", () => {
    const existing = [{ id: "a" }, { id: "b" }];
    const photo = [{ id: "b" }, { id: "c" }];
    expect(missingById(existing, photo)).toEqual([{ id: "c" }]);
  });
  it("never overwrites a record created after the clear", () => {
    const existing = [{ id: "contact_001", name: "Real replacement" }];
    const photo = [{ id: "contact_001", name: "Demo A" }, { id: "med_001", name: "PrEP" }];
    expect(missingById(existing, photo)).toEqual([{ id: "med_001", name: "PrEP" }]);
  });
  it("skips malformed photographed records and handles nulls", () => {
    expect(missingById(null, [{ id: "x" }, null, {}, { name: "no id" }])).toEqual([{ id: "x" }]);
    expect(missingById([], null)).toEqual([]);
  });
  it("restores the exact photographed object (id + fields preserved)", () => {
    const record = { id: "med_001", name: "PrEP (Descovy)", isSeed: true, dosesPerDay: 1 };
    expect(missingById([], [record])[0]).toEqual(record);
  });
});

describe("snapshot presence helpers", () => {
  it("reports no snapshot when the key is empty", async () => {
    store.clear();
    expect(await hasDemoSnapshot()).toBe(false);
    expect(await describeDemoSnapshot()).toEqual({ total: 0, byCollection: [] });
  });
  it("reports counts from a stored snapshot without returning the records", async () => {
    store.clear();
    store.set("shos_demo_restore_snapshot_v1", {
      savedAt: "2026-11-17T00:00:00.000Z",
      collections: [
        { name: "Contacts", records: [{ id: "c1" }, { id: "c2" }] },
        { name: "Medications", records: [{ id: "m1" }] },
      ],
    });
    expect(await hasDemoSnapshot()).toBe(true);
    const d = await describeDemoSnapshot();
    expect(d.total).toBe(3);
    expect(d.byCollection).toEqual([
      { name: "Contacts", count: 2 },
      { name: "Medications", count: 1 },
    ]);
  });
});
