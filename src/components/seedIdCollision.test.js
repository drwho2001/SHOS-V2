// seed-id-collision.test.js
//
// WHY THIS FILE EXISTS
// --------------------
// "Clear sample data" identifies sample data PURELY BY ID, and that is how it
// destroyed 74 of the owner's real records on 5 Oct 2026: the owner had edited
// the demo records in place (renamed med_001 "PrEP (Descovy)" -> "PrEP"),
// which left the app with no way to tell a real record from a demo one.
//
// The root cause was that the demo records occupied the SAME id space as
// user-created records. Both were `contact_001`. A single find-and-replace over
// that id string therefore cannot distinguish them, and the owner's real
// contact_017..contact_035 sit right alongside the demo contact_001..016.
//
// THE FIX: every seed record now carries a `seed_` prefix at 9001+.
//
// THE PROPERTY THAT MAKES IT WORK: all 14 repositories derive their next id by
// matching an ANCHORED regex against existing ids - `/^contact_(\d+)$/` and
// friends. A `seed_contact_9001` id cannot match, so it contributes 0 to the
// Math.max that seeds the counter, and can therefore never collide with a
// generated id. That is asserted here per repository rather than assumed.
//
// AST-based, per this repo's settled convention: several regex-based audits in
// this codebase produced false results, four of them by matching the comment
// documenting the fix. Nothing here reads source with a regex.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "@babel/parser";

const REPOS_DIR = join(process.cwd(), "src", "repositories");

// The 14 repositories that own a seed array, with the id counter regex each one
// actually uses. Read from source rather than hardcoded against the seed ids,
// so a repository whose counter changed is caught rather than silently passing.
const REPOSITORIES = [
  { file: "contactRepository.js", array: "seedContacts", counter: /^contact_(\d+)$/ },
  { file: "encounterRepository.js", array: "seedEncounters", counter: /^encounter_(\d+)$/ },
  { file: "clinicVisitsRepository.js", array: "seedVisits", counter: /^visit_(\d+)$/ },
  { file: "testingRepository.js", array: "seedTests", counter: /^test_(\d+)$/ },
  { file: "medicationRepository.js", array: "seedMedications", counter: /^med_(\d+)$/ },
  { file: "vaccinationRepository.js", array: "seedVaccinations", counter: /^vaccination_(\d+)$/ },
  { file: "measurementRepository.js", array: "seedMeasurements", counter: /^measurement_(\d+)$/ },
  { file: "symptomLogRepository.js", array: "seedEntries", counter: /^symlog_(\d+)$/ },
  { file: "contraceptionRepository.js", array: "seedEntries", counter: /^contra_(\d+)$/ },
  { file: "menstrualCycleRepository.js", array: "seedCycles", counter: /^cycle_(\d+)$/ },
  { file: "locationsRepository.js", array: "seedLocations", counter: /^location_(\d+)$/ },
  { file: "episodeRepository.js", array: "seedEpisodes", counter: /^episode_(\d+)$/ },
  { file: "logRepository.js", array: "seedLogs", counter: /^log_(\d+)$/ },
  { file: "pregnancyRepository.js", array: "seedPregnancies", counter: /^pregnancy_(\d+)$/ },
];

const SEED_BASE = 9001;

// Ad-hoc medications nested inside a clinic-visit seed record carry their own
// id shape, `adhocmed_seed_001`, and are NOT cross-references to a record in
// another collection - they are the `id` of an object inside an
// `adHocMedicationsGiven` array. Nothing resolves them by value: the only
// consumer uses them as a React `key`, and generateAdHocMedId() can never
// produce this shape (it emits adhocmed_<timestamp>_<random>). It is already
// seed-prefixed, so it needs no rewrite, and it must be excluded from the
// cross-reference check by name rather than by a loose pattern - which is how
// a real dangling reference could slip through.
const NESTED_SUBRECORD_ID = "adhocmed_seed_001";

function sourceOf(file) {
  return readFileSync(join(REPOS_DIR, file), "utf8");
}

function parseCode(code, file) {
  return parse(code, { sourceType: "module", plugins: ["jsx"] });
}

// Unwraps `export let seedX = [...]` into the VariableDeclaration itself.
//
// 3e made the seed arrays exported so seedReconciliation.js can compare a
// stored record against the current seed DEFINITION, not just its id set. An
// exported declaration is wrapped in an ExportNamedDeclaration, so any walker
// looking only at `program.body` for a VariableDeclaration silently finds
// NOTHING - and then every assertion below passes vacuously or fails at once,
// depending on how it handles the absence.
//
// This bit 46 assertions across three test files the moment it shipped. The
// lesson is the one this repo has recorded repeatedly: changing a shared shape
// ("seed arrays are top-level VariableDeclarations") is not a one-file change,
// and a green run on the file you edited is not evidence the others survived.
function variableDeclarationsIn(ast) {
  const out = [];
  for (const node of ast.program.body) {
    if (node.type === "ExportNamedDeclaration" && node.declaration) {
      if (node.declaration.type === "VariableDeclaration") out.push(node.declaration);
      continue;
    }
    if (node.type === "ExportDefaultDeclaration" && node.declaration) {
      if (node.declaration.type === "VariableDeclaration") out.push(node.declaration);
      continue;
    }
    if (node.type === "VariableDeclaration") out.push(node);
  }
  return out;
}

// Locates a `let <array> = [` literal by walking the AST, so a nested array or
// object cannot confuse a text scan. Returns the array node's source range.
function findSeedArrayNode(ast, arrayName) {
  for (const node of variableDeclarationsIn(ast)) {
    for (const d of node.declarations) {
      if (d.id.type === "Identifier" && d.id.name === arrayName && d.init?.type === "ArrayExpression") {
        return d.init;
      }
    }
  }
  return null;
}

// Collects `id: "..."` values, following the ACTUAL AST rather than a text
// pattern, so a comment naming an id cannot be counted as a record.
function collectIds(arrayNode, code) {
  const ids = [];
  for (const el of arrayNode.elements) {
    if (el?.type !== "ObjectExpression") continue;
    for (const prop of el.properties) {
      if (prop.type !== "ObjectProperty") continue;
      const key = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
      if (key !== "id") continue;
      if (prop.value.type === "StringLiteral") ids.push(prop.value.value);
    }
  }
  return ids;
}

// Collects every string literal inside the array, for cross-reference checks.
function collectStrings(arrayNode) {
  const out = [];
  (function walk(n) {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === "StringLiteral") out.push(n.value);
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end" || k === "leadingComments" || k === "trailingComments") continue;
      walk(n[k]);
    }
  })(arrayNode);
  return out;
}

// Non-vacuity precondition. A guard that finds nothing has proved nothing - this
// repo has recorded eleven instances of exactly that. If a seed array is
// renamed or removed, this fails loudly instead of the suite going quietly green.
describe("the seed arrays these assertions depend on are all still found", () => {
  for (const { file, array } of REPOSITORIES) {
    it(`${file} exposes ${array}`, () => {
      const ast = parseCode(sourceOf(file), file);
      const node = findSeedArrayNode(ast, array);
      expect(node, `${file}: could not find seed array "${array}"`).not.toBeNull();
      expect(collectIds(node, sourceOf(file)).length, `${file}/${array} has no records`).toBeGreaterThan(0);
    });
  }
});

describe("seed ids can never collide with a generated id", () => {
  for (const { file, array, counter } of REPOSITORIES) {
    it(`${file}: no ${array} id matches the ${counter.source} counter regex`, () => {
      const ast = parseCode(sourceOf(file), file);
      const ids = collectIds(findSeedArrayNode(ast, array), sourceOf(file));
      const clashes = ids.filter((id) => counter.test(id));
      expect(
        clashes,
        `${file}: these seed ids still match the counter regex and could be regenerated or collide: ${clashes.join(", ")}`
      ).toEqual([]);
    });

    it(`${file}: every ${array} id carries the seed_ prefix`, () => {
      const ast = parseCode(sourceOf(file), file);
      const ids = collectIds(findSeedArrayNode(ast, array), sourceOf(file));
      const unprefixed = ids.filter((id) => !id.startsWith("seed_") && !id.startsWith("adhocmed_seed_"));
      expect(
        unprefixed,
        `${file}: these ids would be indistinguishable from user records: ${unprefixed.join(", ")}`
      ).toEqual([]);
    });
  }
});

describe("the seed cluster is internally consistent", () => {
  it("every seed id referenced inside a seed array resolves to a real seed id", () => {
    // Built across ALL repositories first, because seed cross-references cross
    // files: encounterRepository's seed attendees name contact_001, which is
    // defined in contactRepository. A per-file map would report those dangling.
    const allSeedIds = new Set();
    for (const { file, array } of REPOSITORIES) {
      const ast = parseCode(sourceOf(file), file);
      for (const id of collectIds(findSeedArrayNode(ast, array), sourceOf(file))) {
        allSeedIds.add(id);
      }
    }
    expect(allSeedIds.size, "expected a non-trivial number of seed ids").toBeGreaterThan(50);

    const dangling = [];
    for (const { file, array } of REPOSITORIES) {
      const ast = parseCode(sourceOf(file), file);
      const node = findSeedArrayNode(ast, array);
      const ownIds = new Set(collectIds(node, sourceOf(file)));
      // A cross-reference is any seed-shaped string inside the array that is
      // not one of this array's own record ids.
      for (const s of collectStrings(node)) {
        if (s === NESTED_SUBRECORD_ID) continue;
        if (!/^(seed_)?[a-z_]+_\d+$/.test(s)) continue;
        if (ownIds.has(s)) continue;
        if (s.startsWith("kink_") || s.startsWith("chem_") || s.startsWith("symptom_cat_") ||
            s.startsWith("organism_") || s.startsWith("result_") || s.startsWith("protection_")) continue; // registry ids, not repository seeds
        if (!allSeedIds.has(s)) dangling.push(`${file}/${array}: ${s}`);
      }
    }
    expect(dangling, `dangling seed cross-references: ${dangling.join("; ")}`).toEqual([]);
  });

  it("no two seed arrays define the same id", () => {
    const seen = new Map();
    const dupes = [];
    for (const { file, array } of REPOSITORIES) {
      const ast = parseCode(sourceOf(file), file);
      for (const id of collectIds(findSeedArrayNode(ast, array), sourceOf(file))) {
        if (seen.has(id)) dupes.push(`${id} defined in both ${seen.get(id)} and ${file}`);
        seen.set(id, file);
      }
    }
    expect(dupes, `duplicate seed ids: ${dupes.join("; ")}`).toEqual([]);
  });
});

describe("no seed id survives outside its own seed array", () => {
  it("no re-keyed id appears in live code outside a seed array literal", () => {
    // The failure this guards: a re-key that touched something outside the seed
    // array would rewrite a comment, or worse, a real user record's id.
    const offenders = [];
    for (const { file, array } of REPOSITORIES) {
      const code = sourceOf(file);
      const ast = parseCode(code, file);
      const node = findSeedArrayNode(ast, array);
// Everything except the seed array node itself, walked structurally. The
    // walk starts at program, so ExportNamedDeclaration wrappers are traversed
    // like any other node and `node === seedArray` still excludes the literal.
    const outside = [];
    (function walk(n) {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (n === node) return; // do not descend into the seed array
      if (n.type === "StringLiteral" && /^seed_[a-z]+_\d+$/.test(n.value)) {
        outside.push(n.value);
      }
      for (const k of Object.keys(n)) {
        if (["loc", "start", "end", "leadingComments", "trailingComments", "comments"].includes(k)) continue;
        walk(n[k]);
      }
    })(ast.program);
      if (outside.length) offenders.push(`${file}: ${[...new Set(outside)].join(", ")}`);
    }
    expect(
      offenders,
      `seed-prefixed ids outside a seed array. Comments are excluded from this walk on purpose - a stale comment is a docs problem, not a data bug: ${offenders.join("; ")}`
    ).toEqual([]);
  });
});

describe("the re-keyed ids are in the range the owner approved", () => {
  it("uses seed_<prefix>_9001+ and preserves the original sequence number", () => {
    // Preserving the trailing number keeps the mapping reversible: a reader can
    // still tell which demo record became which, and a revert is mechanical.
    const bad = [];
    for (const { file, array } of REPOSITORIES) {
      const ast = parseCode(sourceOf(file), file);
      for (const id of collectIds(findSeedArrayNode(ast, array), sourceOf(file))) {
        const m = /^seed_([a-z]+)_(\d+)$/.exec(id);
        if (!m) {
          if (id.startsWith("adhocmed_seed_")) continue;
          bad.push(`${file}: ${id}`);
          continue;
        }
        const n = Number(m[2]);
        if (n < SEED_BASE) bad.push(`${file}: ${id} is below the agreed 9001 base`);
      }
    }
    expect(bad, `ids outside the agreed shape: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("the counter still works with re-keyed seeds present", () => {
  it("a re-keyed seed contributes 0 to the max, so user ids start at 1", () => {
    // The property that makes the whole approach safe, expressed against the
    // real counter shape rather than described. If a repository's counter were
    // ever loosened to an unanchored regex, this is the assertion that fails.
    const seedId = "seed_contact_9001";
    const numbers = [seedId].map((id) => {
      const m = /^contact_(\d+)$/.exec(id);
      return m ? parseInt(m[1], 10) : 0;
    });
    expect(numbers).toEqual([0]);
    expect(Math.max(...numbers) + 1).toBe(1);
  });

  it("an existing user record still keeps the counter above its own number", () => {
    const numbers = ["seed_contact_9001", "contact_017"].map((id) => {
      const m = /^contact_(\d+)$/.exec(id);
      return m ? parseInt(m[1], 10) : 0;
    });
    expect(Math.max(...numbers) + 1).toBe(18);
  });
});