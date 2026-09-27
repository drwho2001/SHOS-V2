// Coverage for two preference objects that were in no backup at all.
//
// These were found by asking a question the earlier audits had not: not "which
// repositories are in the backup?" but "which USER SETTINGS are in it?".
// darkModePreference and clinicCardVisibility both live in src/calculations/
// rather than src/repositories/, so any audit that enumerated repositories
// structurally could not find them - and this file's own CLAUDE.md records that
// "a new repository must be wired into backupService.js in the same change,
// not after. This was missed twice historically." Here it was missed a third
// time, in a different direction: not a new repository, but an existing
// preference that never looked like data.
//
// The consequence for darkModePreference is the sharpest one here: it is the
// app's ONLY owner of the light/dark choice (AppPreferencesRepository has no
// darkMode field - verified), so restoring a backup on a new device silently
// reset the user to their OS default with no warning at all.
//
// Storage is mocked with an in-memory map, the same approach as
// contactRepository.test.js and customOptionLists.test.js. The real adapter
// needs the encryption vault unlocked, so every save would log "Vault is not
// unlocked" and the assertions would pass against module memory while
// verifying almost nothing.
//
// A full round-trip through buildBackup()/restoreBackup() is not attempted: both
// reach the encrypted adapter and would need a PBKDF2 vault stood up in a unit
// test to assert a boolean. Instead the accessors are tested for real against
// storage (they are the new API surface - a typo in either would silently
// no-op), and the WIRING is checked at source level, which is precisely
// targeted at the historical failure mode: a preference that exists, works,
// and is simply never handed to the backup. A behavioural test cannot tell
// "wired up" from "correctly wired up" any more cheaply than this, and what
// is being guarded is a wiring, not an algorithm.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

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

const {
  getDarkModePreference,
  setDarkModePreference,
} = await import("./darkModePreference");
const {
  getClinicCardVisibility,
  setClinicCardVisibility,
  CLINIC_CARD_SECTIONS,
} = await import("./clinicCardVisibilityPreference");
const { localStorageAdapter } = await import("../storage/storageAdapter.js");

const DARK_KEY = "shos_dark_mode_preference";
const VIS_KEY = "shos_clinic_card_visibility";

// import.meta.url is not a file: URL under vitest, so paths resolve from the
// repo root vitest already runs in.
const CALC_DIR = path.join(process.cwd(), "src", "calculations");

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
});

describe("dark mode preference round-trips through its own accessor", () => {
  // The module's own in-memory value starts as a BOOLEAN (whatever the OS
  // reports right now) and only becomes the string "light"/"dark"/"system"
  // once syncDarkModePreferenceFromStorage() has read the real stored value.
  // A first draft asserted a string default here and failed, because it was
  // asserting post-boot state in a module that had not booted. Asserting the
  // honest pre-sync shape instead.

  it("starts from the OS preference as a boolean, before any storage read", async () => {
    const value = await getDarkModePreference();
    expect(typeof value).toBe("boolean");
    expect(mockStore.has(DARK_KEY)).toBe(false);
  });

  it("persists an explicit choice and reads it back", async () => {
    await setDarkModePreference("dark");
    expect(await getDarkModePreference()).toBe("dark");
    // Read straight from the adapter as well, so this asserts the write really
    // landed rather than only that the module's own memory is consistent.
    expect(await localStorageAdapter.load(DARK_KEY, null)).toBe("dark");
  });

  it("is a real, separate storage key from app preferences", async () => {
    await setDarkModePreference("dark");
    const appPrefs = await localStorageAdapter.load("shos_app_preferences", null);
    // If dark mode were ever folded into AppPreferencesRepository this would
    // collide, and the two would start overwriting each other.
    expect(appPrefs === null || appPrefs.darkMode === undefined).toBe(true);
  });

  it("is a no-op when set to the value it already holds", async () => {
    await setDarkModePreference("light");
    const callsAfterFirst = localStorageAdapter.save.mock.calls.length;
    await setDarkModePreference("light");
    // The setter's own early-return guard, asserted because it is what keeps
    // a re-render from rewriting storage on every single render.
    expect(localStorageAdapter.save.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe("clinic card visibility round-trips and defaults every section on", () => {
  it("defaults every known section to visible", async () => {
    const value = await getClinicCardVisibility();
    expect(Object.keys(value).sort()).toEqual(CLINIC_CARD_SECTIONS.map((s) => s.key).sort());
    expect(Object.values(value).every((v) => v === true)).toBe(true);
  });

  it("persists a section being hidden and reads it back", async () => {
    const first = CLINIC_CARD_SECTIONS[0].key;
    const next = { ...(await getClinicCardVisibility()), [first]: false };
    await setClinicCardVisibility(next);
    const read = await getClinicCardVisibility();
    expect(read[first]).toBe(false);
    // Every other section must be untouched - hiding one section must not
    // silently hide the rest of the card.
    const others = CLINIC_CARD_SECTIONS.filter((s) => s.key !== first).map((s) => s.key);
    expect(others.every((k) => read[k] === true)).toBe(true);
  });

  it("fills in a section added since the value was stored", async () => {
    // The defensive-default-merge rule applied to a new section key: an old
    // stored value must not leave a newly added section undefined, which would
    // render it invisible on the card a clinician reads.
    const first = CLINIC_CARD_SECTIONS[0].key;
    await localStorageAdapter.save(VIS_KEY, { [first]: false });
    const read = await getClinicCardVisibility();
    expect(read[first]).toBe(false);
    expect(Object.keys(read)).toHaveLength(CLINIC_CARD_SECTIONS.length);
  });

  it("tolerates a null stored value rather than throwing", async () => {
    // An import can hand a singleton a non-object (backupService's own
    // sanitiser exists precisely because that has happened). A settings read
    // that throws on it would break the whole Clinic Card screen.
    await localStorageAdapter.save(VIS_KEY, null);
    const read = await getClinicCardVisibility();
    expect(Object.values(read).every((v) => v === true)).toBe(true);
  });
});

describe("backupService is actually wired to both", () => {
  // The historical failure mode: the setting exists, works perfectly, and is
  // simply never handed to the backup.
  const src = readFileSync(path.join(CALC_DIR, "..", "storage", "backupService.js"), "utf8");
  const bodyOf = (name) => {
    const i = src.indexOf(`export async function ${name}`);
    expect(i, `${name} not found in backupService.js`).toBeGreaterThan(-1);
    return src.slice(i, src.indexOf("\nexport ", i));
  };

  it("includes both keys in buildBackup", () => {
    const slice = bodyOf("buildBackup");
    expect(slice).toMatch(/darkModePreference:\s*await getDarkModePreference\(\)/);
    expect(slice).toMatch(/clinicCardVisibility:\s*await getClinicCardVisibility\(\)/);
  });

  it("destructures both keys when restoring", () => {
    // The silent failure this guards: adding a field to buildBackup and
    // forgetting to destructure it in restoreBackup means the export LOOKS
    // complete and the restore quietly does nothing.
    const head = bodyOf("restoreBackup").split("\n").slice(0, 4).join("\n");
    expect(head).toMatch(/darkModePreference/);
    expect(head).toMatch(/clinicCardVisibility/);
  });

  it("restores both keys, each guarded so an older backup file still restores", () => {
    const slice = bodyOf("restoreBackup");
    expect(slice).toMatch(/typeof darkModePreference === "string"/);
    expect(slice).toMatch(/!Array\.isArray\(clinicCardVisibility\)/);
    expect(slice).toMatch(/await setDarkModePreference\(darkModePreference\)/);
    expect(slice).toMatch(/await setClinicCardVisibility\(clinicCardVisibility\)/);
  });

  it("excludes both from merge, because a settings singleton cannot sensibly merge", () => {
    // Same reasoning already applied to appPreferences/myProfile: "combine
    // both sets" has no meaning for a single value. Guarded so a future edit
    // cannot quietly start averaging two devices' dark mode choices together.
    const slice = bodyOf("mergeBackup");
    expect(slice).not.toMatch(/setDarkModePreference\(/);
    expect(slice).not.toMatch(/setClinicCardVisibility\(/);
  });

  it("has no other settings singleton left out of the backup", () => {
    // The check that would have caught the original gap. Any module in
    // src/calculations/ that owns a persisted value under a STORAGE_KEY but is
    // never referenced by backupService is a setting that will silently vanish
    // on restore. Enumerated from the filesystem rather than asserted as a
    // fixed list, so the NEXT unwired preference fails here instead of in a
    // user's restore.
    const alreadyCovered = new Set(["darkModePreference.js", "clinicCardVisibilityPreference.js"]);
    const candidates = readdirSync(CALC_DIR).filter(
      (f) => f.endsWith("Preference.js") && !alreadyCovered.has(f)
    );
    const unwired = candidates.filter((f) => {
      const body = readFileSync(path.join(CALC_DIR, f), "utf8");
      const ownsAStoredValue = /storage\.load\(\s*STORAGE_KEY/.test(body);
      return ownsAStoredValue && !src.includes(f.replace(".js", ""));
    });
    expect(unwired, `preference modules with a stored value but no backup entry: ${unwired.join(", ")}`).toEqual([]);
  });
});
