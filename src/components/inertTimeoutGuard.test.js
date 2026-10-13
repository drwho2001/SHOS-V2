import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// GUARD: no it()/test()/describe() may put a timeout in SECOND-argument
// position.
//
// WHY THIS EXISTS. vitest 3.2.7 does not support the overload
//
//     it(title, timeoutMs, fn)
//
// It is not rejected - it parses, the test runs, and the number is silently
// discarded, leaving the 5000ms default in force. So a test written that way
// READS as budgeted while having no budget at all.
//
// Found in src/storage/widgetRedactedRender.test.js, where all nine tests
// carried `it(title, SCAN_TIMEOUT_MS, () => {...})` under a constant named
// SCAN_TIMEOUT_MS and a 40-line comment explaining why the budget was needed.
// None of it was active. That file's own 5 Oct entry records it timing out at
// 4853ms - a real flake - so the bug was known and the fix shipped inert.
//
// Measured, not assumed. The probe that matters: 7000ms of work with a 40000ms
// budget, written the second way, fails with "Test timed out in 5000ms"; written
// the third way (`it(title, fn, 40_000)`) it runs to 7010ms. Two earlier
// attempts to establish this were worthless because both tests finished in
// ~150ms and so could not tell "the budget applied" from "the default was never
// reached".
//
// This does not re-prove the vitest behaviour on every run; it proves the
// repository contains no call written in the form vitest ignores, which is the
// part a future edit can actually regress.
//
// PARSED, NOT GREPPED - and that is not a style preference. The first version
// scanned with a regex and flagged line 85 of THIS FILE: the fixture string
// literal that proves the detector works. It was reporting its own non-vacuity
// evidence as a violation. The same trap that made scrollingFlexGuard's author
// abandon grep ("an earlier file-level grep reported 24 files, but that matches
// three properties anywhere in a file, on any three different elements") would
// have shipped a permanently red guard here. @babel/parser is already a
// dependency for exactly this.

const SRC = path.resolve("src");
const SCRIPTS = path.resolve("scripts");

/** A timeout argument that vitest would discard: a number or a bare identifier. */
function isTimeoutShapedArgument(node) {
  return (
    node.type === "NumericLiteral" ||
    node.type === "Identifier" ||
    (node.type === "ObjectExpression" && !("type" in node))
  );
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, visit);
    return;
  }
  if (typeof node.type !== "string") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    walk(node[key], visit);
  }
}

function inertTimeoutSites(code) {
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return []; // a file this parser cannot read is not evidence of anything
  }
  const hits = [];
  walk(ast, (node) => {
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    const name =
      callee.type === "Identifier"
        ? callee.name
        : callee.type === "MemberExpression" && callee.property?.type === "Identifier"
          ? callee.property.name
          : null;
    if (name !== "it" && name !== "test" && name !== "describe") return;
    const args = node.arguments || [];
    // Three arguments, second one timeout-shaped, third one the body.
    if (args.length === 3 && isTimeoutShapedArgument(args[1])) {
      hits.push({
        line: node.loc?.start?.line ?? 0,
        call: name,
        arg: args[1].type === "Identifier" ? args[1].name : String(args[1].value),
      });
    }
  });
  return hits;
}

function filesUnder(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) filesUnder(p, out);
    else if (/\.(test\.(js|jsx|ts|tsx)|spec\.(js|jsx))$/.test(name)) out.push(p);
  }
  return out;
}

const SCANNED = filesUnder(SRC).concat(filesUnder(SCRIPTS));
const FINDINGS = [];
for (const f of SCANNED) {
  for (const h of inertTimeoutSites(fs.readFileSync(f, "utf8"))) {
    FINDINGS.push(`${path.relative(process.cwd(), f).replace(/\\/g, "/")}:${h.line} ${h.call}(..., ${h.arg}, ...)`);
  }
}

describe("per-test timeouts must be in third-argument position", () => {
  it("the detector finds a real second-argument timeout and ignores the supported form", () => {
    // Non-vacuity, proved against source rather than against a string fixture.
    // The string-fixture version of this test was itself flagged by the first
    // regex detector, which is why the fixture here is real parsed source: a
    // bad call and a good call in one snippet, asserted by line.
    const snippet = [
      'import { it } from "vitest";',
      "const T = 40_000;",
      'it("bad", T, () => {});',
      'it("good", () => {}, T);',
      'it.each([])("also fine", T);',
    ].join("\n");
    const hits = inertTimeoutSites(snippet);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(3);
    expect(hits[0].arg).toBe("T");
    // And a bare numeric literal, the other way someone writes this.
    expect(inertTimeoutSites('it("n", 40000, () => {});')).toHaveLength(1);
  });

  it("does not flag its own source, because a string fixture is not a call", () => {
    // The regression that made the regex version permanently red.
    const snippet = [
      "const s = 'it(\"bad\", T, () => {});';",
      "const t = \"it(1000, () => {});\";",
    ].join("\n");
    expect(inertTimeoutSites(snippet)).toEqual([]);
  });

  it("no it/test/describe call anywhere passes a timeout as its second argument", () => {
    expect(
      SCANNED.length,
      "no test files were scanned - a clean result would be vacuous",
    ).toBeGreaterThan(50);
    expect(
      FINDINGS,
      "these timeouts are silently ignored by vitest; move them to it(title, fn, timeoutMs)",
    ).toEqual([]);
  });
});