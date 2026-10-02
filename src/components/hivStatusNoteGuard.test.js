// Guard for the U=U note (added 1 Oct 2026).
//
// The whole safety of this feature rests on ONE property: the note appears on
// EVERY record, unconditionally. An earlier design showed it only where the
// status was positive-undetectable, and that was rejected because conditional UI
// reveals state - the note's PRESENCE would flag who is HIV-positive among a
// list of contacts, which is the same failure this app's anonymise mode exists to
// prevent, reached from the opposite direction.
//
// That property is invisible in rendered output and easy to reintroduce by
// accident, because every instinct when writing a screen is "only show this where
// it applies". So it is asserted against source.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "@babel/parser";

const JSX_TEXT = { sourceType: "module", plugins: ["jsx"] };

const read = (p) => readFileSync(resolve(process.cwd(), p), "utf8");
const CALC = read("src/calculations/hivStatusCalculations.js");
const NOTE = read("src/components/HivStatusNote.jsx");
// The citations render in the Glossary since 2 Oct 2026.
const GLOSSARY_SCREEN = read("src/modules/settings/GlossaryScreen.jsx");
const PROFILE = read("src/modules/SHOS_MyProfile_Prototype.jsx");
const CONTACTS = read("src/modules/SHOS_Contacts_Prototype.jsx");
const GLOSSARY = read("src/modules/settings/GlossaryScreen.jsx");

describe("the U=U statement is one owner, and it is person-neutral", () => {
  it("lives in exactly one module and is exported from there", () => {
    expect(CALC).toMatch(/export const U_U_SHORT/);
    // Non-vacuity: the copy must actually exist before the neutrality checks
    // below can mean anything.
    const short = CALC.match(/export const U_U_SHORT =\s*\n?\s*"([^"]+)"/);
    expect(short, "U_U_SHORT has no readable string - guard is vacuous").toBeTruthy();
  });

  it("reads as a conditional scientific fact, not a claim about a person", () => {
    // The wording rule from the design review: beside "Unknown", "this person's
    // undetectable viral load means they cannot transmit HIV" is nonsense and
    // implies the person IS undetectable. A dictionary definition, not a
    // descriptor.
    const short = CALC.match(/export const U_U_SHORT =\s*\n?\s*"([^"]+)"/)[1];
    expect(short.length).toBeGreaterThan(20);
    for (const banned of ["This person", "this person", "Their ", "their "]) {
      expect(short, `U_U_SHORT must not describe a person: contains "${banned}"`).not.toContain(banned);
    }
    // And it should still be a usable fact rather than a label.
    expect(short).toMatch(/undetectable/i);
    expect(short).toMatch(/50 copies/i);
  });

  it("the component offers no way to gate the note on a status", () => {
    // Structural, not conventional: if there is no prop to pass a status to, a
    // caller cannot condition it even by accident.
    //
    // Parsed rather than pattern-matched, because this repo has been bitten
    // repeatedly by regexes over JSX: a naive check on the prop text matches
    // `label = "HIV status"`, which is a STRING, not a prop that could gate
    // anything. AST, per the rule mostRecentTestDefinition.test.js records.
    const propNames = propNamesOfHivStatusNote();
    expect(propNames.length, "could not read HivStatusNote's props - guard is vacuous").toBeGreaterThan(0);
    expect(propNames, "HivStatusNote must not accept a status to gate on").not.toContain("status");
    expect(propNames, "nor anything that would carry one indirectly").not.toEqual(
      expect.arrayContaining([expect.stringMatching(/hiv|positive|suppress/i)]),
    );
  });
});

/** Every plain identifier name referenced inside a subtree. */
function identifiersIn(node) {
  const out = [];
  const stack = [node];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== "object") continue;
    if (n.type === "Identifier") out.push(n.name);
    if (n.type === "MemberExpression" || n.type === "OptionalMemberExpression") {
      // Keep the OBJECT, not the property: `contact.hivStatus` must surface as
      // `contact`, and `x.hivStatus` is caught by the whole-name check below.
      stack.push(n.object);
      continue;
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => stack.push(c));
      else if (v && typeof v === "object") stack.push(v);
    }
  }
  return out;
}

/** Prop names of HivStatusNote, via the AST rather than a regex over source. */
function propNamesOfHivStatusNote() {
  const ast = parse(NOTE, JSX_TEXT);
  const names = [];
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (
      n.type === "FunctionDeclaration" &&
      n.id?.name === "HivStatusNote" &&
      n.params?.[0]?.type === "ObjectPattern"
    ) {
      for (const p of n.params[0].properties) {
        if (p.type === "ObjectProperty") names.push(p.key.name ?? p.key.value);
      }
    }
    for (const k of Object.keys(n)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };
  visit(ast.program);
  return names;
}

/**
 * Every <HivStatusNote> usage in a file, and whether each is wrapped in a
 * condition. A JSX element directly inside `cond && <X/>` has a LogicalExpression
 * parent; that is the exact shape a future "only show where it applies" edit
 * would take, and it is what must never happen.
 */
function noteUsagesAndParents(source) {
  const ast = parse(source, JSX_TEXT);
  const parents = new Map();
  const stack = [{ node: ast.program, parent: null }];
  while (stack.length) {
    const { node, parent } = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (
      node.type === "JSXElement" &&
      node.openingElement?.name?.type === "JSXIdentifier" &&
      node.openingElement.name.name === "HivStatusNote"
    ) {
      parents.set(node, parent);
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) for (const c of v) stack.push({ node: c, parent: node });
      else if (v && typeof v === "object") stack.push({ node: v, parent: node });
    }
  }
  return parents;
}

describe("the note appears on every record, unconditionally", () => {
  it("is rendered on My Profile, in both the edit and read views", () => {
    const uses = noteUsagesAndParents(PROFILE);
    // Two sites: the edit sheet and ProfileDataView. Dropping one leaves a
    // screen where the note silently vanishes, which is the regression guarded.
    expect(uses.size, "expected the note in both the edit and read views").toBe(2);
  });

  it("is rendered on Contacts, in both the edit form and the read view", () => {
    const uses = noteUsagesAndParents(CONTACTS);
    expect(uses.size, "expected the note in both the edit form and read view").toBe(2);
  });

  it("no call site conditions the note on an HIV status", () => {
    // THE assertion. A usage whose parent is a LogicalExpression is
    // `something && <HivStatusNote/>`. That is the exact shape a future "only
    // show where it applies" edit takes, and it turns the note into a status
    // beacon.
    //
    // A condition is only a problem when it tests the STATUS. Gating on
    // anonymise mode is the opposite: it hides more, and that is a deliberate
    // asymmetry pinned separately below. So the condition is inspected rather
    // than banned outright.
    for (const [name, src] of [["My Profile", PROFILE], ["Contacts", CONTACTS]]) {
      const uses = noteUsagesAndParents(src);
      expect(uses.size, `${name}: no usage found - guard is vacuous`).toBeGreaterThan(0);
      for (const [node, parent] of uses) {
        const line = node.loc?.start?.line ?? 0;
        if (parent?.type === "LogicalExpression") {
          const refs = identifiersIn(parent.test);
          const statusish = refs.filter((r) => /^(hiv)?status$|isValidHivStatus|contactHivStatus|positive/i.test(r));
          expect(
            statusish.join(", "),
            `${name}:${line} the note is conditioned on a status - that is the disclosure this design exists to avoid`,
          ).toBe("");
        }
        // And no status-derived prop is passed to it either.
        const attrNames = (node.openingElement?.attributes || [])
          .filter((a) => a.type === "JSXAttribute")
          .map((a) => a.name?.name)
          .filter(Boolean);
        expect(attrNames.join(",") || "(none)", `${name}:${line} passes a status-ish prop`).not.toMatch(
          /status|hiv|positive|suppress/i,
        );
      }
    }
  });

  it("on Contacts it is suppressed by anonymise, like the status it sits beside", () => {
    // Anonymise masks HIV status deliberately. The note is a neutral fact, so
    // leaving it up would not disclose anything - but it is tied to the label
    // here, and consistency with the masked row matters more than the note
    // surviving. This is a deliberate asymmetry, so it is pinned.
    expect(CONTACTS).toMatch(/!\(hideFurther\s*\|\|\s*anonymise\)\s*&&\s*<HivStatusNote/);
  });
});

describe("the Glossary carries the layperson explanation and the evidence", () => {
  it("has a U=U entry", () => {
    expect(GLOSSARY).toMatch(/term:\s*"U=U/);
  });

  it("leads with plain language and names the source", () => {
    const entry = GLOSSARY.match(/term:\s*"U=U[^"]*",\s*body:\s*"([^"]+)"/);
    expect(entry, "no readable U=U glossary body - guard is vacuous").toBeTruthy();
    const body = entry[1];
    expect(body).toMatch(/cannot pass HIV on sexually/i);
    expect(body, "the glossary entry should carry its evidence").toMatch(/BHIVA/i);
    expect(body, "and the assay-dependence, which is why 'undetectable' is not a fixed state").toMatch(
      /laborator|manufacturer/i,
    );
  });
});
describe("the U=U sources are real, cited documents rather than assertions", () => {
  // ADDED 2 Oct 2026. The note became tappable and opens the evidence, because
  // the realistic audience for "undetectable = untransmittable" is often someone
  // who does not believe it. That makes the citation list load-bearing: a dead or
  // invented URL would leave the app asserting a medical claim with nothing to
  // check it against, which is worse than not offering the link at all.
  //
  // This asserts the SHAPE of each citation. It cannot assert a URL still resolves
  // - that needs a network and would rot - so what it does assert is that every
  // entry was recorded as checked, which is what makes a stale one findable.

  it("has at least one source, and the guard can read the list", async () => {
    const { U_U_SOURCES } = await import("../calculations/hivStatusCalculations");
    expect(Array.isArray(U_U_SOURCES), "U_U_SOURCES is missing or not an array - guard is vacuous").toBe(true);
    expect(U_U_SOURCES.length).toBeGreaterThan(0);
  });

  it("every source is a real https URL with a publisher and a date checked", async () => {
    const { U_U_SOURCES } = await import("../calculations/hivStatusCalculations");
    for (const s of U_U_SOURCES) {
      expect(s.url, "source has no url").toMatch(/^https:\/\//);
      expect(s.label, "source has no human label").toBeTruthy();
      expect(s.publisher, `"${s.label}" has no publisher`).toBeTruthy();
      expect(s.checkedOn, `"${s.label}" was never recorded as checked`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(s.checkedOn).toString(), `"${s.checkedOn}" is not a real date`).not.toMatch(/Invalid/);
    }
  });

  it("the sources are distinct documents, not the same link listed twice", async () => {
    const { U_U_SOURCES } = await import("../calculations/hivStatusCalculations");
    const urls = U_U_SOURCES.map((s) => s.url);
    expect(new Set(urls).size, "duplicate URL in the source list").toBe(urls.length);
  });

  it("the component actually renders those sources, and does so ungated", () => {
    // The list existing is not the same as the note showing it. Asserting only
    // the export would let a component that ignores it stay green forever.
    // CHANGED 2 Oct 2026: the sources moved to the GLOSSARY, which is where the
    // underlined "U=U" links. Asserting they render in the note would now pin
    // the design the owner explicitly rejected.
    expect(GLOSSARY_SCREEN).toMatch(/U_U_SOURCES/);
    expect(GLOSSARY_SCREEN).toMatch(/t\.sources/);
    // ...and the expand must not be conditioned on anything about the record.
    // Same reasoning as the rest of this file: conditional UI reveals state.
    expect(NOTE).not.toMatch(/\{[^}]*\bsuppressed\b[^}]*\}\s*&&\s*\{?showSentence/);
    // CHANGED 2 Oct 2026: the disclosure is now the info bubble revealing the
    // one-sentence statement, and the fuller text is in the Glossary.
    expect(NOTE).toMatch(/setShowSentence/);
    expect(NOTE).toMatch(/aria-expanded/);
  });

  it("links open externally and safely", () => {
    // Moved to the Glossary with the citations themselves.
    expect(GLOSSARY_SCREEN).toMatch(/target="_blank"/);
    // rel is the half that matters: without it the opened page gets a
    // window.opener handle back into the app.
    expect(GLOSSARY_SCREEN).toMatch(/rel="noopener noreferrer"/);
  });
});