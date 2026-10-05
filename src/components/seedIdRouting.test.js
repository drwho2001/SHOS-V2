// seedIdRouting.test.js
//
// WHY THIS FILE EXISTS
// --------------------
// MenstrualHealth's `tabForRecordId(id)` decides which inner tab a deep link
// opens by testing the record id's PREFIX:
//
//   id.startsWith("cycle_")      -> "cycle"
//   id.startsWith("contra_")     -> "contraception"
//   id.startsWith("pregnancy_")  -> "pregnancy"
//
// The 3a seed re-key changed demo ids from `cycle_001` to `seed_cycle_9001`,
// and `"seed_cycle_9001".startsWith("cycle_")` is FALSE. So a Global Search
// result pointing at a seeded cycle/contraception/pregnancy record silently
// arrived at Healthcare with no inner tab selected.
//
// Nothing else in the suite would have caught that: the three affected
// collections are all EMPTY in the real owner's data (he does not track
// menstrual health), so no seed record ever renders, and the deep-link path is
// only reachable with a recordId in hand. It was found by reading the code, not
// by a failing test - which is the situation this file exists to make
// impossible.
//
// This asserts the BEHAVIOUR through the real function, not a copy of it, so a
// future prefix change has to be made here too rather than passing silently.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";

const SRC = join(process.cwd(), "src", "modules", "SHOS_MenstrualHealth_Prototype.jsx");

// Extracted and evaluated so the REAL implementation is under test. A copy
// would keep passing after the original broke, which is the failure mode this
// repo has recorded repeatedly.
function loadTabForRecordId() {
  const code = readFileSync(SRC, "utf8");
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  for (const node of ast.program.body) {
    if (node.type !== "FunctionDeclaration") continue;
    if (node.id?.name !== "tabForRecordId") continue;
    const src = code.slice(node.start, node.end);
    // Return the FUNCTION, not the result of calling it. This is the whole
    // point: the real implementation is under test, so a later edit to
    // tabForRecordId changes what these assertions measure.
    return new Function("return (" + src + ")")();
  }
  throw new Error("tabForRecordId not found in SHOS_MenstrualHealth_Prototype.jsx");
}

const tabForRecordId = loadTabForRecordId();

describe("tabForRecordId routes on the record id prefix", () => {
  it("routes a user-created cycle record", () => {
    expect(tabForRecordId("cycle_001")).toBe("cycle");
  });

  it("routes a user-created contraception record", () => {
    expect(tabForRecordId("contra_002")).toBe("contraception");
  });

  it("routes a user-created pregnancy record", () => {
    expect(tabForRecordId("pregnancy_001")).toBe("pregnancy");
  });

  // THE REGRESSION THIS FILE EXISTS FOR.
  it("routes a SEEDED cycle record, whose id gained the seed_ prefix", () => {
    // Before the fix this returned null, because startsWith("cycle_") is false
    // for "seed_cycle_9001". A Global Search hit on a seeded record reached
    // Healthcare with no tab selected.
    expect(tabForRecordId("seed_cycle_9001")).toBe("cycle");
  });

  it("routes a SEEDED contraception record", () => {
    expect(tabForRecordId("seed_contra_9001")).toBe("contraception");
  });

  it("routes a SEEDED pregnancy record", () => {
    expect(tabForRecordId("seed_pregnancy_9001")).toBe("pregnancy");
  });

  it("still returns null for an id it does not own", () => {
    expect(tabForRecordId("contact_001")).toBeNull();
    expect(tabForRecordId("test_001")).toBeNull();
  });

  it("still returns null for no id at all", () => {
    expect(tabForRecordId(null)).toBeNull();
    expect(tabForRecordId(undefined)).toBeNull();
    expect(tabForRecordId("")).toBeNull();
  });
});

describe("the seeded ids this depends on really do carry the seed_ prefix", () => {
  // Ties the routing test to the actual seed data. If a future change re-keys
  // seeds again, this fails and says so, rather than the routing test silently
  // covering a shape that no longer exists.
  it("the three menstrual seed arrays use seed_cycle_/seed_contra_/seed_pregnancy_ ids", () => {
    const checks = [
      { file: "menstrualCycleRepository.js", array: "seedCycles", expect: /^seed_cycle_\d+$/ },
      { file: "contraceptionRepository.js", array: "seedEntries", expect: /^seed_contra_\d+$/ },
      { file: "pregnancyRepository.js", array: "seedPregnancies", expect: /^seed_pregnancy_\d+$/ },
    ];
    const problems = [];
    let total = 0;
    for (const { file, array, expect: shape } of checks) {
      const code = readFileSync(join(process.cwd(), "src", "repositories", file), "utf8");
      const ast = parse(code, { sourceType: "module" });
      let found = null;
      for (const node of ast.program.body) {
        if (node.type !== "VariableDeclaration") continue;
        for (const d of node.declarations) {
          if (d.id.name === array && d.init?.type === "ArrayExpression") found = d.init;
        }
      }
      if (!found) { problems.push(`${file}: array ${array} not found`); continue; }
      const ids = [];
      for (const el of found.elements) {
        if (el?.type !== "ObjectExpression") continue;
        for (const p of el.properties) {
          if (p.type !== "ObjectProperty") continue;
          const k = p.key.type === "Identifier" ? p.key.name : p.key.value;
          if (k === "id" && p.value.type === "StringLiteral") ids.push(p.value.value);
        }
      }
      total += ids.length;
      const bad = ids.filter((i) => !shape.test(i));
      if (bad.length) problems.push(`${file}: ${bad.join(", ")}`);
    }
    expect(total, "expected seed records across the three collections").toBeGreaterThan(0);
    expect(problems, problems.join("; ")).toEqual([]);
  });
});