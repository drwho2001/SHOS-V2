// ADDED 7 Oct 2026 (session B) - the guard for the file that has destroyed this
// owner's data twice.
//
// WHY THIS FILE EXISTS. `clearSampleData.js`'s SAMPLE_REPOSITORIES is a
// hand-maintained list of "the repositories that hold demo data", written out as
// [label, repository, SEED_*_IDS] triples. It is the single authority for what
// "Clear sample data" counts, what it removes, and what the Home first-run
// banner and the Developer Tools panel report.
//
// If it drifts, nothing throws. A seed-bearing repository missing from the list
// simply is not counted and is not cleared, and both the banner and the panel
// carry on reporting a confident, wrong number. This is the same shape as the
// orphan-checker gap that shipped in this session - four live reference fields
// checked by nothing - and as t070 six days before it, where the seed-snapshot
// regenerator read 11 of 14 repositories because its own list was hand-written.
//
// MEASURED, so this is not a fix. At the time of writing all 14 repositories
// that export a SEED_*_IDS set are referenced by clearSampleData.js, with none
// extra and none missing. That is exactly why the guard is worth having: the
// list is correct by hand today, and correct by hand is not a property.
//
// AST, NOT REGEX. This repo has damaged itself with regex-over-source four
// times, and this file's own header is the fourth instance, measured during the
// change it belongs to: a grep for `medicationsPrescribedIds` matched a COMMENT
// describing a field that had been restructured three weeks earlier, and produced
// two of the three "missing fields" first reported as measured. `SEED_*_IDS` is
// named in clearSampleData.js's own comments, so a substring scan would find
// those instead of the real references. This parses, and looks at real
// ArrayExpression elements.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// ADDED 7 Oct 2026 - explicit timeout, same reason and same measured
// justification as jsxCommentGuard.test.js and orphanReferenceCoverage.test.js:
// this is a real AST sweep over every repository on every run, and vitest's 5s
// default is not a budget for that work. A guard that times out reports a
// failure of an assertion it was never evaluating.
const AST_SWEEP_TIMEOUT_MS = 30000;

const SRC = path.resolve("src");
const REPO_DIR = path.join(SRC, "repositories");
const CLEAR_SAMPLE = path.join(REPO_DIR, "clearSampleData.js");

// Below this, a clean comparison means the sweep found nothing rather than that
// the lists agree. 14 repositories export a SEED_*_IDS set today.
const MIN_SEED_EXPORTERS = 10;

function repositoryFiles() {
  return fs
    .readdirSync(REPO_DIR)
    .filter((f) => f.endsWith(".js") && !f.includes(".test."))
    .map((f) => path.join(REPO_DIR, f));
}

// Every SEED_*_IDS set exported by a repository, found on real AST nodes rather
// than by matching the name.
//
// The node type matters and getting it wrong is silent: `export const X = ...`
// parses as an ExportNamedDeclaration whose `declaration` is a
// VariableDeclaration - a CONTAINER of declarators - not a VariableDeclarator.
// A first version of this collector checked for VariableDeclarator there,
// matched nothing, and reported zero exporters, which the non-vacuity floor
// below caught. That floor is not decoration: it is the only reason a sweep that
// reads the wrong node type fails loudly instead of passing for agreement.
function collectSeedIdExports() {
  const found = new Map();
  for (const file of repositoryFiles()) {
    const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", errorRecovery: true });
    for (const node of ast.program.body) {
      if (node.type !== "ExportNamedDeclaration" || !node.declaration) continue;
      const decl = node.declaration;
      if (decl.type !== "VariableDeclaration") continue;
      for (const d of decl.declarations || []) {
        const name = d.id?.name;
        if (!name || !/^SEED_[A-Z_]+_IDS$/.test(name)) continue;
        found.set(name, path.basename(file));
      }
    }
  }
  return found;
}

// The SEED_*_IDS names clearSampleData.js actually REFERENCES - read off the
// third element of each SAMPLE_REPOSITORIES triple, because that is the position
// that decides whether the collection is cleared, and a name mentioned anywhere
// else in the file is not the same claim.
function collectSampleDataSeedIds() {
  const src = fs.readFileSync(CLEAR_SAMPLE, "utf8");
  const ast = parse(src, { sourceType: "module", errorRecovery: true });
  const referenced = new Set();
  let sawList = false;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclarator" && node.id?.name === "SAMPLE_REPOSITORIES" && node.init?.type === "ArrayExpression") {
      sawList = true;
      for (const el of node.init.elements || []) {
        if (el?.type !== "ArrayExpression") continue;
        const third = el.elements?.[2];
        if (third?.type === "Identifier" && /^SEED_[A-Z_]+_IDS$/.test(third.name)) referenced.add(third.name);
      }
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const c = node[k];
      if (Array.isArray(c)) c.forEach(walk);
      else if (c && typeof c === "object") walk(c);
    }
  };
  walk(ast.program);
  // A miss here would make both assertions below pass for the wrong reason, so
  // it is a failure rather than something to work around.
  if (!sawList) throw new Error("SAMPLE_REPOSITORIES was not found - the sweep found nothing");
  return referenced;
}

describe("clearSampleData's repository list stays in sync with who has demo data", () => {
  it("finds both lists, so an empty sweep cannot pass as agreement", () => {
    const exported = collectSeedIdExports();
    const referenced = collectSampleDataSeedIds();
    expect(exported.size, "the exporter sweep found nothing").toBeGreaterThanOrEqual(MIN_SEED_EXPORTERS);
    expect(referenced.size, "the SAMPLE_REPOSITORIES sweep found nothing").toBeGreaterThanOrEqual(MIN_SEED_EXPORTERS);
  }, AST_SWEEP_TIMEOUT_MS);

  it("covers every repository that exports demo ids", () => {
    const exported = collectSeedIdExports();
    const referenced = collectSampleDataSeedIds();
    const missing = [...exported.keys()].filter((n) => !referenced.has(n)).sort();
    expect(
      missing,
      "these collections are never counted and never cleared, so \"Clear sample data\" under-delivers while still reporting a confident number",
    ).toEqual([]);
  }, AST_SWEEP_TIMEOUT_MS);

  it("references nothing that was renamed away", () => {
    const exported = collectSeedIdExports();
    const referenced = collectSampleDataSeedIds();
    // checkArray and its neighbours all tolerate a missing entry, so a renamed
    // set that is still referenced here does not fail - it just stops
    // clearing that collection. Same shape as the `ids || []` dead check the
    // orphan checker had.
    const stale = [...referenced].filter((n) => !exported.has(n)).sort();
    expect(stale, `these reference a SEED_*_IDS set nothing exports any more: ${stale.join(", ")}`).toEqual([]);
  }, AST_SWEEP_TIMEOUT_MS);
});
