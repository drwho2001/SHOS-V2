// ADDED 9 Oct 2026 (t052) - the jargon notes must stay SHORT, must stay
// UNCONDITIONAL, and every screen that renders one must be able to reach the
// Glossary.
//
// WHY A GATE AND NOT A COMMENT. jargonNotes.js states three rules in prose: each
// note is one sentence under ~150 characters, none refers to a particular
// record, and JargonNote takes no free text. All three are the kind of rule this
// repo has watched erode: they hold on the day they are written and nobody
// checks them again. The U=U note in HivStatusNote.jsx is the worked example of
// WHY the length rule exists - it once rendered its whole paragraph on every
// record and was reverted.
//
// WHY THE "UNCONDITIONAL" TEST IS A SOURCE SCAN RATHER THAN A RUNTIME ONE.
// JargonNote has no value prop, so conditionality can only enter through its
// noteKey or its note text. Asserting the component source never reads a record
// is therefore sufficient, and it is the assertion that would catch someone
// reintroducing the pattern the component's own comments document as
// disqualifying - an explanation that appears on some rows and not others
// discloses by its presence.
//
// THE SHARED-COPY DIRECTION, because it is the one that actually bites. A
// per-screen free-text prop would let two forms explain "2-1-1" differently and
// pass every other assertion here. So JargonNote takes a KEY, not text, and
// every key any screen passes is asserted to exist.
//
// Explicit timeouts throughout, same reason as uuNoteLinkGuard.test.js: this
// walks all of src/ and parses every .jsx with @babel/parser on each run. Vitest's
// 5s default is not a budget for an AST sweep - under full-suite load on this
// machine those guards timed out and reported failures of assertions they were
// never evaluating.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JARGON_NOTES } from "../calculations/jargonNotes";
// The AST helpers moved to glossaryPropChain.js in t108, shared with
// uuNoteLinkGuard.test.js. They were local to this file until the same
// prop-chain bug had to be guarded in both places, and two hand-maintained copies
// of mutation-proven logic is exactly how one of them ends up checking a stale
// version of the app. Reasoning moved with the code; assertions are unchanged.
import {
  jsxFiles,
  walk,
  parseFile,
  mountsOf,
  destructuredProps,
  receiverChain,
  renderersOf,
  parseAllJsx,
} from "./glossaryPropChain";

const SRC = path.resolve("src");

/**
 * Every function that encloses a mount and can receive props, nearest first.
 *
 * THE WHOLE CHAIN, NOT THE INNERMEST FRAME - and that is not a refinement, it is
 * the difference between this guard working and not. The first version reported
 * only the nearest enclosing component, which passed while EncountersModule had
 * `onOpenGlossary` dropped from its own signature: EncounterEditSheet still
 * declared it, so the signature assertion was satisfied, while nothing was
 * actually passing the prop down and every Glossary link on that screen was
 * dead. Proven by mutation, not by reading. A prop threaded through N components
 * has to be accepted by all N, so all N are returned and all N are asserted.
 *
 * Functions taking NO parameters are skipped: they cannot be handed props, so
 * they are render helpers or IIFEs. Home's rings block is one - it closes over
 * its enclosing component's props rather than accepting its own, and reporting
 * it as the receiver would be a false positive.
 *
 * Implementation: glossaryPropChain.js receiverChain.
 */

// receiverChain, renderersOf, mountsOf, jsxFiles, walk, parseFile and
// destructuredProps are all imported from ./glossaryPropChain.js. Their
// doc comments - including why the render relationship rather than the lexical
// one, and why the leaf component's own prop is `onOpen` - live with the
// implementations there, shared with uuNoteLinkGuard.test.js.

const ALL = jsxFiles(SRC);
const rel = (f) => path.relative(SRC, f).replace(/\\/g, "/");

// Body-and-year in parentheses, e.g. "(BASHH 2025)". Deliberately does NOT match
// a bare body name with no date: an attribution the reader cannot date is not one
// they can weigh against a guideline revision.
const SOURCE_RE = /\((BASHH|CDC|NHS|WHO)\s*\d{4}\)/i;

describe("jargon notes stay short, shared, and unconditional", () => {
  it("every noteKey any screen passes exists in the shared copy", () => {
    const bad = [];
    let checked = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const m of mountsOf(ast, "JargonNote")) {
        if (m.noteKey === null) continue;
        checked++;
        if (!Object.prototype.hasOwnProperty.call(JARGON_NOTES, m.noteKey)) {
          bad.push(`${rel(f)}:${m.line} noteKey "${m.noteKey}" is not in JARGON_NOTES`);
        }
      }
    }
    expect(bad, "these notes would throw at render time - JargonNote rejects an unknown key").toEqual([]);
    expect(checked, "found no literal noteKey mounts - the guard is not looking where they are").toBeGreaterThanOrEqual(2);
  }, 30000);

  it("JargonNote takes a key, not free text, so two screens cannot explain one term two ways", () => {
    const src = fs.readFileSync(path.join(SRC, "components", "JargonNote.jsx"), "utf8");
    const signature = /export function JargonNote\(\{([\s\S]*?)\}\)/.exec(src);
    expect(signature, "could not read JargonNote's parameter list").not.toBeNull();
    const props = signature[1];
    expect(props, "JargonNote must take noteKey").toMatch(/noteKey/);
    // A `text`/`label`-as-content prop would let each screen pass its own
    // wording past every other assertion in this file.
    expect(props, "JargonNote must not accept caller-supplied copy").not.toMatch(/\b(text|copy|body|children|explanation)\b/);
  }, 30000);

  it("every note is one sentence and short enough to sit beside a form field", () => {
    // The bound is the point. An always-visible explanation of five sentences
    // is a paragraph, and a paragraph beside every jargon term turns a form
    // into prose nobody reads.
    const bad = [];
    for (const [key, note] of Object.entries(JARGON_NOTES)) {
      if (note.length > 150) bad.push(`${key}: ${note.length} chars`);
      const sentences = (note.match(/[.!?](\s|$)/g) || []).length;
      if (sentences > 1) bad.push(`${key}: ${sentences} sentences`);
    }
    expect(bad, "these notes are too long to be a tap-to-reveal aside").toEqual([]);
    expect(Object.keys(JARGON_NOTES).length, "no notes defined - the guard is not looking at anything").toBeGreaterThanOrEqual(4);
  }, 30000);

  it("a note stating CLINICAL guidance names its source inline", () => {
    // An unattributed dosing schedule at the point of use reads as developer
    // folk wisdom, which is the thing that makes someone decline a dose. So a
    // note carrying clinical claims must attribute them in the same sentence.
    //
    // The test is on the SHAPE rather than a hardcoded list of which note is
    // clinical: a note that mentions a regimen, a dose count or a time window
    // must name a source. A note that only explains this app's own vocabulary
    // is exempt, because citing something external would misrepresent an internal
    // convention as clinical guidance - which is its own kind of wrong.
    const CLINICAL = /\b(pill|dose|regimen|hours?|days?|window|interval|guidance|guideline|prEP|doxypep)\b/i;
    const bad = [];
    for (const [key, note] of Object.entries(JARGON_NOTES)) {
      if (!CLINICAL.test(note)) continue;
      if (!SOURCE_RE.test(note)) bad.push(`${key}: states clinical guidance with no inline source`);
    }
    expect(bad, "these notes read as guidance but attribute nothing - add (BODY YEAR) or drop the clinical claim").toEqual([]);
  }, 30000);

  it("an app-vocabulary note does not cite anything external", () => {
    // The converse of the rule above, and the one that keeps this from becoming
    // a citation-shaped decoration. "role-axes" explains a convention this app
    // invented; attaching a guideline to it would lend clinical authority to an
    // internal choice.
    const vocabOnly = Object.entries(JARGON_NOTES).filter(([, n]) => /\/\s*(sub|Vers|Switch)\b/.test(n));
    for (const [key, note] of vocabOnly) {
      expect(note, `${key} explains this app's own vocabulary and should not cite a body`).not.toMatch(SOURCE_RE);
    }
    expect(vocabOnly.length, "no vocabulary-only note found - the check is not looking at anything").toBeGreaterThanOrEqual(1);
  }, 30000);

  it("no note text refers to a record or a value", () => {
    // Conditional or value-specific explanatory text discloses by its presence -
    // the failure HivStatusNote.jsx documents at length. It is also the reason
    // the DoxyPEP note says what qualifying activity IS rather than whether
    // this encounter qualifies.
    const bad = [];
    for (const [key, note] of Object.entries(JARGON_NOTES)) {
      if (/\b(your (last|previous|most recent)|this (encounter|record|dose)|you (missed|took|have))\b/i.test(note)) {
        bad.push(`${key}: reads as a claim about a record`);
      }
    }
    expect(bad, "these notes describe a value, so their presence would flag it").toEqual([]);
  }, 30000);

  it("the note is a disclosure, never a hover-only tooltip", () => {
    // This app targets touchscreens; a `title` attribute does not exist there.
    // medicationCalculations.js already records that lesson about the title
    // tooltip it used to rely on.
    const src = fs.readFileSync(path.join(SRC, "components", "JargonNote.jsx"), "utf8");
    expect(src, "must expose expanded state").toMatch(/aria-expanded/);
    expect(src, "must not rely on a title tooltip").not.toMatch(/\btitle=/);
    expect(src, "must render the sentence only when opened").toMatch(/open\s*&&\s*note/);
  }, 30000);

  it("every component that renders a JargonNote accepts onOpenGlossary", () => {
    const bad = [];
    let checked = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const r of receiverChain(ast, "JargonNote", "onOpenGlossary")) {
        checked++;
        if (!r.accepts) bad.push(`${rel(f)}:${r.line} ${r.fn} is in the chain above a JargonNote but does not accept onOpenGlossary`);
      }
    }
    expect(bad, "these break the prop chain, so a note's Glossary link goes dead").toEqual([]);
    expect(checked, "found no enclosing components - the guard is not looking where they are").toBeGreaterThanOrEqual(1);
  }, 30000);

  it("every component that RENDERS a note-bearing component accepts onOpenGlossary", () => {
    // The transitive direction, and the only one that survives mutation. Two
    // narrower checks both stayed green while EncountersModule had
    // `onOpenGlossary` dropped from its signature:
    //
    //  - the chain walk above, because EncounterEditSheet is not lexically
    //    INSIDE EncountersModule, it is a sibling component it renders;
    //  - the mount-site check below, because <EncounterEditSheet
    //    onOpenGlossary={onOpenGlossary}> still passed the prop - it was just
    //    passing undefined, which no single-file AST check can see.
    //
    // So this walks the render relationship instead: a component that mounts
    // something needing the prop must accept it, to a fixpoint. It is the
    // MyProfileModule test from uuNoteLinkGuard.test.js, generalised from one
    // hand-named component to however many turn out to need one.
    const needs = new Set(["JargonNote"]);
    const bad = [];
    // Parsed ONCE, outside the fixpoint, for the same reason as the identical
    // fixpoint in uuNoteLinkGuard.test.js: parsing every file per round handed
    // all of src/ to @babel/parser six times over for a result that cannot
    // change between rounds. Only the question changes; the source does not.
    const parsed = parseAllJsx(SRC);
    let grew = true;
    let rounds = 0;
    while (grew && rounds < 6) {
      grew = false;
      rounds++;
      for (const { file: f, ast } of parsed) {
        for (const r of renderersOf(ast, needs, "JargonNote")) {
          if (!r.supplied) {
            bad.push(`${rel(f)}:${r.line} ${r.name} renders ${r.child} without supplying onOpenGlossary`);
            continue;
          }
          // Supplying it is not always enough. Passing a bare identifier means
          // the value comes from this component's own props or scope, so it has
          // to be something the component actually has. An inline lambda is a
          // self-contained supply and needs no signature at all - which is why
          // Settings passes MyProfileModule `onOpenGlossary={() => ...}` and is
          // correct, and why requiring acceptance everywhere reported Settings,
          // Healthcare and App as broken when all three are wired properly.
          if (r.supplied === "identifier" && !r.accepts && !r.declaredHere) {
            bad.push(`${rel(f)}:${r.line} ${r.name} passes onOpenGlossary={${r.identifier}} but neither accepts it nor declares it`);
            continue;
          }
          // Only keep climbing within files this change touches. Above that line
          // the chain crosses into a PRE-EXISTING gap: ClinicCardScreen renders
          // MyProfileModule, which renders a note, but HealthcareScreen and
          // HomeScreen never pass onOpenGlossary down to ClinicCardScreen - so
          // the U=U link is already dead on that route. That is a real bug and a
          // real finding, but it predates this change and fixing it means
          // editing App.jsx and three module entry points. It is tracked as its
          // own task rather than folded in here, so this guard stays an assertion
          // about what t052 introduced.
          if (r.name && !needs.has(r.name) && r.fileRendersLeaf) {
            needs.add(r.name);
            grew = true;
          }
        }
      }
    }
    expect(rounds, "prop chain deeper than the fixpoint bound - raise it deliberately").toBeLessThan(6);
    expect(bad, "these leave a note's Glossary link wired to nothing").toEqual([]);
    expect(needs.size, "found no note-bearing components - the guard is not looking at anything").toBeGreaterThanOrEqual(4);
  }, 30000);

  it("every JargonNote mount passes onOpen", () => {
    // The note's OWN prop is `onOpen`, not `onOpenGlossary` - the same naming as
    // HivStatusNote, where onOpen is "open the Glossary entry". Asserting
    // `onOpenGlossary` here was wrong and this test caught it: every mount
    // reported as missing a prop it was in fact passing, under a different name.
    // The prop-chain test below is the one that asserts onOpenGlossary, because
    // that is the name the prop travels under between components.
    const bad = [];
    let n = 0;
    for (const f of ALL) {
      const ast = parseFile(f);
      if (!ast) continue;
      for (const m of mountsOf(ast, "JargonNote")) {
        n++;
        if (!m.props.includes("onOpen")) bad.push(`${rel(f)}:${m.line} JargonNote without onOpen`);
      }
    }
    expect(bad, "these notes would render a link wired to nothing").toEqual([]);
    expect(n, "found no JargonNote mounts - the guard is not looking where they are").toBeGreaterThanOrEqual(4);
  }, 30000);

  it("App.jsx passes onOpenGlossary to every ActiveModule, which is how Encounters gets it", () => {
    // EncountersModule's glossary link depends entirely on this. The prop is
    // passed generically to ActiveModule, so a screen only has to declare it in
    // its own signature.
    const app = fs.readFileSync(path.join(SRC, "App.jsx"), "utf8");
    expect(app).toMatch(/openSettingsToGlossary/);
    // Built with new RegExp rather than a literal, for two reasons. The pattern
    // contains the sequence "/>", which terminates a regex literal early and
    // takes the rest of the line with it. And the negative lookahead skips the
    // `<ActiveModule />` in App.jsx's own comment (line ~1461) - that one is
    // prose about re-rendering, and matching it is how this assertion first
    // failed while the real mount sat right below it, correctly wired.
    const active = new RegExp("<ActiveModule\\s+(?![/]?>)[\\s\\S]{0,1500}?/>").exec(app);
    expect(active, "could not find the ActiveModule mount").not.toBeNull();
    expect(active[0], "ActiveModule does not receive onOpenGlossary").toMatch(/onOpenGlossary/);
  }, 30000);

  it("the Glossary defines each term these notes point at", () => {
    // The note is the short form and the Glossary holds the full entry; if the
    // Glossary never gained an entry the link promises somewhere that defines
    // the term and lands on a search that does not.
    const glossary = fs.readFileSync(path.join(SRC, "modules", "settings", "GlossaryScreen.jsx"), "utf8");
    expect(glossary).toMatch(/term: "BASHH"/);
    expect(glossary).toMatch(/term: "PrEP"/);
    expect(glossary).toMatch(/term: "DoxyPEP"/);
  }, 30000);
});
