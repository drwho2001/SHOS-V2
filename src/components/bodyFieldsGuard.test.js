// 19 Nov — ethnicity/build/height/weight on Contacts + My Profile. These are
// sensitive (ethnicity is a protected characteristic), so guard the privacy
// boundaries, not just the field presence.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const CONTACT_REPO = read("src/repositories/contactRepository.js");
const PROFILE_REPO = read("src/repositories/myProfileRepository.js");
const OPTIONS = read("src/repositories/customOptionListsRepository.js");
const CONTACTS = read("src/modules/SHOS_Contacts_Prototype.jsx");
const PROFILE = read("src/modules/SHOS_MyProfile_Prototype.jsx");
const SHARE = read("src/storage/profileShareService.js");

describe("body fields", () => {
  it("exist on both record shapes", () => {
    for (const [name, src] of [["contact", CONTACT_REPO], ["profile", PROFILE_REPO]]) {
      for (const field of ["ethnicity", "build", "height", "weight"]) {
        expect(src, `${name}.${field}`).toMatch(new RegExp(`${field}: ""`));
      }
    }
  });

  it("use editable option lists for ethnicity and build", () => {
    expect(OPTIONS).toMatch(/ethnicity: \[/);
    expect(OPTIONS).toMatch(/build: \[/);
    expect(CONTACTS).toMatch(/getRanked\("ethnicity"\)/);
    expect(PROFILE).toMatch(/getRanked\("ethnicity"\)/);
  });

  it("are masked by anonymise in the Contacts read view", () => {
    for (const field of ["ethnicity", "build", "height", "weight"]) {
      expect(CONTACTS).toMatch(new RegExp(`label="${field[0].toUpperCase()}${field.slice(1)}" value=\\{anonymise \\? MASKED`));
    }
  });

  it("are excluded from profile sharing (default-deny allowlist)", () => {
    const shareable = SHARE.slice(SHARE.indexOf("SHAREABLE_FIELDS = ["), SHARE.indexOf("];", SHARE.indexOf("SHAREABLE_FIELDS = [")));
    for (const field of ["ethnicity", "build", "height", "weight"]) {
      expect(shareable, `${field} must not be shareable by default`).not.toContain(field);
    }
  });

  it("are NOT gender-gated (they apply to everyone)", () => {
    // The ethnicity field must appear before the gender-gated Physical block
    // in both edit forms, i.e. not inside the gender !== female branch.
    for (const [name, src] of [["contacts", CONTACTS], ["profile", PROFILE]]) {
      const ethnicity = src.indexOf('label="Ethnicity"');
      const gate = src.indexOf('form.gender?.trim().toLowerCase() !== "female"');
      expect(ethnicity, `${name}: ethnicity field present`).toBeGreaterThan(-1);
      expect(gate, `${name}: physical gate present`).toBeGreaterThan(-1);
      expect(ethnicity, `${name}: ethnicity must precede the gender gate`).toBeLessThan(gate);
    }
  });
});
