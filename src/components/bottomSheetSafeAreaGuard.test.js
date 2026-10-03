// ADDED 2 Oct 2026 - guards bottom-sheet roots against losing their safe-area
// bottom padding.
//
// THE BUG, reported by hand from the device: the "Save changes" button on the
// Contacts edit sheet rendered UNDERNEATH the Android system navigation bar.
// Measured over CDP on a Redmi Note 13: the button spanned CSS y 807-859, the
// viewport was 872 tall, and the OS nav bar occupied roughly y 790-872. So it
// was not clipped at the edge - the entire control sat inside the nav bar, with
// the back/home/recents keys painted on top of it.
//
// THE CAUSE, and why it is a class rather than one site: these sheets are
// `position: fixed; inset: 0` with `display: flex; alignItems: "flex-end"`, which
// bottom-aligns the sheet flush against the viewport bottom. Every one of them
// already carried `paddingTop: "env(safe-area-inset-top)"` for the status bar
// and none carried a `paddingBottom`, so the sticky footer - which is exactly
// where Save / Confirm / Cancel live - landed in the nav bar's space. Scanning
// every module found 20 such roots, all 20 missing it: Contacts x2,
// Measurements x2, Medication x6, Settings x3, and one each in Calendar,
// ClinicCard, MenstrualHealth, RegistryManagement, SymptomLog, Timeline and
// Vaccinations. So this guard exists for the 21st.
//
// WHAT CANNOT BE ASSERTED HERE: that 48px is the right number. That is a
// property of the device, not of the source - this handset measures
// `env(safe-area-inset-bottom)` at 48px, a gesture-nav device would differ, and
// `env()` resolves to 0px in a headless browser, which is why this could not be
// verified locally and had to wait for real hardware. What CAN be prevented - and
// what actually caused this - is a root losing the padding, or gaining one that
// does not consult `env()` and therefore silently depends on the guess.
//
// Parsed with @babel/parser rather than grepped, per the convention this repo
// settled on after several regex scans produced false results.
//
// ADDED 3 Oct 2026 - explicit 30s timeouts on the three tests below.
//
// It walks all of src/ and runs @babel/parser over every .jsx on every run, so
// it is a real AST sweep rather than an assertion over a string. Vitest's 5s
// default is not a budget for that work: under full-suite load on this machine
// (measured at 327-674 MB free) guards of this shape timed out and reported a
// failure of an assertion they were never evaluating. Seven sibling guards were
// given the same budget in the same pass, because a fix scoped to the one that
// happened to go red is not a fix to the class.
//
// Measured, not guessed: run this file alone and divide the reported test
// duration by its test count before raising this further.
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

/** Every element that is a bottom-aligned full-bleed sheet root. */
function bottomSheetRoots(file) {
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
    // position:fixed + inset:0 + alignItems:flex-end is the bottom-sheet root
    // shape. `inset: 0` arrives as a NumericLiteral 0.
    if (
      props.position === "fixed" &&
      props.inset === 0 &&
      props.alignItems === "flex-end"
    ) {
      out.push({
        line: node.loc?.start?.line ?? 0,
        paddingBottom: props.paddingBottom,
        paddingTop: props.paddingTop,
      });
    }
  });
  return out;
}

const ALL = jsxFiles(SRC);

describe("bottom-sheet roots must clear the system navigation bar", () => {
  it("every bottom-aligned sheet root reserves room below itself", () => {
    const offenders = [];
    for (const f of ALL) {
      for (const s of bottomSheetRoots(f)) {
        // paddingBottom must be present AND consult env(safe-area-inset-bottom).
        // A hardcoded pixel value would work on exactly one device, which is the
        // failure this whole guard exists to prevent - so it counts as an offender.
        const ok =
          typeof s.paddingBottom === "string" &&
          /env\(safe-area-inset-bottom/.test(s.paddingBottom);
        if (!ok) {
          offenders.push(
            `${path.relative(SRC, f).replace(/\\/g, "/")}:${s.line} paddingBottom=${
              s.paddingBottom === undefined ? "(absent)" : JSON.stringify(s.paddingBottom)
            }`
          );
        }
      }
    }
    expect(
      offenders,
      "these bottom-sheet roots would put their footer under the OS nav bar; add paddingBottom: \"env(safe-area-inset-bottom)\""
    ).toEqual([]);
  }, 30_000);

  it("the roots that were actually broken are all still guarded", () => {
    // A count, not a spot check: if someone refactors one of these sheets into a
    // different component the shape may no longer match, and this is the test
    // that should notice rather than silently stop covering it.
    let roots = 0;
    for (const f of ALL) roots += bottomSheetRoots(f).length;
    expect(roots).toBeGreaterThanOrEqual(20);
  }, 30_000);

  it("the detector distinguishes a guarded root from an unguarded one", () => {
    // Non-vacuity, proved against a throw-away file rather than real source.
    // Asserting "at least one offender exists" would break the moment the last
    // one is fixed, which trains the next reader to delete the test.
    const fixture = path.join(SRC, "__bottomSheetFixture.jsx");
    try {
      fs.writeFileSync(
        fixture,
        "export default function F() {\n" +
          '  return <div style={{ position: "fixed", inset: 0, alignItems: "flex-end", paddingTop: "env(safe-area-inset-top)" }}>x</div>;\n' +
          "}\n",
        "utf8"
      );
      const unguarded = bottomSheetRoots(fixture);
      expect(unguarded).toHaveLength(1);
      expect(unguarded[0].paddingBottom).toBeUndefined();

      fs.writeFileSync(
        fixture,
        "export default function F() {\n" +
          '  return <div style={{ position: "fixed", inset: 0, alignItems: "flex-end", paddingBottom: "env(safe-area-inset-bottom)" }}>x</div>;\n' +
          "}\n",
        "utf8"
      );
      const guarded = bottomSheetRoots(fixture);
      expect(guarded).toHaveLength(1);
      expect(guarded[0].paddingBottom).toMatch(/safe-area-inset-bottom/);

      // And a hardcoded pixel paddingBottom is treated as an offender, not a pass.
      fs.writeFileSync(
        fixture,
        "export default function F() {\n" +
          '  return <div style={{ position: "fixed", inset: 0, alignItems: "flex-end", paddingBottom: 48 }}>x</div>;\n' +
          "}\n",
        "utf8"
      );
      const hardcoded = bottomSheetRoots(fixture);
      expect(hardcoded).toHaveLength(1);
      expect(
        typeof hardcoded[0].paddingBottom === "string" &&
          /env\(safe-area-inset-bottom/.test(hardcoded[0].paddingBottom)
      ).toBe(false);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  }, 30_000);
});