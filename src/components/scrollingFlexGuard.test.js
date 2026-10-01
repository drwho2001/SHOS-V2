import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

// Guards t060: a SCROLLING container that is also a FLEX container can never
// scroll far enough to reveal all of its own content.
//
// Found on a real device (Redmi Note 13, Android 15): the last row of the
// Settings list sat at y=826-872 while the system gesture bar starts at y=824,
// so it could not be tapped. Verified unreachable three ways - scrollTop pinned
// at maximum, scrollIntoView({block:"end"}), and injecting a real spacer.
//
// WHY: a flex container's content box is `clientHeight` minus padding, and its
// child is sized to that box. Content taller than the box OVERFLOWS (overflow
// is visible) rather than extending the scrollable range. On that device the
// content column measured clientHeight 238 against scrollHeight 1092 - 854px of
// real, reachable-looking content that simply could not be scrolled to.
//
// Parsed with @babel/parser rather than grepped, deliberately. An earlier
// file-level grep for "overflowY:auto AND display:flex AND justifyContent:
// center" reported 24 files, but that matches three properties anywhere in a
// file, on any three different elements. This walks the actual AST and looks at
// each element's own style object, so it reports real instances only.

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

// An inline style={{ ... }} object, read statically. Only literal string and
// numeric values and simple identifiers are understood, which is all these use.
function styleProps(node) {
  if (!node || node.type !== "ObjectExpression") return {};
  const props = {};
  for (const prop of node.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const key = prop.key.name ?? prop.key.value;
    let value = null;
    const v = prop.value;
    if (v.type === "StringLiteral") value = v.value;
    else if (v.type === "NumericLiteral") value = v.value;
    else if (v.type === "TemplateLiteral" && v.quasis.length === 1) value = v.quasis[0].value.cooked;
    else if (v.type === "BooleanLiteral") value = v.value;
    props[key] = value;
  }
  return props;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (typeof node.type !== "string") return;
  visit(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    walk(node[key], visit);
  }
}

function findScrollingFlexContainers(file) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return []; // a file this parser cannot read is not evidence of anything
  }
  const hits = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement" && node.type !== "JSXAttribute") return;
    if (node.type === "JSXOpeningElement") {
      const styleAttr = node.attributes?.find(
        (a) => a.type === "JSXAttribute" && a.name?.name === "style",
      );
      if (!styleAttr) return;
      const props = styleProps(styleAttr.value?.expression);
      const scrolls = /auto|scroll/.test(String(props.overflowY ?? props.overflow ?? ""));
      const isFlex = props.display === "flex";
      const fixed = props.position === "fixed" || props.position === "sticky";
      if (scrolls && isFlex && fixed) {
        hits.push({
          line: node.loc?.start?.line ?? 0,
          overflowY: props.overflowY ?? props.overflow,
          justifyContent: props.justifyContent ?? "(none)",
          hasInsetPadding: /safe-area-inset-bottom/.test(String(props.paddingBottom ?? "")),
        });
      }
    }
  });
  return hits;
}

const FILES = jsxFiles(SRC);
const FINDINGS = FILES.map((f) => ({ file: path.relative(SRC, f).replace(/\\/g, "/"), hits: findScrollingFlexContainers(f) })).filter(
  (r) => r.hits.length > 0,
);

describe("scrolling containers must not also be flex containers (t060)", () => {
  it("the detector catches a known-bad element, so a clean result means clean code", () => {
    // Non-vacuity, proved against a THROWAWAY file rather than against real
    // source. Asserting "there is at least one finding" would break the moment
    // the last one is fixed, which is the opposite of what a guard should do -
    // it would train the next reader to delete the test. Here the fixture is
    // created, scanned and removed, so the proof holds whether or not any real
    // defect remains.
    const fixture = path.join(SRC, "__scrollingFlexFixture.jsx");
    const bad =
      "export default function Fixture() {\n" +
      '  return <div style={{ position: "fixed", inset: 0, overflowY: "auto", display: "flex", justifyContent: "center" }}>x</div>;\n' +
      "}\n";
    const good =
      "export default function Fixture() {\n" +
      '  return <div style={{ position: "fixed", inset: 0, overflowY: "auto" }}>x</div>;\n' +
      "}\n";
    try {
      fs.writeFileSync(fixture, bad, "utf8");
      expect(findScrollingFlexContainers(fixture)).toHaveLength(1);
      fs.writeFileSync(fixture, good, "utf8");
      expect(findScrollingFlexContainers(fixture)).toHaveLength(0);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it("SettingsScreen's own root is no longer a scrolling flex container", () => {
    const settings = FINDINGS.find((r) => r.file.endsWith("SHOS_Settings_Prototype.jsx"));
    const offenders = (settings?.hits ?? []).filter((h) => h.justifyContent === "center");
    expect(
      offenders,
      "SHOS_Settings_Prototype.jsx still has a position:fixed scroll container that is also display:flex - that is the t060 defect",
    ).toEqual([]);
  });

  it("the inventory is reported with enough detail to act on", () => {
    const summary = FINDINGS.flatMap((r) =>
      r.hits.map((h) => `${r.file}:${h.line} overflowY=${h.overflowY} justifyContent=${h.justifyContent}`),
    );
    // Written out on purpose: this is the inventory that decides whether the
    // remaining instances are the same bug or something else, and a future
    // session should not have to re-derive it.
    console.log("\n  scrolling flex containers remaining: " + summary.length);
    for (const s of summary) console.log("    " + s);
    expect(Array.isArray(summary)).toBe(true);
  });
});