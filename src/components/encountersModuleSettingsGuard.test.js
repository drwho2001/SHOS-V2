// encountersModuleSettingsGuard.test.js — 19 Nov 2026 owner ask: give
// Encounters its own module settings, matching Contacts/Medication/Healthcare.
// Three list-header toggles used to reset every visit; they are now persisted
// defaults in AppPreferencesRepository, with the in-list controls kept as
// per-session overrides.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("Encounters module settings", () => {
  const enc = read("src/modules/SHOS_Encounters_Prototype.jsx");
  const screen = read("src/modules/settings/EncountersSettingsScreen.jsx");
  const prefs = read("src/repositories/appPreferencesRepository.js");

  it("the banner carries a gear wired to the module settings screen", () => {
    expect(enc).toMatch(/aria-label=\{tr\("encounters\.settings", "Encounter settings"\)\}/);
    expect(enc).toMatch(/setShowEncounterSettings\(true\)/);
    expect(enc).toMatch(/<EncountersSettingsScreen onClose=/);
  });

  it("persists all three defaults in AppPreferencesRepository", () => {
    expect(prefs).toMatch(/encounterDefaultSort: "newest"/);
    expect(prefs).toMatch(/encounterShowSessionSummaries: false/);
    expect(prefs).toMatch(/encounterShowArchived: false/);
  });

  it("starts the list toggles from the stored defaults and reloads after writes", () => {
    expect(enc).toMatch(/useState\(encounterPrefs\.encounterDefaultSort === "oldest" \? "oldest" : "newest"\)/);
    expect(enc).toMatch(/useState\(!!encounterPrefs\.encounterShowSessionSummaries\)/);
    expect(enc).toMatch(/useState\(!!encounterPrefs\.encounterShowArchived\)/);
    expect(enc).toMatch(/setEncounterPrefsVersion\(\(v\) => v \+ 1\)/);
    // In-list controls stay local overrides — they must NOT write prefs.
    expect(enc).toMatch(/setEncounterSort\("oldest"\)/);
    expect(enc).not.toMatch(/setEncounterSort\("oldest"\)[\s\S]{0,120}AppPreferencesRepository\.update/);
  });

  it("the settings screen owns the three controls", () => {
    expect(screen).toMatch(/encounterDefaultSort: key/);
    expect(screen).toMatch(/encounterShowSessionSummaries: !prefs\.encounterShowSessionSummaries/);
    expect(screen).toMatch(/encounterShowArchived: !prefs\.encounterShowArchived/);
  });
});
