// ADDED 2 Oct 2026 - the U=U note's "U=U" is a LINK to the Glossary, and
// reaching it means threading an onOpenGlossary prop down through every host.
//
// MyProfileModule is mounted in FOUR places (Settings, Home, Contacts,
// ClinicCard) and HivStatusNote in four more. Threading that by hand is exactly
// how the sixth site quietly ships a dead link - and a dead link is worse than
// no link, because the underline promises somewhere to go.
//
// WHY THIS FILE EXISTS IN ITS CURRENT SHAPE: the first version was VACUOUS, and
// mutation testing is the only reason that was caught. It checked that callers
// PASS onOpenGlossary but not that the RECEIVER ACCEPTS it, so dropping
// `onOpenGlossary` from ContactProfile's parameter list - which leaves every
// U=U on a contact profile pointing nowhere - left the whole suite GREEN. Both
// directions are asserted below: the call site, and the signature.
//
// A scan scoped to the file you happened to open first is not a survey, which is
// why this walks all of src/ rather than the two files the change touched.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

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
    if (key === "loc") continue;
    walk(node[key], visit);
  }
}

function parseFile(file) {
  try {
    return parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return null;
  }
}

const keyName = (k) => (k?.type === "Identifier" ? k.name : k?.value ?? k?.name);

/** Every mount of a component, with the prop names it was given. */
function mountsOf(ast, componentName) {
  const out = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    if (node.name?.name !== componentName) return;
    out.push({
      line: node.loc?.start?.line ?? 0,
      props: (node.attributes || []).filter((a) => a.type === "JSXAttribute").map((a) => a.name?.name),
    });
  });
  return out;
}

/** The prop names a function component destructures from its first argument. */
function destructuredProps(node) {
  const names = [];
  for (const prm of node.params || []) {
    if (prm.type !== "ObjectPattern") continue;
    for (const prop of prm.properties) {
      if (prop.type === "ObjectProperty") names.push(keyName(prop.key));
      else if (prop.type === "RestElement") {
        // `...rest` swallows unknown props, so treat it as accepting everything
        // rather than pretending it is a precise declaration.
        names.push("...");
      }
    }
  }
  return names;
}

/**
 * For each mount of `componentName`, the enclosing function and whether that
 * function destructures `prop`. The assertion the first version was missing.
 */
function receivers(ast, componentName, prop) {
  const uses = mountsOf(ast, componentName);
  if (uses.length === 0) return [];
  const lines = uses.map((u) => u.line);
  const out = [];
  walk(ast, (node) => {
    if (node.type !== "FunctionDeclaration" && node.type !== "ArrowFunctionExpression") return;
    const s = node.loc?.start?.line ?? 0;
    const e = node.loc?.end?.line ?? 0;
    const inner = lines.filter((l) => l >= s && l <= e);
    if (inner.length === 0) return;
    const props = destructuredProps(node);
    out.push({
      fn: node.id?.name || "(anonymous)",
      line: s,
      accepts: props.includes(prop) || props.includes("..."),
    });
  });
  // Innermost enclosing function wins if several nest.
  return out.sort((a, b) => b.line - a.line).slice(0, inner0(lines));
}

const inner0 = (lines) => new Set(lines.map((l) => l)).size || 1;

const ALL = jsxFiles(SRC);
const rel = (f) => path.relative(SRC, f).replace(/\\/g, "/");

describe("every U=U link has somewhere to go", () => {
  it("every HivStatusNote mount passes onOpen", () => {
    const bad = [];
    let n = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const m of mountsOf(ast, "HivStatusNote")) {
        n++;
        if (!m.props.includes("onOpen")) bad.push(`${rel(f)}:${m.line} HivStatusNote without onOpen`);
      }
    }
    expect(bad, "these U=U notes would render a link that goes nowhere").toEqual([]);
    expect(n, "found no HivStatusNote mounts - the guard is not looking where they are").toBeGreaterThanOrEqual(4);
  });

  it("every component that RENDERS a HivStatusNote accepts onOpenGlossary", () => {
    // The direction the first version missed: a component whose signature lacks
    // the prop renders a U=U wired to nothing, and a guard that only inspects
    // call sites stays green through exactly that.
    const bad = [];
    let checked = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const r of receivers(ast, "HivStatusNote", "onOpenGlossary")) {
        checked++;
        if (!r.accepts) {
          bad.push(`${rel(f)}:${r.line} ${r.fn} renders a HivStatusNote but does not accept onOpenGlossary`);
        }
      }
    }
    expect(bad, "these render a U=U link wired to nothing").toEqual([]);
    expect(checked, "found no enclosing components - the guard is not looking where they are").toBeGreaterThanOrEqual(3);
  });

  it("every MyProfileModule mount passes onOpenGlossary", () => {
    // My Profile is reachable from four places. A new one that forgets gives a
    // dead U=U link inside it, and only whoever opened it from there finds out.
    const bad = [];
    let n = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const m of mountsOf(ast, "MyProfileModule")) {
        n++;
        if (!m.props.includes("onOpenGlossary")) {
          bad.push(`${rel(f)}:${m.line} MyProfileModule without onOpenGlossary`);
        }
      }
    }
    expect(bad, "these My Profile entry points would give a dead U=U link").toEqual([]);
    expect(n, "found no MyProfileModule mounts - the guard is not looking where they are").toBeGreaterThanOrEqual(4);
  });

  it("App.jsx defines the glossary helper the link depends on", () => {
    const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
    expect(app).toMatch(/openSettingsToGlossary/);
    expect(app).toMatch(/setSettingsInitialScreen\("glossary"\)/);
  });

  it("Settings can open the Glossary screen directly, which is what the link relies on", () => {
    const settings = fs.readFileSync(path.join(SRC, "modules/SHOS_Settings_Prototype.jsx"), "utf8");
    expect(settings).toMatch(/showGlossary.*initialScreen === "glossary"/);
  });
});