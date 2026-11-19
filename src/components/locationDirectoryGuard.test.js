// 19 Nov — read-only Locations directory in Settings + custom location types.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const SCREEN = read("src/modules/settings/LocationsScreen.jsx");
const SETTINGS = read("src/modules/SHOS_Settings_Prototype.jsx");
const OPTIONS = read("src/repositories/customOptionListsRepository.js");
const MANAGE = read("src/modules/settings/ManageListsScreen.jsx");
const HELPER = read("src/calculations/locationDirectory.js");

describe("Locations directory", () => {
  it("is a discoverable Settings entry in Content & Lists", () => {
    expect(SETTINGS).toMatch(/import\("\.\/settings\/LocationsScreen"\)/);
    expect(SETTINGS).toMatch(/<SettingsRow icon=\{MapPin\} label="Locations"/);
    expect(SETTINGS).toMatch(/screen: "locations"/);
    expect(SETTINGS).toMatch(/screen === "locations"/);
    expect(SETTINGS).toMatch(/<LocationsScreen onClose/);
  });

  it("lists named locations grouped by type with copy + Maps actions", () => {
    expect(SCREEN).toMatch(/groupLocationsByType\(locations\)/);
    expect(SCREEN).toMatch(/clipboard\.writeText\(formatAddress\(location\)\)/);
    expect(SCREEN).toMatch(/buildMapsSearchUrl\(location\)/);
    expect(SCREEN).toMatch(/target="_blank" rel="noopener noreferrer"/);
  });

  it("flags missing addresses for used locations but not cars", () => {
    expect(HELPER).toMatch(/needsAddressNudge/);
    expect(SCREEN).toMatch(/needsAddressNudge\(location, \{ usedByCount \}/);
  });

  it("owns one Maps URL constant, not an invented per-row URL", () => {
    expect(HELPER).toMatch(/MAPS_SEARCH_BASE = "https:\/\/www\.google\.com\/maps\/search\/\?api=1&query="/);
    const urls = HELPER.match(/https?:\/\/[^"'\s]+/g) || [];
    expect(urls.every((u) => u.startsWith("https://www.google.com/maps/search/"))).toBe(true);
  });

  it("uses role=status for the copy feedback (a11y)", () => {
    expect(SCREEN).toMatch(/role="status"/);
  });
});

describe("custom location types", () => {
  it("has an editable locationType list with the caravan-style use case", () => {
    expect(OPTIONS).toMatch(/locationType: \[/);
    expect(MANAGE).toMatch(/getRanked\("locationType"\)/);
    expect(MANAGE).toMatch(/Add a type \(e\.g\. His caravan\)/);
    expect(MANAGE).toMatch(/CustomOptionListsRepository\.add\("locationType"/);
  });

  it("keeps legacy emoji-tagged values visible even when not in the new list", () => {
    expect(MANAGE).toMatch(/\.\.\(entry\.type \? \[entry\.type\] : \[\]\)/);
  });

  it("loads typeOptions with the tuple hook (a setter is needed on add)", () => {
    // Regression: useLoadedMemo returns ONLY a value, so destructuring
    // [typeOptions, setTypeOptions] left both undefined -> "typeOptions is not
    // iterable" and a broken add. The setter needs useLoadedState.
    expect(MANAGE).toMatch(/const \[typeOptions, setTypeOptions\] = useLoadedState\(/);
    expect(MANAGE).not.toMatch(/const \[typeOptions, setTypeOptions\] = useLoadedMemo\(/);
  });
});
