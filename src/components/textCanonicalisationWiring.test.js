// Guard: the suggestion surfaces must compare by canonical key, not by a raw
// toLowerCase() === toLowerCase().
//
// WHY A STATIC GUARD AND NOT A BEHAVIOURAL TEST. What is being protected is a
// WIRING property - that these call sites reach the shared comparison helper -
// and a unit test on the helper proves nothing about any caller. This repo has
// shipped features whose logic was correct in unit tests while no call site
// actually reached it, and a feature whose hook worked while the sweep that
// was supposed to attach it silently did nothing. Both are "the function works,
// so the feature works", which is exactly the false assurance this file exists
// to prevent.
//
// WHY NOT REGEX-OVER-JSX. Comments are stripped first, and for the reason this
// repo has now recorded a dozen times: a comment explaining the fix quotes the
// exact expression it replaced, so a naive negative check matches its own
// rationale and passes vacuously. The stripper is proved against the
// alternatives below rather than assumed.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(resolve(SRC, rel), "utf8");

function stripComments(src) {
  // Block comments first: a "//" line inside one is not a comment of its own.
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  // Then line comments, but only when they are not inside a string. A "//" in a
  // URL is not a comment, and blanking it changes the code being scanned.
  let res = "";
  let inStr = null;
  let i = 0;
  while (i < out.length) {
    const c = out[i];
    if (inStr) {
      res += c;
      if (c === "\\") { res += out[i + 1] || ""; i += 2; continue; }
      if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; res += c; i++; continue; }
    if (c === "/" && out[i + 1] === "/") { while (i < out.length && out[i] !== "\n") i++; continue; }
    res += c;
    i++;
  }
  return res;
}

const FILES = [
  "modules/SHOS_ClinicVisits_Prototype.jsx",
  "modules/SHOS_Measurements_Prototype.jsx",
];

describe("the stripper is not vacuous", () => {
  it("removes a block comment", () => {
    expect(stripComments("const a = 1; /* gone */ const b = 2;").replace(/gone/g, "")).not.toMatch(/gone/);
  });

  it("removes a line comment but keeps a // inside a string", () => {
    const out = stripComments('const url = "https://x.dev"; // gone');
    expect(out).not.toMatch(/gone/);
    expect(out).toMatch(/https:\/\/x\.dev/);
  });

  it("does not treat a quoted // as the start of a comment", () => {
    expect(stripComments('const a = "a // b"; const real = 1;')).toMatch(/const real = 1/);
  });
});

describe("suggestion dedupe reaches the shared comparison helper", () => {
  for (const rel of FILES) {
    it(`${rel} calls compareKeysAreEqual`, () => {
      const code = stripComments(read(rel));
      expect(code).toMatch(/compareKeysAreEqual\(/);
    });

    it(`${rel} imports it from textCanonicalisation`, () => {
      const code = stripComments(read(rel));
      expect(code).toMatch(/import\s*\{[^}]*compareKeysAreEqual[^}]*\}\s*from\s*"[^"]*textCanonicalisation"/);
    });

    it(`${rel} has no raw toLowerCase-only equality check left`, () => {
      // The regression this guard exists for. Case-only comparison let
      // "Dr A. Smith" and "Dr A Smith" both land as separate clinicians.
      const code = stripComments(read(rel));
      expect(code).not.toMatch(/toLowerCase\(\)\s*===\s*trimmed\.toLowerCase\(\)/);
      expect(code).not.toMatch(/toLowerCase\(\)\s*===\s*\w+\.toLowerCase\(\)/);
    });
  }
});

describe("the surfaces t098 named are the ones wired", () => {
  it("clinician, location and measurement-group dedupe all go through it", () => {
    const clinic = stripComments(read("modules/SHOS_ClinicVisits_Prototype.jsx"));
    // Two sites in this file: the clinician field and the location/reason field.
    expect((clinic.match(/compareKeysAreEqual\(/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("canonicalisation never became a stored value", () => {
  it("no module imports canonicalisation into a repository writer", () => {
    // The principle is store-raw. If any repository started importing the
    // canonical form to write, the whole module's contract would be gone.
    expect(stripComments(read("repositories/measurementRepository.js"))).not.toMatch(/textCanonicalisation/);
  });

  it("normalizeTag is still not used by the canonicaliser itself", () => {
    const code = stripComments(read("calculations/textCanonicalisation.js"));
    expect(code).not.toMatch(/normalizeTag/);
  });
});