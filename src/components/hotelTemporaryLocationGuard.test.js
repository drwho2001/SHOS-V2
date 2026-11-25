// hotelTemporaryLocationGuard.test.js — 25 Nov 2026 owner finding.
//
// The owner stayed in a hotel and had someone over. Typing a hotel into the
// encounter's Location picker would call LocationsRepository.findOrCreate()
// and leave a permanent saved place (and, via contact/location suggestions,
// a route to an address on the owner). This guard locks the alternative that
// was built: "Hotel" is an encounter category like "Sauna", and the one-off
// where lives as a plain string on the encounter only.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");
const REPO = read("src/repositories/encounterRepository.js");
const ENC = read("src/modules/SHOS_Encounters_Prototype.jsx");

describe("hotel encounters and one-off temporary locations", () => {
  it("Hotel is an encounter category next to Sauna, not only a location type", () => {
    const m = /ENCOUNTER_TYPE_OPTIONS = \[([^\]]*)\]/.exec(REPO);
    expect(m, "could not read encounter type options").not.toBeNull();
    const options = m[1].split(",").map((s) => s.trim().replace(/"/g, ""));
    expect(options).toContain("Sauna");
    expect(options).toContain("Hotel");
  });

  it("the temporary location is a plain defaulted field, not a new repository", () => {
    expect(REPO).toMatch(/temporaryLocation: ""/);
    expect(ENC).not.toMatch(/LocationsRepository\.findOrCreate\([^)]*temporaryLocation/);
  });

  it("Hotel has a render-only icon like Sauna", () => {
    expect(ENC).toMatch(/BedIcon as Bed/);
    expect(ENC).toMatch(/Sauna: SaunaDrop,\s*Hotel: Bed,/);
  });

  it("the form owns the field and never routes it through the location picker", () => {
    expect(ENC).toMatch(/id="encounter-temp-location"/);
    expect(ENC).toMatch(/value=\{form\.temporaryLocation \|\| ""\}/);
    expect(ENC).toMatch(/onChange=\{set\("temporaryLocation"\)\}/);
  });

  it("card and detail both render it through the shared masking helper", () => {
    expect(ENC).toMatch(/import \{ formatEncounterLocation \} from "\.\.\/calculations\/encounterLocationLabel\.js"/);
    const uses = ENC.match(/formatEncounterLocation\(/g) || [];
    expect(uses.length).toBeGreaterThanOrEqual(1);
    expect(ENC).toMatch(/label=\{tr\("encounters\.tempLocation", "Temporary location"\)\}/);
    expect(ENC).toMatch(/anonymise \? ANONYMISED : encounter\.temporaryLocation/);
  });

  it("the strings exist in both locales", () => {
    for (const locale of ["en", "en-US"]) {
      const json = JSON.parse(read(`src/i18n/${locale}.json`));
      expect(json.encounters.tempLocation).toBeTruthy();
      expect(json.encounters.tempLocationPlaceholder).toBeTruthy();
      expect(json.encounters.tempLocationHelp).toBeTruthy();
    }
  });
});
