// glossaryPropChain.js
//
// Shared AST helpers for the guards that prove a `onOpenGlossary` prop is
// actually threaded from App down to a component rendering a Glossary link
// (HivStatusNote, JargonNote). TWO guards consume this - uuNoteLinkGuard.test.js
// and jargonNoteCoverage.test.js - because the prop-chain bug they both guard is
// one bug, and two hand-maintained copies of this logic is how one of them ends
// up checking a stale version of the app.
//
// WHY THIS IS ITS OWN FILE. Each helper below exists because a narrower version
// of it was proven vacuous by MUTATION, not by argument. The reasoning is kept
// with the code so a future reader does not "simplify" a guard back into the
// form that passed against a broken tree. The load-bearing ones, briefly:
//
//   - destructuredProps unwraps AssignmentPattern. Every module here writes
//     `function C({ ... } = {})`, which puts the ObjectPattern inside an
//     AssignmentPattern. Skipping that case reads the entire app as accepting
//     no props at all.
//   - The fixpoint in the guards walks the RENDER relationship (who mounts a
//     component that needs the prop), not the lexical one (what encloses a
//     mount). A module renders ClinicCardScreen; it is not lexically inside
//     HomeScreen, so walking outward from a mount never reaches it. The
//     original lexical check passed green while HealthcareScreen and
//     HomeScreen both dropped onOpenGlossary and every link through Clinic
//     Card was dead - which is t108.
//   - Only NAMED components are reported as renderers, and only functions that
//     take parameters can be handed props. Anonymous arrows (render helpers,
//     IIFEs) and zero-arg functions produced false positives on first run.
//
// This is test-support code, not app code: it imports nothing from src/ and is
// imported only by the two guards.
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

/** Every .jsx under src/, excluding tests and node_modules. */
export function jsxFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules") continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) jsxFiles(p, out);
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/** Depth-first walk over every AST node except source locations. */
export function walk(node, visit) {
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

/** Parse a .jsx file, or null if it does not parse (a different guard's job). */
export function parseFile(file) {
  try {
    return parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return null;
  }
}

const keyName = (k) => (k?.type === "Identifier" ? k.name : k?.value ?? k?.name);

/** Every mount of a component, with its prop names and noteKey if it has one. */
export function mountsOf(ast, componentName) {
  const out = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    if (node.name?.name !== componentName) return;
    const attrs = (node.attributes || []).filter((a) => a.type === "JSXAttribute");
    const noteKeyAttr = attrs.find((a) => a.name?.name === "noteKey");
    out.push({
      line: node.loc?.start?.line ?? 0,
      props: attrs.map((a) => a.name?.name),
      noteKey: noteKeyAttr?.value?.value ?? null,
    });
  });
  return out;
}

/**
 * The prop names a component destructures from its parameters.
 *
 * Unwraps AssignmentPattern because this repo's modules overwhelmingly declare
 * `({ ...rest } = {})`. A version that only handled a bare ObjectPattern read
 * every one of them as accepting nothing, which turned the first run of the
 * transitive check into a wall of false failures (App, Settings, Healthcare and
 * Contacts all reported broken when every one was wired correctly).
 */
export function destructuredProps(node) {
  const names = [];
  for (let prm of node.params || []) {
    while (prm && prm.type === "AssignmentPattern") prm = prm.left;
    if (!prm || prm.type !== "ObjectPattern") continue;
    for (const prop of prm.properties) {
      if (prop.type === "ObjectProperty") names.push(keyName(prop.key));
      else if (prop.type === "RestElement") names.push("...");
    }
  }
  return names;
}

/** Every parameter-taking function that lexically encloses a mount of the component. */
export function receiverChain(ast, componentName, prop) {
  const uses = mountsOf(ast, componentName);
  if (uses.length === 0) return [];
  const lines = uses.map((u) => u.line);
  const out = [];
  walk(ast, (node) => {
    if (node.type !== "FunctionDeclaration" && node.type !== "ArrowFunctionExpression") return;
    if ((node.params || []).length === 0) return;
    const s = node.loc?.start?.line ?? 0;
    const e = node.loc?.end?.line ?? 0;
    if (!lines.some((l) => l >= s && l <= e)) return;
    const props = destructuredProps(node);
    out.push({
      fn: node.id?.name || "(anonymous)",
      line: s,
      accepts: props.includes(prop) || props.includes("..."),
    });
  });
  const seen = new Set();
  return out
    .sort((a, b) => b.line - a.line)
    .filter((r) => (seen.has(r.line) ? false : (seen.add(r.line), true)));
}

/**
 * For each mount of a component named in `childNames`, the named parent that
 * renders it, whether the mount SUPPLIES the prop, and whether the parent
 * accepts or locally declares the value. `supplied` is false | "lambda" |
 * "identifier" | "other", and the distinction matters: an inline lambda is a
 * self-contained supply needing no signature, while a bare identifier must come
 * from the parent's own scope.
 */
/**
 * Parse every .jsx under src/ ONCE and return the results.
 *
 * WHY THIS EXISTS. The fixpoint that uses renderersOf re-visits every file on
 * every round, because each round grows the set of components it is looking for.
 * Calling parseFile inside that loop meant the whole of src/ was handed to
 * @babel/parser once per round - six rounds worst case - for a result that
 * cannot change between rounds. The source did not change; only the question
 * did. Parsing once turns six passes over every file into one.
 *
 * This is a memory finding, not a style preference. Measured on 10 Oct 2026 with
 * the fixpoint in place, the two prop-chain guards together ran ~85s standalone
 * and contributed to a vitest worker being OOM-killed during the full suite at
 * 251-435 MB free on this 4 GB box (ERR_IPC_CHANNEL_CLOSED, not an assertion
 * failure). See pool task t109.
 */
export function parseAllJsx(dir) {
  const out = [];
  for (const f of jsxFiles(dir)) {
    const ast = parseFile(f);
    if (ast) out.push({ file: f, ast });
  }
  return out;
}

export function renderersOf(ast, childNames, leafComponent) {
  const uses = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const nm = node.name?.name;
    if (!nm || !childNames.has(nm)) return;
    uses.push({
      line: node.loc?.start?.line ?? 0,
      child: nm,
      attrs: (node.attributes || []).filter((a) => a.type === "JSXAttribute"),
    });
  });
  if (uses.length === 0) return [];

  const named = [];
  walk(ast, (node) => {
    if (node.type === "FunctionDeclaration" && node.id?.name) {
      named.push({ name: node.id.name, s: node.loc?.start?.line ?? 0, e: node.loc?.end?.line ?? 0, node });
    } else if (node.type === "VariableDeclarator" && node.id?.type === "Identifier" && node.id.name) {
      const init = node.init;
      if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
        named.push({ name: node.id.name, s: node.loc?.start?.line ?? 0, e: node.loc?.end?.line ?? 0, node: init });
      }
    }
  });

  const fileRendersLeaf = leafComponent ? mountsOf(ast, leafComponent).length > 0 : true;
  const out = [];
  for (const u of uses) {
    const host = named
      .filter((n) => n.s <= u.line && n.e >= u.line)
      .sort((a, b) => b.s - a.s)[0];
    if (!host) continue;
    const propName = u.child === leafComponent ? "onOpen" : "onOpenGlossary";
    const attr = u.attrs.find((a) => a.name?.name === propName);
    let supplied = false;
    let identifier = null;
    if (attr) {
      const expr = attr.value?.expression;
      if (expr?.type === "ArrowFunctionExpression" || expr?.type === "FunctionExpression") supplied = "lambda";
      else if (expr?.type === "Identifier") {
        supplied = "identifier";
        identifier = expr.name;
      } else supplied = "other";
    }
    out.push({
      name: host.name,
      child: u.child,
      line: host.s,
      supplied,
      identifier,
      fileRendersLeaf,
      declaredHere: identifier ? declaredInFile(ast, identifier) : false,
      accepts: destructuredProps(host.node).includes("onOpenGlossary") ||
        destructuredProps(host.node).includes("..."),
    });
  }
  return out;
}

/** Whether `name` is declared anywhere in this file - a const helper or an import. */
export function declaredInFile(ast, name) {
  let found = false;
  walk(ast, (node) => {
    if (found) return;
    if (node.type === "VariableDeclarator" && node.id?.name === name) found = true;
    if (node.type === "FunctionDeclaration" && node.id?.name === name) found = true;
    if (node.type === "ImportSpecifier" && node.imported?.name === name) found = true;
  });
  return found;
}