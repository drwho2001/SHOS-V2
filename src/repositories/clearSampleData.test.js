// Coverage for clearSampleData.js and the SEED_*_IDS exports it depends on.
//
// The bug this guards against is not hypothetical and not subtle: a brand-new
// install loads ~93 fabricated records including a POSITIVE gonorrhoea result,
// with nothing in the UI disclosing it. And the naive fix - reusing
// "Reset all app data" - is actively wrong, because the moment a user creates
// their first record the sample data is persisted into the same array and
// "delete everything" would take their data with it.
//
// So the two things worth proving are:
//   1. it removes sample records and KEEPS real ones, mixed in the same array
//   2. the id sets cannot silently drift from the seed arrays they derive from
//
// (2) is the one a future edit to the sample data would break, and it would
// break it SILENTLY - a stale id set just means some sample records stop being
// removable, with no error anywhere. Hence the explicit assertion that the set
// size equals the array length.
//
// WHY EVERY TEST GETS FRESH MODULES: every repository holds its record list in
// a MODULE-LEVEL variable as well as in storage, and that cache survives both
// `mockStore.clear()` and any per-test setup. A first draft of this file ran
// `create()` expecting 16 sample contacts + 1 real one, got 1, and failed - not
// because the code was wrong but because an earlier test in the same file had
// already cleared the cache. So each test re-imports the repositories into a
// fresh module registry via vi.resetModules(). Without that, these tests would
// be order-dependent and would quietly stop testing anything after a reorder.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the storage adapter so the real repositories can load without an
// unlocked encryption vault. Same pattern as contactRepository.test.js: the
// real adapter logs "Vault is not unlocked" on every save and the assertions
// would then pass against module memory while verifying almost nothing.
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

/** Fresh repositories + a fresh cache, with the sample data present. */
async function freshApp() {
  vi.resetModules();
  const [contacts, encounters, testing, meds, logs, clear] = await Promise.all([
    import("./contactRepository"),
    import("./encounterRepository"),
    import("./testingRepository"),
    import("./medicationRepository"),
    import("./logRepository"),
    import("./clearSampleData"),
  ]);
  return { contacts, encounters, testing, meds, logs, clear };
}

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

describe("the exported seed id sets cannot drift from their seed arrays", () => {
  it("every set has exactly one id per seed record", async () => {
    const { contacts, encounters, testing, meds, logs } = await freshApp();
    const checks = [
      ["contacts", contacts.ContactRepository, contacts.SEED_CONTACT_IDS],
      ["encounters", encounters.EncounterRepository, encounters.SEED_ENCOUNTER_IDS],
      ["tests", testing.TestingRepository, testing.SEED_TEST_IDS],
      ["medications", meds.MedicationRepository, meds.SEED_MEDICATION_IDS],
      ["medication logs", logs.LogRepository, logs.SEED_MEDICATION_LOG_IDS],
    ];
    for (const [name, repo, ids] of checks) {
      const seeded = await repo.getAll();
      expect(ids.size, `${name}: id set size should match the seed count`).toBe(seeded.length);
      for (const r of seeded) {
        expect(ids.has(r.id), `${name}: ${r.id} missing from the id set`).toBe(true);
      }
    }
  });

  it("the set size equals the array length, so a count cannot be inflated", async () => {
    const { contacts } = await freshApp();
    const seeded = await contacts.ContactRepository.getAll();
    const uniqueIds = new Set(seeded.map((c) => c.id));
    expect(uniqueIds.size).toBe(seeded.length);
    expect(contacts.SEED_CONTACT_IDS.size).toBe(seeded.length);
  });
});

describe("countSampleData reports what a new user would be looking at", () => {
  it("counts the sample records on a fresh install", async () => {
    const { testing, clear } = await freshApp();
    const { total, byCollection } = await clear.countSampleData();
    expect(total).toBeGreaterThan(0);
    // A fresh install really does carry a positive STI result - the specific
    // reason this whole path exists.
    const tests = await testing.TestingRepository.getAll();
    const positive = tests.filter((t) => /positive/i.test(t.title || ""));
    expect(positive.length, "the sample data should include a positive result").toBeGreaterThan(0);
    expect(byCollection.some((c) => c.name === "Contacts")).toBe(true);
  });

  it("returns 0 once the sample data has been cleared", async () => {
    const { clear } = await freshApp();
    await clear.clearSampleData();
    const { total } = await clear.countSampleData();
    expect(total).toBe(0);
  });

  it("counts ONLY sample records once the user has added real ones", async () => {
    // Added after mutation testing found the count was untested. Replacing the
    // seed-id filter in countSampleData with a plain `all.length` failed ZERO
    // tests, because on a fresh install every record IS sample data - the two
    // are identical, so the test proved nothing. The only way to tell the count
    // apart is to have real records mixed in, which is exactly the state a
    // user is in once they have entered anything.
    //
    // This is the same trap as the calendar tests that could not fail: a test
    // that cannot fail when the bug is reintroduced reads as coverage.
    const { contacts, clear } = await freshApp();
    const sampleCount = contacts.SEED_CONTACT_IDS.size;
    const { total: before } = await clear.countSampleData();

    await contacts.ContactRepository.create({ name: "My Real Contact" });

    const { total: after, byCollection } = await clear.countSampleData();
    // The real contact must NOT be counted as sample data.
    expect(after).toBe(before);
    expect(after).toBeGreaterThan(0);
    const contactsRow = byCollection.find((c) => c.name === "Contacts");
    expect(contactsRow.count).toBe(sampleCount);
  });
});

describe("clearSampleData removes sample records and keeps real ones", () => {
  it("keeps a contact the user created, mixed in with the sample data", async () => {
    // THE scenario that makes "clear sample data" different from "delete
    // everything". create() pulls the seed into memory and then persists the
    // whole array, so after this call the repository holds all 16 sample
    // contacts AND the user's own - indistinguishable except by id.
    const { contacts, clear } = await freshApp();
    await contacts.ContactRepository.create({ name: "My Real Contact" });
    const mixed = await contacts.ContactRepository.getAll();
    expect(mixed.length, "sample + real should be mixed in one array").toBe(
      contacts.SEED_CONTACT_IDS.size + 1
    );
    expect(mixed.some((c) => c.name === "My Real Contact")).toBe(true);

    const { removed, kept } = await clear.clearSampleData();
    // `removed` is the grand total across every seeded collection (all 14 of
    // them, ~96 records), not contacts alone. A first draft of this assertion
    // compared it to the contact seed count and failed with "expected 96 to be
    // 16" - the wrong claim, not a wrong number. So assert the two things that
    // actually matter separately: the sample contacts specifically are gone,
    // and the real one survived.
    expect(removed).toBeGreaterThanOrEqual(contacts.SEED_CONTACT_IDS.size);
    expect(kept).toBeGreaterThanOrEqual(1);

    const after = await contacts.ContactRepository.getAll();
    expect(after.map((c) => c.name)).toEqual(["My Real Contact"]);
  });

  it("clears every seeded collection, not just contacts", async () => {
    const { clear } = await freshApp();
    const before = await clear.countSampleData();
    expect(before.byCollection.length).toBeGreaterThan(3);
    const { removed } = await clear.clearSampleData();
    expect(removed).toBe(before.total);
  });

  it("writes the cleared state rather than removing the key, so it survives a reload", async () => {
    // This is the failure resetAllData.js was written to fix: removing the
    // storage KEY makes the seed fallback return on the next load. Clearing
    // must WRITE a value, which is what replaceAll() does.
    const { contacts, clear } = await freshApp();
    await contacts.ContactRepository.create({ name: "My Real Contact" });
    await clear.clearSampleData();
    const raw = mockStore.get("shos_contacts");
    expect(Array.isArray(raw), "storage should hold a value, not be absent").toBe(true);
    expect(raw.map((c) => c.name)).toEqual(["My Real Contact"]);

    // And a genuinely fresh module registry - a real reload - still sees the
    // cleared state rather than the seed coming back.
    vi.resetModules();
    const reloaded = await import("./contactRepository");
    const afterReload = await reloaded.ContactRepository.getAll();
    expect(afterReload.map((c) => c.name)).toEqual(["My Real Contact"]);
  });

  it("leaves the sample data alone when there is none to remove", async () => {
    const { clear } = await freshApp();
    await clear.clearSampleData();
    const { removed, failed } = await clear.clearSampleData();
    expect(removed).toBe(0);
    expect(failed).toEqual([]);
  });

  it("never throws when a repository is unreadable, and reports it instead", async () => {
    // An advisory action must never be able to break the app.
    const { contacts, clear } = await freshApp();
    const original = contacts.ContactRepository.getAll;
    contacts.ContactRepository.getAll = vi.fn().mockRejectedValue(new Error("simulated storage failure"));
    try {
      const result = await clear.clearSampleData();
      expect(result.failed.length).toBeGreaterThan(0);
      expect(result.failed[0].error).toContain("simulated storage failure");
      // The other repositories were still processed.
      expect(result.removed).toBeGreaterThan(0);
    } finally {
      contacts.ContactRepository.getAll = original;
    }
  });

  it("countSampleData survives an unreadable repository too", async () => {
    const { contacts, clear } = await freshApp();
    const original = contacts.ContactRepository.getAll;
    contacts.ContactRepository.getAll = vi.fn().mockRejectedValue(new Error("simulated storage failure"));
    try {
      const { total } = await clear.countSampleData();
      // Contacts contributed nothing, but everything else still counted.
      expect(total).toBeGreaterThan(0);
    } finally {
      contacts.ContactRepository.getAll = original;
    }
  });
});
