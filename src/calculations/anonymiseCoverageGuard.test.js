import { describe, it, expect } from "vitest";
import fs from "node:fs";

// ANONYMISE-MODE COVERAGE GUARD (30 Sep 2026 audit).
//
// A 28 Sep audit brought Anonymise mode to every surface it knew about. This
// file exists because that audit was a point-in-time sweep, and two NEW gaps
// had already appeared by the next one:
//
//   - Home's "Newest contact" row printed a contact's REAL NAME while the
//     feature was on. Home had no reference to the flag at all.
//   - Symptom Log's Related-encounters search index was built from attendee
//     names with no check, so a partner's real name still matched a picker
//     even though the rendered label never showed one.
//
// The second is the instructive one: the DISPLAY was already correct, so
// masking the label would have looked like a fix and changed nothing. That is
// the shape most likely to be reintroduced, and the shape a visual check
// cannot catch.
//
// Every assertion runs against COMMENT-STRIPPED source. This repo's comments
// quote code by design — that is what makes them valuable — and a raw substring
// test is therefore unreliable here. Eighth recorded instance of that class.

const MODULES = "src/modules";
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const read = (f) => strip(fs.readFileSync(`${MODULES}/${f}`, "utf8"));

describe("every module that shows a contact name honours Anonymise mode", () => {
  const SHOWS_A_NAME = [
    "SHOS_Home_Prototype.jsx",
    "SHOS_SymptomLog_Prototype.jsx",
    "SHOS_MyProfile_Prototype.jsx",
    "SHOS_Encounters_Prototype.jsx",
    "SHOS_Contacts_Prototype.jsx",
    "SHOS_ClinicCard_Prototype.jsx",
    "SHOS_GlobalSearch_Prototype.jsx",
    "SHOS_Timeline_Prototype.jsx",
    "SHOS_PartnerNotification_Prototype.jsx",
  ];

  it("the list is real, and every file in it exists", () => {
    for (const f of SHOWS_A_NAME) {
      expect(fs.existsSync(`${MODULES}/${f}`), `${f} missing`).toBe(true);
    }
    expect(SHOWS_A_NAME.length).toBeGreaterThan(5);
  });

  for (const f of SHOWS_A_NAME) {
    it(`${f} consults the Anonymise flag`, () => {
      // The real invariant: a module that displays attendee or contact names
      // must know the flag exists. This is deliberately coarse — a per-line
      // audit would go stale on the next feature, and the coarse version still
      // catches "someone added a name here and never checked".
      const src = read(f);
      const knowsTheFlag =
        /anonymiseDisplay/.test(src) || /anonymiseModeActive/.test(src) || /useAnonymiseMode/.test(src);
      expect(knowsTheFlag, `${f} shows contact names but never consults the Anonymise flag`).toBe(true);
    });
  }
});

describe("the two gaps this audit found are closed", () => {
  it("Home's 'Newest contact' row masks the name", () => {
    const src = read("SHOS_Home_Prototype.jsx");
    const row = src.split("\n").find((l) => l.includes('label="Newest contact"'));
    expect(row, "the Newest contact row was not found — renamed?").toBeTruthy();
    // Assert the GUARDED TERNARY, not the absence of `lastContact.name`.
    //
    // My first version asserted the name did not appear at all, which is
    // nonsense: `anonymise ? ANONYMISED : lastContact.name` must still name the
    // real property as the unmasked branch, and forbidding it would forbid the
    // fix. What matters is that the name is behind the flag. This is the
    // mirror of the comment-matching lesson - a guard that asserts something
    // impossible is as useless as one that asserts nothing.
    expect(row).toMatch(/anonymise\s*\?\s*ANONYMISED\s*:\s*lastContact\.name/);
    expect(row).not.toMatch(/ANONYMISED\s*:\s*["']/); // not a hand-typed string
  });

  it("Home calls the hook at the top of the component, not inside the render", () => {
    // A hook called lower down, or inside a JSX expression, violates the rules
    // of hooks. This repo has hit that exact mistake on a `.map()` callback
    // before, so the placement is asserted rather than assumed.
    const src = read("SHOS_Home_Prototype.jsx");
    const decl = src.indexOf("function HomeScreen");
    expect(decl).toBeGreaterThan(-1);
    const call = src.indexOf("useAnonymiseMode()", decl);
    expect(call, "Home does not call useAnonymiseMode").toBeGreaterThan(-1);
    // Should be within the first ~15 lines of the component body.
    expect(call - decl).toBeLessThan(1200);
  });

  it("Symptom Log masks the SEARCH INDEX, which is the part that actually leaks", () => {
    const src = read("SHOS_SymptomLog_Prototype.jsx");
    const line = src.split("\n").find((l) => l.includes("attendeeNames ="));
    expect(line, "the attendeeNames index was not found — renamed?").toBeTruthy();
    expect(line, "attendee names feed searchText, so the flag must gate them").toMatch(/anonymise/);
  });

  it("Symptom Log's index use is in the memo's dependency list", () => {
    // A memo whose value is read but whose dependency list omits it recomputes
    // at the wrong time — flipping Anonymise mode on would leave the stale
    // unmasked index in place for the life of the sheet.
    //
    // Deliberately not anchored on the closing `}),` — my first attempt did
    // that and failed, because the real text is `}), [contacts, anonymise]`
    // and the pattern omitted the parenthesis. Anchoring too tightly is its own
    // way of writing a test that measures nothing.
    const src = read("SHOS_SymptomLog_Prototype.jsx");
    expect(src).toMatch(/\[contacts, anonymise\]/);
  });
});

describe("no module re-introduces a hand-typed masking placeholder", () => {
  it("a local placeholder literal would be caught whatever its dot count", () => {
    // The stronger form of the check in anonymiseDisplay.test.js, applied here
    // as a backstop. The original bug was a FIVE-dot placeholder next to the
    // shared FOUR-dot one, which the exact-literal check did not match.
    const local = /["'][•*\.][^"']*hidden["']/;
    const offenders = [];
    for (const f of fs.readdirSync(MODULES)) {
      if (!f.endsWith(".jsx")) continue;
      if (local.test(read(f))) offenders.push(f);
    }
    expect(offenders, offenders.join(", ")).toEqual([]);
  });
});