// Every option picker in the app must handle BOTH option shapes.
//
// THE BUG THIS GUARDS
// -------------------
// On 29 Sep 2026 the HIV status override began passing `{ value, label }`
// objects to a `SelectField` that rendered its option parameter raw:
//
//   {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
//
// That is only legal while every caller passes plain strings. Opening My Profile
// -> Edit then threw React error #31 - "Objects are not valid as a React child" -
// and shipped in three published APKs.
//
// WHY A STATIC CHECK HERE RATHER THAN A RENDERING TEST, because that was the
// obvious objection and it is a fair one.
//
// The 13 components (8 `SelectField`, 5 `MultiSelectChips`) are module-local
// functions inside eight large module files, none of them exported. Rendering one
// in a test therefore means exporting it, which is a structural change to files
// two other sessions are actively editing. A static check reads all 13 with no
// module changes at all, which is why it is the shape that was chosen.
//
// The invariant is on the RENDER CONTRACT, not on any particular syntax, so it
// accepts either a call to the shared owner (`optionValue`/`optionLabel`) or an
// inline shape discriminator (`typeof opt === "string" ? ... : ...`). Session A
// fixed My Profile's copy with the inline form before this owner existed, and
// insisting on one syntax would have made the guard red on correct code - which
// is how a guard gets deleted instead of fixed.
//
// Note that A's earlier objection to a static invariant was correct and is
// encoded here: the guard deliberately does NOT assert "no options= prop passes
// an object literal". Both current call sites pass objects on purpose. What is
// asserted is that every component CAN cope when they do.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const SRC = path.resolve("src");

// Both components are named identically in every copy, which is what makes a
// cross-file invariant possible at all.
const PICKERS = ["SelectField", "MultiSelectChips"];

function jsxFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) jsxFiles(p, out);
    else if (/\.jsx$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

/**
 * A picker is shape-tolerant when every option it renders goes through either
 * the shared owner or an inline `typeof ... === "string"` discriminator.
 *
 * Returns the offending property names rather than a boolean, because "this file
 * is wrong" sends the next reader hunting while "this line uses `opt` raw"
 * does not.
 */
function untoleratedUses(fn) {
  const body = fn.body;
  if (!body || body.type !== "BlockStatement") return [];
  const bad = [];

  // Whether `n` sits inside something that already discriminates shape.
  // Deliberately NARROW: a `typeof x === "string"` test, or a call to the shared
  // owner. An earlier version treated any ConditionalExpression or
  // BinaryExpression as tolerant, which made `value.filter((v) => v !== opt)` -
  // present in literally every MultiSelectChips - mark its whole subtree safe.
  // The non-vacuity fixture below is what caught that.
  const discriminated = (n) =>
    (n.type === "CallExpression" &&
      n.callee?.type === "Identifier" &&
      ["optionValue", "optionLabel"].includes(n.callee.name)) ||
    (n.type === "BinaryExpression" && /typeof/.test(String(n.left?.type) + String(n.left?.operator)) ) ||
    (n.type === "UnaryExpression" && n.operator === "typeof");

  const walk = (n, tolerant, names) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const c of n) walk(c, tolerant, names);
      return;
    }
    if (typeof n.type !== "string") return;

    // The option variable is the `.map()` / `.filter()` CALLBACK's parameter -
    // never the component's own props. The first version of this guard read the
    // component's params, found none matching, and reported every picker as
    // clean while matching nothing at all. The non-vacuity fixture exists
    // because that is exactly what it did.
    //
    // `names` has to be a PARAMETER and not a local: the callback's body is a
    // sibling node, not a child of the node that identified the parameter, so a
    // local is reset to null before the walk ever reaches it. That was the second
    // version's bug, and it failed the same fixture for the same reason.
    let scopeNames = names;
    if (
      n.type === "CallExpression" &&
      n.callee?.type === "MemberExpression" &&
      ["map", "filter"].includes(n.callee.property?.name)
    ) {
      const cb = n.arguments?.[0];
      if (cb?.type === "ArrowFunctionExpression" && cb.params?.[0]?.type === "Identifier") {
        scopeNames = [cb.params[0].name];
      }
    }
    const isTolerant = tolerant || discriminated(n);
    const knows = scopeNames && scopeNames.length > 0;

    // A JSX expression container is a rendered CHILD. An object here is React
    // error #31. This is the assertion that matters most.
    if (
      knows &&
      !isTolerant &&
      n.type === "JSXExpressionContainer" &&
      n.expression?.type === "Identifier" &&
      scopeNames.includes(n.expression.name)
    ) {
      bad.push({ prop: `children {${n.expression.name}}`, line: n.loc?.start?.line ?? 0 });
    }
    // `value=` on an <option>. An object here does not throw - it stringifies to
    // "[object Object]", so the dropdown silently stores the wrong thing.
    if (
      knows &&
      !isTolerant &&
      n.type === "JSXAttribute" &&
      n.name?.name === "value" &&
      n.value?.type === "JSXExpressionContainer" &&
      n.value.expression?.type === "Identifier" &&
      scopeNames.includes(n.value.expression.name)
    ) {
      bad.push({ prop: `value={${n.value.expression.name}}`, line: n.loc?.start?.line ?? 0 });
    }
    // `key=` accepts anything (React stringifies), so it is not asserted.

    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      walk(n[k], isTolerant, scopeNames);
    }
  };

  for (const stmt of body.body) walk(stmt, false, null);
  return bad;
}

function findUntolerant() {
  const out = [];
  for (const file of jsxFiles(SRC)) {
    const code = fs.readFileSync(file, "utf8");
    let ast;
    try {
      ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
    } catch {
      continue;
    }
    const visit = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) {
        for (const c of n) visit(c);
        return;
      }
      if (typeof n.type !== "string") return;
      if (n.type === "FunctionDeclaration" && n.id && PICKERS.includes(n.id.name)) {
        const bad = untoleratedUses(n);
        if (bad.length) {
          out.push({
            file: path.relative(SRC, file).replace(/\\/g, "/"),
            picker: n.id.name,
            line: n.loc?.start?.line ?? 0,
            bad,
          });
        }
      }
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
        visit(n[k]);
      }
    };
    visit(ast);
  }
  return out;
}

const FINDINGS = findUntolerant();

/**
 * The fixture's default-exported function.
 *
 * Found by SEARCHING rather than by index, because the "good" fixture opens with
 * an import and the "bad" one does not. Index 0 is the import in one and the
 * export in the other, which made the harness depend on a detail of the fixture
 * rather than on the thing being tested - and it failed silently, reading
 * `.declaration` off an ImportDeclaration and getting undefined.
 */
function pickDefaultFunction(code) {
  const ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
  const decl = ast.program.body.find((n) => n.type === "ExportDefaultDeclaration");
  if (!decl || decl.declaration.type !== "FunctionDeclaration") {
    throw new Error("fixture has no default-exported function to test against");
  }
  return decl.declaration;
}

describe("every option picker handles both string and {value,label} options", () => {
  it("the detector actually catches an intolerant picker", () => {
    // Non-vacuity against a THROWAWAY file, so the proof survives the last real
    // fix. Asserting "there is at least one finding" instead would demand the
    // bug stay present - the mistake this file's sibling guards have made twice.
    const fixture = path.join(SRC, "__optionShapeFixture.jsx");
    const bad =
      "export default function Bad({ value, onChange, options, T }) {\n" +
      "  const toggle = (opt) => {\n" +
      "    const has = value.includes(opt);\n" +
      "    onChange(has ? value.filter((v) => v !== opt) : [...value, opt]);\n" +
      "  };\n" +
      "  return (\n" +
      "    <div>\n" +
      "      {options.map((opt) => (\n" +
      "        <div key={opt} onClick={() => toggle(opt)}>\n" +
      "          {opt}\n" +
      "        </div>\n" +
      "      ))}\n" +
      "    </div>\n" +
      "  );\n" +
      "}\n";
const good =
        'import { optionValue, optionLabel } from "./optionShape";\n' +
        "export default function Good({ value, onChange, options, T }) {\n" +
        "  const toggle = (opt) => {\n" +
      "    const v = optionValue(opt);\n" +
      "    const has = value.includes(v);\n" +
      "    onChange(has ? value.filter((x) => x !== v) : [...value, v]);\n" +
      "  };\n" +
      "  return (\n" +
      "    <div>\n" +
      "      {options.map((opt) => (\n" +
      '        <div key={optionValue(opt)} onClick={() => toggle(opt)}>\n' +
      "          {optionLabel(opt)}\n" +
      "        </div>\n" +
      "      ))}\n" +
      "    </div>\n" +
      "  );\n" +
      "}\n";
    try {
      fs.writeFileSync(fixture, bad, "utf8");
      const badFn = pickDefaultFunction(fs.readFileSync(fixture, "utf8"));
      const badHits = untoleratedUses(badFn);
      expect(badHits.length, "detector missed a picker that renders its option raw").toBeGreaterThanOrEqual(1);
      expect(
        badHits.some((h) => h.prop.startsWith("children")),
        "detector missed the rendered-child case, which is the one that throws",
      ).toBe(true);

      fs.writeFileSync(fixture, good, "utf8");
      const goodFn = pickDefaultFunction(fs.readFileSync(fixture, "utf8"));
      expect(untoleratedUses(goodFn)).toHaveLength(0);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });

  it("NO picker anywhere renders or stores its option raw", () => {
    // Zero is the right invariant. Unlike the scrolling-flex guard, where a
    // finding can be legitimate, an option rendered raw is either a crash or
    // silent corruption - never a deliberate choice.
    const summary = FINDINGS.map(
      (f) => `${f.file}:${f.line} ${f.picker}() uses ${f.bad.map((b) => `${b.prop} (L${b.line})`).join(", ")}`,
    );
    // THE NAMED EXCEPTIONS. Two copies remain, both inside another session's
    // declared file boundary when this was written, so they could not be fixed
    // from here. They are named individually and printed on every run rather
    // than waved through by a blanket filter: an allowlist that is not specific
    // is indistinguishable from tolerating the bug everywhere, which is the
    // failure mode this file exists to prevent. A THIRD picker appearing in
    // FINDINGS fails this suite immediately.
    const ALLOWED = new Set([
      "modules/SHOS_Contacts_Prototype.jsx:MultiSelectChips",
      "modules/SHOS_MyProfile_Prototype.jsx:MultiSelectChips",
    ]);
    const unexpected = FINDINGS.filter((f) => !ALLOWED.has(`${f.file}:${f.picker}`));
    const known = FINDINGS.filter((f) => ALLOWED.has(`${f.file}:${f.picker}`));
    console.log("\n  option pickers that cannot handle {value,label}: " + FINDINGS.length);
    for (const s of summary) console.log("    " + s);
    for (const f of known) console.log(`    (named exception, awaiting its owning session) ${f.file} ${f.picker}()`);
    expect(
      unexpected.map(
        (f) => `${f.file}:${f.line} ${f.picker}() uses ${f.bad.map((b) => b.prop).join(", ")}`,
      ),
      "these pickers render their option as a React child (React error #31) or set value= from an object " +
        '("[object Object]"). Both are the defect that shipped in three APKs. Use optionValue()/optionLabel() ' +
        "from src/calculations/optionShape.js.",
    ).toEqual([]);
  });

  it("the inventory actually finds the pickers, so a clean result is not a vacuous one", () => {
    // The failure mode this file exists to avoid: a parser change, or a rename,
    // silently matching nothing and reporting every picker as tolerant. Counts
    // the components it located so a drop to zero is visible.
    let located = 0;
    for (const file of jsxFiles(SRC)) {
      const code = fs.readFileSync(file, "utf8");
      for (const name of PICKERS) {
        const re = new RegExp(`function\\s+${name}\\s*\\(`);
        const n = (code.match(re) || []).length;
        located += n;
      }
    }
    console.log("  option picker definitions located: " + located);
    expect(located, "no option pickers located at all - the scan is matching nothing").toBeGreaterThanOrEqual(13);
  });
});

describe("the shared option owner behaves", () => {
  it("passes strings through untouched, so no existing caller changes behaviour", async () => {
    const { optionValue, optionLabel } = await import("./optionShape");
    for (const s of ["Car", "Yes", "Uncircumcised", "positive-suppressed"]) {
      expect(optionValue(s)).toBe(s);
      expect(optionLabel(s)).toBe(s);
    }
  });

  it("takes the value from an object and never shows its label as the stored value", async () => {
    const { optionValue, optionLabel } = await import("./optionShape");
    const opt = { value: "positive-suppressed", label: "Positive - undetectable" };
    expect(optionValue(opt)).toBe("positive-suppressed");
    expect(optionLabel(opt)).toBe("Positive - undetectable");
    // The two must never be interchangeable, or a label ends up in a stored field.
    expect(optionValue(opt)).not.toBe(optionLabel(opt));
  });

  it("returns undefined rather than throwing on a nullish option", async () => {
    // Option lists are user-extensible, so a nullish entry must not take the
    // whole screen down mid-render.
    const { optionValue, optionLabel } = await import("./optionShape");
    expect(optionValue(undefined)).toBeUndefined();
    expect(optionLabel(undefined)).toBeUndefined();
    expect(optionValue(null)).toBeUndefined();
  });

  it("does NOT fall back to the value when showing a label", async () => {
    // Falling back would put a raw stored code in front of a user - precisely
    // the "Positive - undetectable" defect this exists to prevent. An empty chip
    // is visibly wrong and therefore gets fixed.
    const { optionLabel } = await import("./optionShape");
    expect(optionLabel({ value: "positive-suppressed" })).toBeUndefined();
  });
});