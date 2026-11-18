// App-wide chip/tag rows: the five duplicated MultiSelectChips copies all
// use the shared collapse helper so long option sets cannot dominate a screen.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const files = [
  "src/modules/SHOS_Testing_Prototype.jsx",
  "src/modules/SHOS_Contacts_Prototype.jsx",
  "src/modules/SHOS_MyProfile_Prototype.jsx",
  "src/modules/SHOS_Encounters_Prototype.jsx",
  "src/modules/SHOS_Vaccinations_Prototype.jsx",
].map((rel) => ({ rel, src: read(rel) }));

describe("long chip rows", () => {
  it("every MultiSelectChips copy uses the shared collapse helper", () => {
    for (const f of files) {
      expect(f.src, `${f.rel} needs collapseChips`).toMatch(/collapseChips\(options, value/);
      expect(f.src, `${f.rel} needs a more control`).toMatch(/more \+\$\{hiddenCount\}/);
      // Only the MultiSelectChips body matters — other components map options.
      const start = f.src.indexOf("function MultiSelectChips(");
      const body = f.src.slice(start, f.src.indexOf("\nfunction ", start + 10));
      expect(body, `${f.rel} still maps all options`).not.toMatch(/\{options\.map\(\(opt\)/);
    }
  });

  it("the shared helper is the single owner of the rule", () => {
    const helper = read("src/calculations/chipVisibility.js");
    expect(helper).toMatch(/chosen\.has\(valueOf\(o\)\)/);
    expect(helper).toMatch(/hiddenCount: rest\.length - shownRest\.length/);
  });
});
