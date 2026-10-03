// iconOnlyUIAudit.test.js
//
// WHAT THIS IS
// ------------
// The project's standing rule: "icon-only UI needs an explanatory affordance -
// a small InfoIcon, role="button", toggles a short caption on tap - unless the
// icon is a truly universal standard (a gear for Settings, a person for a
// profile, a magnifying glass for Search)."
//
// The 17 Sep 2026 audit found and fixed 3 genuine gaps but was honest that it
// was NOT exhaustive - it covered src/modules/*.jsx + App.jsx and stopped. This
// is the exhaustive pass, and more importantly it is a GATE rather than a
// one-off finding list, because this repo's most repeated lesson is that a
// check somebody runs once is not a check.
//
// WHY A PARSER AND NOT A REGEX
// ----------------------------
// Four audits in this repo failed on exactly that, recorded at length in
// CLAUDE.md: one scanner matched per-line so it could never see a background
// and a colour several lines apart and found 0 sites; one used a 3000-char
// window and matched 6 non-dialog components as dialogs; one demanded a closing
// brace where the source has a backtick and "had therefore never matched
// anything anywhere, and was reporting 'no regressions' from a detector that
// had never once fired"; and one printed "the detector is proven working
// because the safe count is non-zero" when that count was ZERO.
//
// @babel/parser is already present as a Vite dependency, so this costs nothing.
//
// THE FIVE DEFECTS FOUND IN THE SCANNER WHILE WRITING IT
// -------------------------------------------------------
// All five were caught by looking at real output and disbelieving it. They are
// listed because the next person to touch this file will want to know which
// parts are load-bearing.
//
// 1. Text detection that only understood a bare string literal in {}. Every
//    conditional, number and template came back as "no text", so 15 correct
//    elements were reported as unexplained - including a <button> whose entire
//    content is a Pill icon and the words "Log dose". Acting on that list would
//    have meant adding explanations to correct code.
// 2. A carve-out list written with the wrong icon names (CaretRight when the
//    code says ChevronRight), which silently matched nothing.
// 3. Classifying icons by their LOCAL alias. This repo aliases every icon on
//    import - `import { CaretRightIcon as ChevronRight }` - so the whole
//    carve-out list was being compared against names that do not exist in the
//    source. Fixed by resolving specifier.imported.name.
// 4. JSX nested inside an expression container was not walked for text, so a
//    collapsible header showing a count read as textless.
// 5. THE WORST ONE: "the scanner cannot tell whether there is text" was being
//    counted in the same bucket as "this element has no text". A guess reported
//    as a finding. Those are now a separate, explicitly undecidable bucket and
//    are never counted as gaps.
//
// The self-check below exists because of #5's mirror image: a text detector that
// silently returned "" for everything would report EVERY icon as unexplained and
// look like a very productive audit.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
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


// The rule's own carve-out, quoted from CLAUDE.md. Gear/person/magnifying-glass
// are the three named in the rule; close, plus, bin and check are the same
// category - a user knows them without this app teaching them.
const UNIVERSAL = new Set([
  "Gear", "GearSix", "GearFill",
  "User", "UserCircle", "UserCircleGear",
  "MagnifyingGlass", "UserFocus",
  "X", "XCircle", "Trash", "TrashSimple",
  "Plus", "PlusCircle", "Minus", "MinusCircle",
  "Check", "CheckCircle", "Info",
]);

// A chevron at the end of a row that carries its own visible label is the
// "this opens something" symbol saying the same thing the row already says.
// Without this, every settings row in the app is reported as unexplained.
const NAV_CHEVRONS = new Set([
  "CaretRight", "CaretLeft", "CaretUp", "CaretDown",
  "ArrowRight", "ArrowLeft", "ChevronRight", "ChevronLeft",
  "ChevronUp", "ChevronDown",
]);

const INTERACTIVE_ROLES = new Set(["button", "link", "tab", "menuitem", "switch", "checkbox"]);
const INTERACTIVE_TAGS = new Set(["button", "a"]);

/**
 * Visible text, understanding every expression form a React child can take.
 * A bare Identifier is deliberately NOT resolved: `{count}` could be a number,
 * a name, or nothing, and guessing is the same class of error in the other
 * direction. Those are reported as unknown, which is not the same as empty.
 */
function textOf(node, seen) {
  if (!node || seen.has(node)) return { text: "", unknown: false };
  seen.add(node);

  if (node.type === "JSXText") return { text: node.value.replace(/\s+/g, " "), unknown: false };

  if (node.type === "JSXExpressionContainer") {
    if (node.expression.type === "JSXEmptyExpression") return { text: "", unknown: false };
    return exprText(node.expression, seen);
  }

  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    let text = "", unknown = false;
    for (const c of node.children || []) {
      const r = textOf(c, seen);
      text += r.text;
      unknown = unknown || r.unknown;
    }
    return { text, unknown };
  }
  return { text: "", unknown: false };
}

function exprText(e, seen) {
  if (!e || seen.has(e)) return { text: "", unknown: false };
  switch (e.type) {
    case "StringLiteral":
    case "NumericLiteral":
      return { text: String(e.value), unknown: false };
    case "TemplateLiteral": {
      let t = "";
      for (const q of e.quasis) t += q.value.cooked ?? q.value.raw ?? "";
      return { text: t, unknown: false };
    }
    case "ConditionalExpression": {
      const a = exprText(e.consequent, seen);
      const b = exprText(e.alternate, seen);
      return { text: a.text + b.text, unknown: a.unknown || b.unknown };
    }
    case "LogicalExpression": {
      const a = exprText(e.left, seen);
      const b = exprText(e.right, seen);
      return { text: a.text + b.text, unknown: a.unknown || b.unknown };
    }
    case "BinaryExpression": {
      const a = exprText(e.left, seen);
      const b = exprText(e.right, seen);
      return { text: a.text + b.text, unknown: a.unknown || b.unknown };
    }
    case "JSXElement":
    case "JSXFragment": {
      let t = "";
      for (const ch of e.children || []) t += textOf(ch, seen).text;
      return { text: t, unknown: false };
    }
    case "ParenthesizedExpression":
      return exprText(e.expression, seen);
    case "Identifier":
      return { text: "", unknown: true };
    default:
      return { text: "", unknown: true };
  }
}

function iconChildren(node, iconNames) {
  const found = [];
  for (const c of node.children || []) {
    if (c.type !== "JSXElement") continue;
    const nm = c.openingElement.name;
    if (nm.type !== "JSXIdentifier") continue;
    const n = nm.name;
    if (n === "svg") found.push(n);
    else if (iconNames.has(n)) found.push(iconNames.get(n)); // the ALIAS fix
    else if (/^Phosphor/.test(n)) found.push(n);
  }
  return found;
}

function hasAttr(opening, name) {
  return (opening.attributes || []).some(
    (a) => a.type === "JSXAttribute" && a.name.name === name
  );
}

function walkFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkFiles(p));
    else if (/\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

export function scan() {
  const found = [];
  let filesScanned = 0;
  for (const file of walkFiles("src")) {
    const code = readFileSync(file, "utf8");
    if (!/@phosphor-icons\/react/.test(code)) continue;
    filesScanned++;

    let ast;
    try {
      ast = parse(code, { sourceType: "module", plugins: ["jsx"] });
    } catch {
      // A file this parser cannot read would silently shrink coverage, which is
      // how an audit goes quietly vacuous. Fail loudly instead.
      throw new Error(`icon-only audit could not parse ${file} - coverage would be a lie`);
    }

    const iconNames = new Map();
    for (const n of ast.program.body) {
      if (n.type !== "ImportDeclaration") continue;
      if (!/@phosphor-icons\/react/.test(n.source.value)) continue;
      for (const sp of n.specifiers) {
        iconNames.set(sp.local.name, sp.imported?.name ?? sp.local.name);
      }
    }

    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "JSXElement") {
        const op = node.openingElement;
        const tagName = op.name.type === "JSXIdentifier" ? op.name.name : "";
        const roleAttr = (op.attributes || []).find(
          (a) => a.type === "JSXAttribute" && a.name.name === "role"
        );
        const roleVal = roleAttr?.value?.type === "StringLiteral" ? roleAttr.value.value : null;

        const interactive =
          hasAttr(op, "onClick") ||
          (roleVal && INTERACTIVE_ROLES.has(roleVal)) ||
          INTERACTIVE_TAGS.has(tagName);

        if (interactive) {
          const icons = iconChildren(node, iconNames);
          const { text, unknown } = textOf(node, new Set());
          if (icons.length > 0 && text.trim().length === 0) {
            const names = icons.map((i) => i.replace(/Icon$/, ""));
            found.push({
              key: `${relative(".", file).replace(/\\/g, "/")}|${names.join(",")}`,
              file: relative(".", file).replace(/\\/g, "/"),
              line: op.loc.start.line,
              icons: names,
              carved:
                names.every((n) => UNIVERSAL.has(n)) ||
                names.every((n) => NAV_CHEVRONS.has(n)),
              unknown,
              ariaLabel: hasAttr(op, "aria-label"),
              title: hasAttr(op, "title"),
            });
          }
        }
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === "string") visit(v);
      }
    };
    visit(ast.program);
  }
  return { found, filesScanned };
}

// --- THE REVIEWED VERDICT ---------------------------------------------
// Every icon-only, non-carved element in the app, with the reason it is
// acceptable. Keyed by "file|icon" so ordinary line shifts elsewhere in a file
// do not produce a false failure, but a SECOND element of the same kind in the
// same file still does, because the count is asserted.
//
// A reason is mandatory. An entry with an empty string fails, so this list
// cannot grow by someone pasting a line in without deciding anything.
const VERDICTS = {
  "src/modules/SHOS_Contacts_Prototype.jsx|Star": {
    count: 1,
    reason:
      "Favourite toggle on a contact card. Reviewed 29 Sep: a real <button> with " +
      "aria-label stating action AND resulting state. No tap-to-reveal needed - a " +
      "star-as-favourite is as universal as the gear the rule already carves out, and " +
      "state is carried by fill-vs-outline AND gold-vs-grey, so not by colour alone.",
  },
  "src/modules/SHOS_Contacts_Prototype.jsx|Warning": {
    count: 1,
    reason:
      "Duplicate-candidates panel header. The scanner reports it as undecidable " +
      "because its text is {duplicateCandidates.length} - a MemberExpression, which " +
      "this scanner refuses to resolve rather than guess. Read by hand: the number " +
      "IS the visible text beside the triangle, so it is explained. Kept in the " +
      "verdict list rather than waved away, because 'I could not prove it' and " +
      "'it is fine' are different claims and only one of them is this.",
  },
};

describe("icon-only UI rule", () => {
  const { found, filesScanned } = scan();
  const candidates = found.filter((f) => !f.carved);

  it("scans a real number of files, and finds icon-only elements at all", () => {
    // Non-vacuity. A scanner that parses nothing, or that matches no rule, would
    // report zero gaps and this suite would be a very convincing no-op - the
    // exact failure CLAUDE.md records four times over.
    expect(filesScanned).toBeGreaterThan(10);
    expect(found.length).toBeGreaterThan(20);
  }, 30000);

  it("can actually see text, in every form React children take", () => {
    // The mirror of the defect above. If text detection returned "" for
    // everything, every icon would look unexplained and the scan would look
    // productive instead of broken.
    const src = `
      const A = () => (<button><Pill/>{"plain"}</button>);
      const B = () => (<button><Pill/>{7}</button>);
      const C = () => (<button><Pill/>{x ? "yes" : "no"}</button>);
      const D = () => (<button><Pill/>{\`tpl\`}</button>);
      const E = () => (<button><Pill/>{a || "fallback"}</button>);
      const F = () => (<button><Pill/>{"joined " + "parts"}</button>);
      const G = () => (<button><Pill/></button>);
      const H = () => (<button><Pill/>{count}</button>);
    `;
    const ast = parse(src, { sourceType: "module", plugins: ["jsx"] });
    const iconNames = new Map([["Pill", "Pill"]]);
    const seen = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "JSXElement" && iconChildren(node, iconNames).length) {
        const r = textOf(node, new Set());
        seen.push({ text: r.text.trim(), unknown: r.unknown });
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v.type === "string") visit(v);
      }
    };
    visit(ast.program);

    expect(seen.map((s) => s.text)).toEqual([
      "plain", "7", "yesno", "tpl", "fallback", "joined parts", "", "",
    ]);
    // And the last one must be UNDECIDABLE, not "no text". If it were reported
    // as empty it would be filed as a gap, which is defect #5 all over again.
    expect(seen[7].unknown).toBe(true);
  }, 30000);

  it("every icon-only element has a recorded, reasoned verdict", () => {
    // A verdict with no reason is not a verdict. This is what stops the list
    // growing by someone adding a line without deciding anything.
    for (const [key, v] of Object.entries(VERDICTS)) {
      expect(typeof v.reason, `${key} needs a reason`).toBe("string");
      expect(v.reason.length, `${key} reason must not be empty`).toBeGreaterThan(40);
      expect(Number.isInteger(v.count), `${key} needs a count`).toBe(true);
      expect(v.count, `${key} count must be positive`).toBeGreaterThan(0);
    }
  }, 30000);

  it("finds exactly the reviewed set - a NEW icon-only element fails this", () => {
    const actual = {};
    for (const c of candidates) {
      actual[c.key] = (actual[c.key] || 0) + 1;
    }
    // Normalise to the reviewed shape so a missing entry and a wrong count both
    // fail with a diff rather than a bare undefined.
    const expected = Object.fromEntries(
      Object.entries(VERDICTS).map(([k, v]) => [k, v.count])
    );
    expect(actual).toEqual(expected);
  }, 30000);

  it("the favourite star keeps the semantics the audit gave it", () => {
    // The one real gap this audit found. Pinned directly so the fix cannot be
    // quietly reverted by a later refactor of the card, which is exactly what
    // happened the first time: the 17 Sep nested-interactive fix changed this
    // card and left the star with no role, no tabIndex and no name.
    const src = readFileSync("src/modules/SHOS_Contacts_Prototype.jsx", "utf8");
    const star = src.match(/<button[\s\S]{0,700}?<Star\b[\s\S]{0,200}?<\/button>/);
    expect(star, "favourite control should be a real <button>").not.toBeNull();
    // Not a div with a click handler: that was the defect.
    expect(star[0]).not.toMatch(/^<div/);

    // MUTATION-FOUND WEAKNESS. The first version of this assertion was just
    // /aria-label=/, and mutation testing showed it passed happily against
    // `aria-label={undefined}` - the attribute NAME was still there with no
    // value, which is the same defect it was written to prevent. Asserting an
    // attribute exists is not the same as asserting it says something.
    expect(star[0]).toMatch(/aria-label=\{contact\.favourited/);
    expect(star[0]).toMatch(/Remove \$\{contact\.name\} from favourites/);
    expect(star[0]).toMatch(/Add \$\{contact\.name\} to favourites/);
    expect(star[0]).not.toMatch(/aria-label=\{undefined\}/);
  }, 30000);
});
