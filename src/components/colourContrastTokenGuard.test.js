// colourContrastTokenGuard.test.js — 19 Nov 2026: owner accepted the axe
// swatch sheet's font-colour changes. Semantic red/green stay red/green (just
// darkened), amber text moves to its text-safe token, and white-on-tinted
// chips become theme text. White-on-teal (4.47) was explicitly accepted.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("accepted contrast token changes", () => {
  const tokens = read("src/calculations/designTokens.js");

  it("keeps semantic FILL colours untouched; only text-safe variants darkened", () => {
    // Owner approved FONT changes only — red must still read as critical/
    // deletion and green as OK/done at their original fill strength.
    expect(tokens).toMatch(/red: "#D93838"/);
    expect(tokens).toMatch(/green: "#148A1E"/);
    expect(tokens).toMatch(/red: "#C02020",\s*green: "#0F6A17"/);
  });

  it("does not repurpose the amber fill token as text", () => {
    expect(tokens).toMatch(/amber: "#F59E0B"/);
    expect(tokens).toMatch(/amberText: "#926100"/);
  });

  it("no white text remains on the pale Encounter chips", () => {
    const enc = read("src/modules/SHOS_Encounters_Prototype.jsx");
    expect(enc).not.toMatch(/color: "#fff"/);
    expect(enc).toMatch(/color: T\.textPrimary, fontSize: 10/);
    expect(enc).toMatch(/color: ACTION_TEXT_SAFE\.amber/);
    expect(enc).toMatch(/color: T\.actionRedText }}>INFERRED/);
  });
});
