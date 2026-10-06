// Can isDemoData recognise the LIVE seed data of EVERY collection as demo data?
//
// This is the blocker raised on the session bus at 02:28 on 6 Oct, tested
// rather than argued: the frozen snapshot in seedDivergence.js is captured from
// the repositories' seed arrays, and those records are handed back through the
// repositories' own DEFAULT_* merge and normalisers. If the stored shape differs
// from the seeded shape, every live demo record reads as "diverged" and Clear
// Sample Data becomes a silent no-op.
//
// That failure deletes nothing, so it is easy to ship by accident, and it is
// invisible to any test written against the module's own snapshot - that test
// compares the snapshot to itself. Only going to the repositories finds it.
//
// Found this way: contactRepository.js normalises statedKinks/limits from a flat
// array of ids to `{kinkId, role}` on every read (changed 18 Aug 2026), so 2 of
// 16 live contact seeds compared unequal to the snapshot. Contacts alone is why
// this file checks every collection rather than a convenient sample - the same
// drift can exist anywhere, and one collection passing proves nothing.

import { describe, it, expect, beforeEach, vi } from "vitest";
// Pure module with no repository state, so a static import is safe here - unlike
// the repositories, which are re-imported per test below.
import { isDemoData, legacyDefinitionFor } from "./seedDivergence.js";

// Mock the storage adapter so the repositories load their seed arrays without an
// unlocked vault, and re-import them into a fresh module registry per test.
//
// NOT OPTIONAL, and the first version of this file proved it: it imported the
// repositories statically at the top, which reads whatever module-level cache
// the worker happens to already hold. It passed alone and failed in the full
// 77-file run, because `clearSampleData.test.js` calls `clearSampleData()` five
// times and that cache survives both `mockStore.clear()` and any per-test setup -
// so the seeded records this test exists to compare against had already been
// deleted by whoever ran first. A check that depends on mutable global state is
// order-dependent, and an order-dependent check reports a fidelity problem that
// is really a test-harness problem. Same pattern, and the same reasoning, as
// clearSampleData.test.js's own freshApp().
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

const REPO_MODULES = {
  contacts: "../repositories/contactRepository",
  encounters: "../repositories/encounterRepository",
  tests: "../repositories/testingRepository",
  medications: "../repositories/medicationRepository",
  clinicVisits: "../repositories/clinicVisitsRepository",
  vaccinations: "../repositories/vaccinationRepository",
  symptomLog: "../repositories/symptomLogRepository",
  measurements: "../repositories/measurementRepository",
  locations: "../repositories/locationsRepository",
  episodes: "../repositories/episodeRepository",
  logs: "../repositories/logRepository",
};

/** Fresh repositories with the seed arrays present, whatever ran before. */
async function freshRepos() {
  vi.resetModules();
  const out = {};
  for (const [name, path] of Object.entries(REPO_MODULES)) {
    out[name] = (await import(/* @vite-ignore */ path))[
      { contacts: "ContactRepository", encounters: "EncounterRepository", tests: "TestingRepository",
        medications: "MedicationRepository", clinicVisits: "ClinicVisitsRepository",
        vaccinations: "VaccinationRepository", symptomLog: "SymptomLogRepository",
        measurements: "MeasurementRepository", locations: "LocationsRepository",
        episodes: "EpisodeRepository", logs: "LogRepository" }[name]
    ];
  }
  return out;
}

beforeEach(() => {
  mockStore.clear();
});

/** Fields that are bookkeeping rather than user-visible content. */
const IGNORED = new Set(["isSeed", "collection", "createdAt", "updatedAt"]);

function show(v) {
  const s = JSON.stringify(v);
  return s === undefined ? String(v) : s;
}

function fieldDiffs(record, definition) {
  const keys = new Set([...Object.keys(record), ...Object.keys(definition || {})]);
  return [...keys]
    .filter((k) => !IGNORED.has(k))
    .filter((k) => show(record[k]) !== show((definition || {})[k]))
    .map(
      (k) =>
        `${k}\n       live   : ${show(record[k]).slice(0, 70)}\n       snapshot: ${show((definition || {})[k]).slice(0, 70)}`,
    );
}

/**
 * Shift every date-shaped string in a record by `days`, recursively.
 *
 * Simulates a snapshot captured on a different day, which is what the seed
 * arrays actually produce: they build dates from `new Date()`, so the same seed
 * yields different values on every evaluation.
 */
function shiftDates(value, days) {
  const MS = 86400000;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
      return new Date(new Date(value).getTime() + days * MS).toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(new Date(`${value}T00:00:00.000Z`).getTime() + days * MS)
        .toISOString()
        .slice(0, 10);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, days));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = shiftDates(value[k], days);
    return out;
  }
  return value;
}

/** Shift every date-shaped string by `minutes`, recursively. */
function shiftMinutes(value, minutes) {
  const MS = 60000;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
      return new Date(new Date(value).getTime() + minutes * MS).toISOString();
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => shiftMinutes(v, minutes));
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = shiftMinutes(value[k], minutes);
    return out;
  }
  return value;
}

/**
 * The regressions that a self-referential test cannot see.
 *
 * Both were real bugs on 6 Oct, and a mutation harness proved neither was
 * covered: disabling the date projection, and disabling the kink-shape
 * canonicalisation, both stayed GREEN while the fixture was only hours old,
 * because a freshly regenerated snapshot happens to agree with the live records
 * in absolute terms. They only diverge on a LATER day - which is to say the
 * guard would have gone red on its own, days later, with no change to explain
 * it.
 *
 * So each is tested by reconstructing the older shape here rather than by
 * trusting that the suite happens to be green today.
 */
describe("the projection is what makes the comparison survive a day passing", () => {
  it("still matches a seeded record whose dates are days older than today", async () => {
    const { encounters: EncounterRepository } = await freshRepos();
    const all = await EncounterRepository.getAll();
    const live = all.find((r) => legacyDefinitionFor(r) && isDemoData(r));
    if (!live) throw new Error("no seeded encounter classified as demo - the suite would pass vacuously");

    for (const days of [1, 3, 30]) {
      const aged = shiftDates(live, -days);
      expect(
        isDemoData(aged),
        `a seeded encounter with every date ${days} day(s) older stopped matching. ` +
          `Absolute date comparison would treat that as a user edit, so demo data ` +
          `would silently become undeletable.`,
      ).toBe(true);
    }
  });

  it("still matches when only the time of day differs", async () => {
    // The regression that actually shipped a red suite: a field set to
    // `new Date().toISOString()` (Episode.resolvedDate) records when the seed was
    // evaluated, so regenerating the snapshot hours later changed it. Comparing
    // the HOUR was tried first and drifted 77 minutes, failing anyway - any
    // clock-based tolerance is defeated by a clock.
    //
    // Shifted in MINUTES precisely so this cannot pass by accident: the day
    // offsets stay equal, so a day-resolution comparison passes, and a
    // time-of-day comparison fails. That is the property being pinned.
    const { episodes: EpisodeRepository } = await freshRepos();
    const all = await EpisodeRepository.getAll();
    const live = all.find((r) => legacyDefinitionFor(r));
    if (!live) throw new Error("no seeded episode loaded");

    for (const minutes of [5, 90, 600]) {
      const shifted = shiftMinutes(live, minutes);
      expect(
        isDemoData(shifted),
        `a seeded episode ${minutes} minutes off classified as USER data. ` +
          `Clear Sample Data would keep demo data the user never touched.`,
      ).toBe(true);
    }
  });

  it("still matches when kink fields carry the pre-18-Aug flat id array", async () => {
    const { encounters: EncounterRepository } = await freshRepos();
    const all = await EncounterRepository.getAll();
    const live = all.find((r) => (r.kinksInvolved || []).length && legacyDefinitionFor(r));
    if (!live) throw new Error("no seeded encounter carries kinksInvolved");

    const flattened = {
      ...live,
      kinksInvolved: live.kinksInvolved.map((k) => (k && k.kinkId ? k.kinkId : k)),
    };
    expect(
      isDemoData(flattened),
      "the {kinkId, role} schema change read as a user edit, which makes every " +
        "seeded record carrying a kink permanently undeletable",
    ).toBe(true);
  });
});

describe("the frozen snapshot describes the live seed data of every collection", () => {
  // `freshRepos()` is called inside each test rather than once here: a describe
  // callback is not async, so awaiting at this level is a syntax error - and it
  // would share one module registry across every collection anyway, which is the
  // coupling this file exists to avoid.
  for (const name of Object.keys(REPO_MODULES)) {
    it(`${name}: every seeded record still classifies as demo data`, async () => {
      const repo = (await freshRepos())[name];
      const all = await repo.getAll();
      // Only records the snapshot claims to describe. A collection with no seeds
      // legitimately has none, and asserting >0 there would be a false failure.
      const candidates = all.filter((r) => legacyDefinitionFor(r));
      if (!candidates.length) {
        // Not vacuous: say so, so a renamed seed array cannot make this suite
        // quietly stop checking anything.
        console.log(`  (${name}: no seeded records loaded - nothing to check)`);
        return;
      }

      const notDemo = candidates.filter((r) => !isDemoData(r));
      if (notDemo.length) {
        const sample = notDemo[0];
        throw new Error(
          `${notDemo.length}/${candidates.length} live ${name} seed records classify as USER data.\n` +
            `Clear Sample Data would silently keep them - a real regression that deletes nothing.\n` +
            `First offender: ${sample.id}\n` +
            `  ${fieldDiffs(sample, legacyDefinitionFor(sample)).join("\n  ")}`,
        );
      }
      expect(notDemo.length).toBe(0);
    });
  }
});