// ADDED 2 Oct 2026 - a guard against `//` comments sitting in a JSX CHILDREN
// position, where they are not comments at all.
//
// HOW THIS HAPPENED, because it is the whole point of the guard. Fixing a
// scrolling-flex defect in the Clinic Card, I left an explanatory note directly
// between two JSX elements:
//
//     {/* a neighbouring real JSX comment */}
//     // FIXED 2 Oct 2026 - the scroll container above was ALSO display:flex
//     <div style={{ width: "100%" }}>
//
// In JSX children position `//` carries no special meaning. It is TEXT, and it
// rendered as a paragraph of my own source code above the card's title, in a
// build published to GitHub Releases. eslint passed, the unit suite passed, and
// every measurement I took still "passed" - the scroll container genuinely did
// get taller, so the nav-clearance fix genuinely did work. Only looking at the
// screen on the phone showed it.
//
// So this is NOT a source-scanning heuristic dressed up as a test. It parses
// with @babel/parser and looks at real JSXText nodes, which is the only place
// this mistake is actually observable.
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


const SRC = path.resolve("src");

function jsxFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) jsxFiles(p, out);
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
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    walk(node[key], visit);
  }
}

/**
 * JSXText nodes that begin a line comment. A line comment in JSX renders as
 * literal text, so this is the exact observable of the bug. Indentation is
 * stripped, which is what makes `// ...` at the start of a JSXText detectable.
 */
function jsxTextLineComments(file) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return [];
  }
  const hits = [];
  walk(ast, (node) => {
    if (node.type !== "JSXText") return;
    const raw = node.value ?? "";
    // Only a line comment that STARTS a text run; mid-sentence "//" is prose
    // (e.g. a URL) and is not this bug.
    if (!/^\s*\/\//.test(raw)) return;
    // Several lines of continuous // is the give-away, but a single one is
    // still a rendered comment, so report both and let the count speak.
    const lines = raw.split("\n").filter((l) => /^\s*\/\//.test(l));
    for (const l of lines) {
      hits.push({
        line: node.loc?.start?.line ?? 0,
        text: l.trim().slice(0, 70),
      });
    }
  });
  return hits;
}

describe("no `//` comment sits in a JSX children position", () => {
  it("finds none in any module", () => {
    const offenders = [];
    for (const f of jsxFiles(SRC)) {
      for (const h of jsxTextLineComments(f)) {
        offenders.push(`${path.relative(SRC, f).replace(/\\/g, "/")}:${h.line} ${h.text}`);
      }
    }
    expect(
      offenders,
      "these render as literal text on screen - use {/* ... */} in JSX children position",
    ).toEqual([]);
  }, 30000);

  it("the detector can find one, so a clean result means something", () => {
    // Proved against a THROW-AWAY fixture. Asserting "at least one exists"
    // would break the moment the last is fixed, which trains the next reader to
    // delete the test.
    const fixture = path.join(SRC, "__jsxCommentFixture.jsx");
    try {
      fs.writeFileSync(
        fixture,
        "export default function F() {\n" +
          "  return (\n" +
          "    <div>\n" +
          "      // this renders as text\n" +
          "      <span>x</span>\n" +
          "    </div>\n" +
          "  );\n" +
          "}\n",
        "utf8"
      );
      expect(jsxTextLineComments(fixture)).toHaveLength(1);
      fs.writeFileSync(
        fixture,
        "export default function F() {\n" +
          "  return (\n" +
          "    <div>\n" +
          "      {/* this is a real comment */}\n" +
          "      <span>x</span>\n" +
          "    </div>\n" +
          "  );\n" +
          "}\n",
        "utf8"
      );
      expect(jsxTextLineComments(fixture)).toHaveLength(0);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  }, 30000);

  it("a `//` comment in ordinary JS position is NOT flagged", () => {
    // The guard must not push the codebase towards awkward workarounds in the
    // places where `//` is correct and clearer than anything else.
    const fixture = path.join(SRC, "__jsxCommentFixture.jsx");
    try {
      fs.writeFileSync(
        fixture,
        "// an ordinary leading comment at module scope\n" +
          "export function f() {\n" +
          "  // and one inside a function\n" +
          "  return 1;\n" +
          "}\n",
        "utf8"
      );
      expect(jsxTextLineComments(fixture)).toHaveLength(0);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  }, 30000);
});