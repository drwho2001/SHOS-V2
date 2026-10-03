import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
// ADDED 3 Oct 2026 - explicit timeout for this guard.
//
// It walks all of src/ and runs @babel/parser over every .jsx on every run, so
// it is a real AST sweep rather than an assertion over a string. Vitest's 5s
// default is not a budget for that work: under full-suite load on this machine
// (measured at 327-674 MB free) these guards timed out and reported a failure
// of an assertion they were never evaluating. Two were fixed individually
// before the pattern was recognised; all of them are now handled together,
// because a fix scoped to the one that happened to go red is not a fix to the
// class.
//
// Measured, not guessed: run this file alone and divide the reported test
// duration by its test count before raising this further.


// Detects TEMPORAL DEAD ZONE crashes: a component-scope `const`/`let` that is
// READ before its own declaration.
//
// This is the THIRD such bug in this codebase, found on a real phone as
// "Cannot access 'D' before initialization" - the single letter being the
// minified name of the offending `const`. The earlier two shipped too, which is
// why this exists rather than a one-line fix.
//
// WHY IT IS INVISIBLE TO THE USUAL TOOLS: it is not a lint error, not a build
// error, and not a unit-test failure in the parts that are tested. It only fires
// when the specific component MOUNTS, and only on a bundled build, because
// unbundled code throws a readable name. The smoke suite passed throughout.
//
// WHY IT IS EASY TO MISS ON REVIEW: a dependency array is evaluated EAGERLY on
// every render, so writing `[a, b]` where `b` is declared 40 lines below is a
// live read on the very first render - not a deferred reference inside a
// callback that would happen to work.

const SRC = path.resolve("src");

function jsxFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) jsxFiles(p, out);
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const c of node) walk(c, visit);
    return;
  }
  if (typeof node.type !== "string") return;
  visit(node);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
    walk(node[k], visit);
  }
}

// Collect every identifier that is referenced, and every const/let that is
// declared, within one function body - then report references that occur
// before their declaration. Restricted to a single function body because a
// reference inside a NESTED function only runs when called, which is legal and
// extremely common (a callback firing after the component has mounted).
function findTdzInFunctionBody(fn) {
  const readBefore = [];
  const body = fn.body;
  if (!body || !Array.isArray(body.body)) return readBefore;

  // SCOPE-AWARE, unlike a flat "declared anywhere in the function" map.
  // Two sibling blocks may each declare `const closest`; that is legal, because
  // each is scoped to its own block. A flat map reported both as
  // use-before-declaration, which is how SymptomLog produced two false
  // positives. A name resolves to the INNERMOST enclosing block that declares
  // it, and the ordering check happens within that block only.
  const readBefore2 = [];

  const handleBlock = (block, parentScopes) => {
    const scope = new Map(); // name -> line, declared directly in THIS block
    const scopes = [...parentScopes, scope];

    // Declare everything directly in this block first.
    for (const stmt of block.body) {
      if (stmt.type === "VariableDeclaration") {
        for (const d of stmt.declarations) collectBindingNames(d.id).forEach((nm) => {
          if (!scope.has(nm)) scope.set(nm, stmt.loc?.start?.line ?? 0);
        });
      } else if (
        (stmt.type === "FunctionDeclaration" || stmt.type === "ClassDeclaration") &&
        stmt.id?.name
      ) {
        if (!scope.has(stmt.id.name)) scope.set(stmt.id.name, stmt.loc?.start?.line ?? 0);
      }
    }

    const seen = new Set();
    const rec = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        for (const c of n) rec(c);
        return;
      }
      if (typeof n.type !== "string") return;

      // Nested functions run after this render: a reference inside them is
      // legal regardless of where the declaration sits.
      if (
        n.type === "ArrowFunctionExpression" ||
        n.type === "FunctionExpression" ||
        n.type === "FunctionDeclaration" ||
        n.type === "ObjectMethod" ||
        n.type === "ClassMethod" ||
        n.type === "ClassProperty"
      ) {
        return;
      }

      // `foo.map(...)` and `list?.items` name a PROPERTY, not a variable.
      // OptionalMemberExpression is a separate node type and forgetting it
      // reported `items read at L389` for `list?.items` on the very next line.
      if (
        (n.type === "MemberExpression" || n.type === "OptionalMemberExpression") &&
        !n.computed &&
        n.property?.type === "Identifier"
      ) {
        rec(n.object);
        return;
      }
      // `{ vaccinations: true }` - a plain key is not a read. Only SHORTHAND
      // (`{ vaccinations }`) and computed keys are.
      if (
        n.type === "ObjectProperty" &&
        !n.shorthand &&
        !n.computed &&
        n.key?.type === "Identifier"
      ) {
        rec(n.value);
        return;
      }
      // Destructuring targets are declarations, not reads.
      if (
        (n.type === "VariableDeclarator" && n.id?.type === "ObjectPattern") ||
        (n.type === "VariableDeclarator" && n.id?.type === "ArrayPattern")
      ) {
        rec(n.init);
        return;
      }
      if (n.type === "VariableDeclarator" && n.id?.type === "Identifier") {
        rec(n.init);
        return;
      }
      // A `for (const x of xs)` head binds x in its own scope, so `xs` in the
      // head is a genuine read and `x` is not reported.
      if (n.type === "ForOfStatement" || n.type === "ForInStatement") {
        if (n.right) rec(n.right);
        rec(n.body);
        return;
      }

      if (n.type === "Identifier") {
        const line = n.loc?.start?.line ?? 0;
        for (let i = scopes.length - 1; i >= 0; i--) {
          const declLine = scopes[i].get(n.name);
          if (declLine !== undefined) {
            if (line < declLine) {
              const key = `${n.name}@${line}`;
              if (!seen.has(key)) {
                seen.add(key);
                readBefore2.push({ name: n.name, readAt: line, declaredAt: declLine });
              }
            }
            return; // innermost scope wins
          }
        }
        return;
      }

      // Descend, pushing a scope for each new block.
      if (n.type === "BlockStatement" && n !== block) {
        handleBlock(n, scopes);
        return;
      }
      if (n.type === "BlockStatement") {
        for (const k of Object.keys(n)) {
          if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
          rec(n[k]);
        }
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
        rec(n[k]);
      }
    };

    for (const stmt of block.body) rec(stmt);
  };

  function collectBindingNames(node) {
    if (!node) return [];
    if (node.type === "Identifier") return [node.name];
    if (node.type === "ObjectPattern")
      return node.properties.flatMap((p) => (p.type === "RestElement" ? collectBindingNames(p.argument) : collectBindingNames(p.value)));
    if (node.type === "ArrayPattern") return node.elements.flatMap((e) => collectBindingNames(e));
    if (node.type === "AssignmentPattern") return collectBindingNames(node.left);
    if (node.type === "RestElement") return collectBindingNames(node.argument);
    return [];
  }

  handleBlock(body, []);
  readBefore.push(...readBefore2);
  return readBefore;
}

function walkSkippingNested(node, visit) {
  const rec = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const c of n) rec(c);
      return;
    }
    if (typeof n.type !== "string") return;
    const skip =
      n.type === "ArrowFunctionExpression" ||
      n.type === "FunctionExpression" ||
      n.type === "FunctionDeclaration" ||
      n.type === "ObjectMethod" ||
      n.type === "ClassMethod";
    if (skip) {
      // still visit the declaration line for function declarations, handled elsewhere
      if (n.type !== "FunctionDeclaration") return;
    }
    visit(n);
    for (const k of Object.keys(n)) {
      if (k === "loc") continue;
      if (skip && n.type === "FunctionDeclaration" && k !== "id") continue;
      rec(n[k]);
    }
  };
  rec(node);
}

function findTdz(file) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return [];
  }
  const out = [];
  walk(ast, (n) => {
    if (
      n.type !== "ArrowFunctionExpression" &&
      n.type !== "FunctionExpression" &&
      n.type !== "FunctionDeclaration"
    )
      return;
    if (!n.body || n.body.type !== "BlockStatement") return;
    const hits = findTdzInFunctionBody(n);
    for (const h of hits) {
      out.push({ ...h, fn: n.id?.name ?? "(anonymous)", at: n.loc?.start?.line ?? 0 });
    }
  });
  return out;
}

const FILES = jsxFiles(SRC);
const FINDINGS = FILES.map((f) => ({ file: path.relative(SRC, f).replace(/\\/g, "/"), hits: findTdz(f) })).filter(
  (r) => r.hits.length > 0,
);

describe("no component reads a const before declaring it (t069)", () => {
  it("the detector catches a real use-before-declaration", () => {
    // Non-vacuity against a THROWAWAY file, so the proof survives the last
    // real fix. Asserting "there is at least one finding" would demand the
    // bug stay present.
    const fixture = path.join(SRC, "__tdzFixture.jsx");
    const bad =
      "export default function Bad() {\n" +
      "  const a = useMemo(() => later(), [later]);\n" +
      "  const later = 1;\n" +
      "  return <div>{a}</div>;\n" +
      "}\n";
    const good =
      "export default function Good() {\n" +
      "  const later = 1;\n" +
      "  const a = useMemo(() => later(), [later]);\n" +
      "  return <div>{a}</div>;\n" +
      "}\n";
    try {
      fs.writeFileSync(fixture, bad, "utf8");
      const badHits = findTdz(fixture);
      expect(badHits.length, "detector missed a genuine use-before-declaration").toBeGreaterThanOrEqual(1);
      expect(badHits[0].name).toBe("later");
      fs.writeFileSync(fixture, good, "utf8");
      expect(findTdz(fixture)).toHaveLength(0);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  }, 30000);

  it("NO component anywhere reads a const before declaring it", () => {
    // Asserted globally, not per named file. The first version of this guard
    // only asserted on SHOS_MyProfile_Prototype.jsx, which meant re-breaking the
    // ClinicVisits one - found in the same round, and reintroduced by a
    // mutation here - passed the suite silently. That is precisely the
    // per-file-assertion weakness that let this bug class survive four times
    // already: a guard that watches one known case does not watch the class.
    //
    // Zero is the right invariant, unlike the flex-container guard where a
    // finding can be legitimate: a use-before-declaration is ALWAYS a crash.
    const summary = FINDINGS.flatMap((r) =>
      r.hits.map((h) => `${r.file} ${h.fn}(): ${h.name} read at L${h.readAt}, declared at L${h.declaredAt}`),
    );
    console.log("\n  use-before-declaration sites: " + summary.length);
    for (const s of summary) console.log("    " + s);
    expect(summary, "these read a const before declaring it, which crashes on a bundled build").toEqual([]);
  }, 30000);
});