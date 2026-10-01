import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { travelsByCar } from "./contactCalculations";

// t053 "one owner per derived fact": `drives` is a plain boolean that predates
// `travelMode`, and SHOS_Contacts' own TRANSPORT_TIERS comment states it should
// be "folded in as an alias for travelMode's own Car tier".
//
// That intent was honoured in ONE of the FOUR places that answer "does this
// contact travel by car?". The card icon ORed the two; the card badge, the list
// filter and the detail view each read `drives` alone. Verified consequences:
//
//   1. A contact with travelMode ["Car"] and drives false showed a CAR ICON on
//      the card and then "Drives: No" on the detail view - the same screen
//      contradicting itself.
//   2. The "Drives" filter chip could not find that contact at all, which is
//      the entire purpose of filtering by transport.
//
// The rule now lives in contactCalculations and all four read it. The structural
// tests at the bottom are the part that matters: they stop a fifth copy.

const src = (p) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("travelsByCar", () => {
  it("honours the legacy boolean", () => {
    expect(travelsByCar({ drives: true })).toBe(true);
    expect(travelsByCar({ drives: true, travelMode: ["Cycle"] })).toBe(true);
  });

  it("honours travelMode's Car", () => {
    expect(travelsByCar({ drives: false, travelMode: ["Car"] })).toBe(true);
    expect(travelsByCar({ travelMode: ["Walk", "Car"] })).toBe(true);
  });

  it("is false for neither", () => {
    expect(travelsByCar({ drives: false, travelMode: ["Cycle", "Walk"] })).toBe(false);
    expect(travelsByCar({ drives: false, travelMode: [] })).toBe(false);
  });

  it("survives missing and malformed shapes", () => {
    // Backup import is the realistic source of a malformed record.
    for (const bad of [undefined, null, {}, { drives: "yes" }, { travelMode: null }, { travelMode: "Car" }]) {
      expect(travelsByCar(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("resolves the contradiction that made the filter useless", () => {
    // This is the case the "Drives" filter chip missed entirely.
    const contact = { drives: false, travelMode: ["Car"] };
    expect(contact.drives).toBe(false);
    expect(travelsByCar(contact)).toBe(true);
  });
});

describe("no fifth copy of the drives rule", () => {
  it("every 'travels by car' decision in Contacts reads the owner", () => {
    const code = src("src/modules/SHOS_Contacts_Prototype.jsx");
    // Strip comments: this file explains the drives/travelMode relationship at
    // length, and a raw scan would be satisfied by that prose rather than by code.
    const stripped = code
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));

    // The banned spellings - the two ways this rule was re-implemented before.
    expect(stripped, "a site still ORs drives with travelMode inline").not.toMatch(
      /drives\s*===\s*true\s*\|\|/
    );
    expect(stripped, "a site still filters on the bare boolean").not.toMatch(/\.filter\(\(c\) => c\.drives/);
    // And the owner is actually used.
    expect(stripped).toMatch(/travelsByCar\(/);
    expect(code).toMatch(/travelsByCar/);
  });

  it("'Foreskin fit' is gated in BOTH read views", () => {
    // The first fix was made in Contacts, and My Profile had the identical bug -
    // which is only knowable by checking, since nothing links the two read views.
    for (const file of [
      "src/modules/SHOS_Contacts_Prototype.jsx",
      "src/modules/SHOS_MyProfile_Prototype.jsx",
    ]) {
      const code = src(file);
      const idx = code.indexOf('label="Foreskin fit"');
      expect(idx, `${file}: no Foreskin fit row found`).toBeGreaterThan(-1);
      // Within the 60 characters before the row there must be a guard on foreskin.
      const before = code.slice(Math.max(0, idx - 120), idx);
      expect(before, `${file}: "Foreskin fit" renders without a foreskin guard`).toMatch(
        /foreskin\s*===\s*"Uncircumcised"/
      );
    }
  });
});