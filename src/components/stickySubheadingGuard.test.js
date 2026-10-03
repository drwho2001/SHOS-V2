// ADDED 2 Oct 2026 - guards the sticky sub-heading offset against drifting apart.
//
// THE BUG, found by hand on a device: a 4px band between the Healthcare
// screen-title banner and the sub-module's own sticky sub-heading, through which
// scrolled content was plainly visible. Measured on a Redmi Note 13: the banner
// sticks at top 0 and is 93px tall (35px of that is the status-bar inset), so it
// ends at y=93; the Vaccinations sub-heading stuck at y=97.
//
// The interesting part is not that one number was wrong. It is that SEVEN sites
// each carried their own hardcoded offset, so they had drifted apart silently,
// and the 16 Sep 2026 banner redesign shortened the banner by 8px without every
// dependent offset being hand-updated. A guard that only checked "is 58 the right
// number" would be asserting a measurement of a CSS box, which cannot be done
// statically. What CAN be prevented - and what actually caused this - is a site
// reintroducing its own literal.
//
// Parsed with @babel/parser rather than grepped, per the convention this repo
// settled on after several regex scans produced false results.
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
    if (key === "loc") continue;
    walk(node[key], visit);
  }
}

/** Every element whose own style sets position:"sticky" and a top. */
function stickyTops(file) {
  const code = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  } catch {
    return [];
  }
  const out = [];
  walk(ast, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const styleAttr = node.attributes?.find(
      (a) => a.type === "JSXAttribute" && a.name?.name === "style"
    );
    if (!styleAttr || styleAttr.value?.expression?.type !== "ObjectExpression") return;
    const props = {};
    for (const p of styleAttr.value.expression.properties) {
      if (p.type !== "ObjectProperty") continue;
      const k = p.key.name ?? p.key.value;
      const v = p.value;
      if (v.type === "StringLiteral") props[k] = v.value;
      else if (v.type === "NumericLiteral") props[k] = v.value;
      else if (v.type === "TemplateLiteral" && v.quasis.length === 1) props[k] = v.quasis[0].value.cooked;
      else props[k] = { computed: true };
    }
    if (props.position === "sticky" && props.top !== undefined) {
      out.push({ line: node.loc?.start?.line ?? 0, top: props.top });
    }
  });
  return out;
}

const ALL = jsxFiles(SRC);

describe("sticky sub-heading offsets must not each carry their own number", () => {
  it("no sub-module hardcodes a safe-area sticky offset", () => {
    // `top: 0` is the screen-title BANNERS themselves, which is correct and is
    // the other end of this arrangement. Anything offset by a safe-area inset is
    // a dependent sub-heading and must use the shared constant.
    const offenders = [];
    for (const f of ALL) {
      for (const s of stickyTops(f)) {
        if (typeof s.top === "string" && /safe-area-inset-top/.test(s.top)) {
          offenders.push(`${path.relative(SRC, f).replace(/\\/g, "/")}:${s.line} top=${s.top}`);
        }
      }
    }
    expect(
      offenders,
      "these sticky bars hardcode a safe-area offset; use STICKY_SUBHEADING_TOP so they cannot drift apart again",
    ).toEqual([]);
  }, 30000);

  it("the shared constant is the one in designTokens, and still says 58", () => {
    const tokens = fs.readFileSync(path.join(SRC, "calculations/designTokens.js"), "utf8");
    expect(tokens).toMatch(/export const STICKY_SUBHEADING_TOP/);
    // 58 is the screen-title banner's height excluding the status-bar inset.
    // If the banner's padding or title size changes, this number has to change
    // with it, and this is where that gets said out loud.
    expect(tokens).toMatch(/STICKY_SUBHEADING_TOP\s*=\s*"calc\(env\(safe-area-inset-top\) \+ 58px\)"/);
  }, 30000);

  it("every site that uses the constant also imports it", () => {
    // A missing import is a ReferenceError at render time - the exact class of
    // bug that unit tests happily import a module without rendering.
    const broken = [];
    for (const f of ALL) {
      const code = fs.readFileSync(f, "utf8");
      if (!/STICKY_SUBHEADING_TOP/.test(code)) continue;
      if (/import[^;]*STICKY_SUBHEADING_TOP[^;]*from/.test(code)) continue;
      if (/const\s+STICKY_SUBHEADING_TOP\s*=/.test(code)) continue;
      broken.push(path.relative(SRC, f).replace(/\\/g, "/"));
    }
    expect(broken, "uses STICKY_SUBHEADING_TOP without importing it").toEqual([]);
  }, 30000);

  it("the detector itself can find a hardcoded offset", () => {
    // Non-vacuity, proved against a THROW-AWAY file rather than real source.
    // Asserting "at least one offender exists" would break the moment the last
    // one is fixed, which trains the next reader to delete the test.
    const fixture = path.join(SRC, "__stickyFixture.jsx");
    try {
      fs.writeFileSync(
        fixture,
        'export default function F() {\n' +
          '  return <div style={{ position: "sticky", top: "calc(env(safe-area-inset-top) + 99px)" }}>x</div>;\n' +
          "}\n",
        "utf8"
      );
      expect(stickyTops(fixture)).toHaveLength(1);
      fs.writeFileSync(
        fixture,
        'export default function F() {\n' +
          '  return <div style={{ position: "sticky", top: 0 }}>x</div>;\n' +
          "}\n",
        "utf8"
      );
      // top:0 is a banner, so it is NOT an offender - the real assertion filters
      // on the safe-area pattern, and this proves the filter distinguishes. It
      // parses as a NUMERIC literal, hence String() before the pattern test.
      expect(String(stickyTops(fixture)[0].top)).not.toMatch(/safe-area/);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  }, 30000);
});