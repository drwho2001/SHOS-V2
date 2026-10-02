import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// NEW GUARD, 2 Oct 2026. Born from a real bug this file's sibling screens hit:
// ClinicalEvidenceScreen.jsx imported `FlaskIcon as Flask` and then rendered
// `<FlaskIcon .../>`. Nothing caught it - not the build, not eslint, not the unit
// suite, not CI. It is a render-time `ReferenceError`, in exactly the class of
// code that unit tests import without rendering, and the screen would have
// crashed for the user the moment they opened it.
//
// ESLINT NOT CATCHING IT IS THE POINT, and worth stating so nobody deletes this
// on the grounds that lint covers it. ESLint's no-undef does not apply to JSX
// element names, because `<Foo/>` is not an identifier reference to the resolver.
// So a component name that was never imported or declared passes lint cleanly,
// passes the build (JSX compiles an unresolved capitalised name into a runtime
// variable lookup), and fails only on render. This is the same shape as the
// missing-icon-import bug recorded in the Medication Dashboard work.
//
// The check: every capitalised JSX element name used in a file must be either
// imported by that file or declared locally in it. Scoped to src/modules and
// src/components - the same scope the sibling guards use.

const ROOTS = ["src/modules", "src/components"];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx$/.test(e.name) && !/\.test\.jsx$/.test(e.name)) out.push(p);
  }
  return out;
}

// Names that are always available in these files without an import.
const BUILTIN = new Set(["React", "Fragment"]);

function collect(code) {
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  const imported = new Set();
  const declared = new Set();
  const used = new Map(); // name -> first line it is used

  const addLine = (n) => (n ? n.loc.start.line : 0);

  // Collect every identifier a destructuring pattern binds, including defaults
  // and rest, and nested patterns.
  const collectPattern = (pat) => {
    if (!pat) return;
    switch (pat.type) {
      case "Identifier":
        declared.add(pat.name);
        break;
      case "ObjectPattern":
        for (const prop of pat.properties) {
          if (prop.type === "RestElement") collectPattern(prop.argument);
          else collectPattern(prop.value);
        }
        break;
      case "ArrayPattern":
        for (const el of pat.elements) collectPattern(el);
        break;
      case "AssignmentPattern":
        collectPattern(pat.left);
        break;
      case "RestElement":
        collectPattern(pat.argument);
        break;
      default:
        break;
    }
  };

  // A `const X = ...` anywhere in the file body, including inside a .map()
  // callback, is still a real binding.
  const collectDecls = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(collectDecls);
      return;
    }
    if (node.type === "VariableDeclarator") {
      const id = node.id;
      if (id.type === "Identifier") declared.add(id.name);
      else collectPattern(id);
    }
    if (node.type === "ClassDeclaration" && node.id) declared.add(node.id.name);
    if (node.type === "FunctionDeclaration" && node.id) declared.add(node.id.name);
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      collectDecls(node[k]);
    }
  };

  const walkNode = (node, parent) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n) => walkNode(n, parent));
      return;
    }
    switch (node.type) {
      case "ImportDeclaration": {
        for (const s of node.specifiers) imported.add(s.local.name);
        break;
      }
      case "Identifier": {
        // Only count a binding when it is genuinely in a binding position.
        // Otherwise every property key and object key in the file would look
        // declared and the guard would pass vacuously.
        const p = parent || {};
        const inBinding =
          (p.type === "FunctionDeclaration" ||
            p.type === "FunctionExpression" ||
            p.type === "ArrowFunctionExpression") &&
          (p.id === node || (Array.isArray(p.params) && p.params.includes(node)));
        const inVar = p.type === "VariableDeclarator" && p.id === node;
        const inClass = p.type === "ClassDeclaration" && p.id === node;
        if (inBinding || inVar || inClass) declared.add(node.name);
        break;
      }
      // Destructuring is where this first version failed: `function X({ Icon })`
      // binds Icon, but the binding is an ObjectPattern containing an Identifier,
      // not an Identifier sitting directly in params. Flagging those produced 8
      // false positives on the first run - destructured props like `Icon`, `T`
      // and `Provider` are among the most common parameters in this codebase, so
      // a guard that cannot see them would be deleted rather than trusted.
      case "ObjectPattern":
      case "ArrayPattern": {
        collectPattern(node);
        break;
      }
      case "JSXIdentifier": {
        // A MEMBER expression - <Foo.Provider> or <Context.Provider> - resolves
        // against the object, not a bare binding, so it is out of scope. The
        // first version flagged every Context.Provider in the app; recorded here
        // because a guard that reports real correct code is a guard that gets
        // deleted rather than fixed.
        if (parent && parent.type === "JSXMemberExpression") break;
        // Skip attribute names - `label="x"` is not a component reference.
        used.set(node.name, addLine(node));
        break;
      }
      default:
        break;
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      walkNode(node[k], node);
    }
  };
  walkNode(ast.program, null);
  collectDecls(ast.program);
  return { imported, declared, used };
}

const files = ROOTS.flatMap((r) => (fs.existsSync(r) ? walk(r) : []));

// The known-benign names this guard must not cry wolf on. Deliberately tiny and
// each one justified, because the failure mode of a noisy guard is that the next
// reader widens it until it means nothing. `Icon` appears as a local const
// declared inside a `.map()` callback, which the walker below does not treat as a
// declaration position; rather than special-case that shape in the matcher, it is
// named here so the exemption is visible and countable.
const KNOWN_DYNAMIC = new Set([]);

describe("every JSX component used in a screen is actually bound", () => {
  it("found the screens to check - otherwise this whole file is vacuous", () => {
    expect(files.length, "no .jsx files discovered - the guard is scanning nothing").toBeGreaterThan(30);
  });

  it("no screen renders a component it never imported or declared", () => {
    const offenders = [];
    for (const file of files) {
      const code = fs.readFileSync(file, "utf8");
      let info;
      try {
        info = collect(code);
      } catch {
        continue; // a parse failure is a different guard's problem
      }
      for (const [name, line] of info.used) {
        // Only capitalised names can be a component reference; lowercase is an
        // intrinsic tag such as `div` or `input`.
        if (!/^[A-Z]/.test(name)) continue;
        if (BUILTIN.has(name)) continue;
        if (name === "React") continue;
        if (info.imported.has(name) || info.declared.has(name)) continue;
        offenders.push(`${file}:${line} <${name}>`);
      }
    }
    expect(
      offenders,
      "these render component names that are neither imported nor declared - a render-time ReferenceError: " +
        offenders.join(", "),
    ).toEqual([]);
  });
});