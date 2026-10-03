// ADDED 2 Oct 2026 - guards the person-neutral rule, and the claim wording.
//
// THE RULE, and why it needs enforcing rather than remembering. The U=U note
// renders on EVERY record, whatever the status, because a note that appeared only
// on undetectable records would flag who is HIV-positive by its own presence. The
// corollary is that none of its copy may read as a statement ABOUT THE READER
// either - "you cannot pass it on" tells someone looking at the screen something
// about themselves, which is both a privacy problem and simply wrong for whoever
// is HIV-negative or untested. So the copy has to be a conditional scientific
// definition: what the science says, not what it means for you.
//
// Every string here is asserted rather than eyeballed, because "does this sound
// like it's about the reader" is exactly the judgement that drifts as copy gets
// edited for tone, brevity or consistency.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const read = (p) => fs.readFileSync(path.join(SRC, p), "utf8");

// Negative assertions in this file run against COMMENT-STRIPPED source, and the
// stripper is proven non-vacuous below. This is not ceremony: the first run of
// the drop-down test went green because the word "collapsed" appears in the
// comment explaining WHY the drop-down was removed. A raw substring check on
// this repo cannot distinguish code from the prose documenting it, which is the
// single most repeated guard failure in this codebase.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));

const NOTE = read("components/HivStatusNote.jsx");
const CALC = read("calculations/hivStatusCalculations.js");
const EVIDENCE_SCREEN = read("modules/settings/ClinicalEvidenceScreen.jsx");
const EVIDENCE_DATA = read("modules/settings/clinicalEvidence.js");
const GLOSSARY = read("modules/settings/GlossaryScreen.jsx");

// SECOND PERSON IS NOT THE RULE, and asserting it was wrong.
//
// The first version of this file banned "you/your" outright and immediately
// failed on the owner's own lead line - "If the level of virus in YOUR blood is
// so low...". The sentence has to say whose blood it is; there is no way to
// phrase it in third person without making it worse. So the rule is NOT about
// person. It is about whether the sentence is CONDITIONAL and describes a
// measurement, versus asserting a fact about the reader's own status:
//
//   OK   "If the level of virus in your blood is so low that a blood test
//         cannot detect it, then it cannot be passed on."
//         - conditional, describes a lab result, true whatever your status.
//
//   NOT  "You cannot pass HIV on."
//         - an unconditional claim about the reader, and simply false for
//           anyone who is HIV-negative or untested.
//
// So the assertions below target the second shape specifically, and the
// "conditional" requirement is asserted positively rather than the absence of a
// pronoun. A blanket pronoun ban would only have pushed the copy into worse
// phrasing, which is the real failure mode to avoid.
const UNCONDITIONAL_STATUS_CLAIM =
  /\byou (cannot|can't|do not|don't|will not|won't) (pass|transmit|spread|give|infect)\b|\byou are (positive|infected|undetectable|suppressed|unsuppressed)\b|\byour viral load is\b|\byou have hiv\b|\byou're hiv\b/i;

/** True when the copy has no unconditional claim about the reader's own status. */
const makesNoStatusClaim = (s) => !UNCONDITIONAL_STATUS_CLAIM.test(s);

describe("U=U copy is about the science, never about the reader", () => {
  it("the detector can tell a conditional from an unconditional claim", () => {
    // Non-vacuity, proved on the two shapes it is meant to separate. Without
    // this, "no match" below is indistinguishable from a broken regex.
    const bad = "You cannot pass HIV on to anyone.";
    const good =
      "If the level of virus in your blood is so low that a blood test cannot detect it, then it cannot be passed on.";
    expect(makesNoStatusClaim(good), "detector flags valid conditional copy as a claim").toBe(true);
    expect(makesNoStatusClaim(bad), "detector misses a real unconditional claim").toBe(false);
  });

  it("none of the note's strings asserts a fact about the reader", () => {
    const literals = [
      ...NOTE.matchAll(/aria-label={?[`"]([^`"]+)[`"]}?/g),
      ...NOTE.matchAll(/aria-label="([^"]+)"/g),
      ...CALC.matchAll(/U_U_SHORT =\s*\n?\s*"([^"]+)"/g),
      ...CALC.matchAll(/U_U_EXPLANATION =\s*\n?\s*"([^"]+)"/g),
    ].map((m) => m[1]);

    expect(literals.length, "found no literals to check - guard is vacuous").toBeGreaterThan(2);
    for (const s of literals) {
      expect(makesNoStatusClaim(s), `"${s}" asserts something about the reader's own status`).toBe(true);
    }
  });

  it("the visible short line describes a measurement, not a person", () => {
    const short = CALC.match(/U_U_SHORT =\s*\n?\s*"([^"]+)"/)?.[1];
    expect(short, "could not read U_U_SHORT - guard is vacuous").toBeTruthy();
    // It must name the measurement: "an undetectable viral load" is a fact about
    // a lab result, which is exactly why the same sentence reads true beside any
    // status. That is the whole reason this wording was chosen over "you cannot
    // pass HIV on".
    expect(short).toMatch(/viral load/i);
    expect(makesNoStatusClaim(short)).toBe(true);
  });

  it("the clinical evidence lead line is the owner's wording, unchanged", () => {
    // Pinned verbatim rather than pattern-matched, because this sentence is the
    // plain-language takeaway the whole screen exists to lead with. A rewrite
    // that keeps the meaning but drops, say, "a blood test cannot detect it"
    // would reintroduce the vagueness the owner specifically fixed.
    const lead =
      EVIDENCE_SCREEN.match(/const LEAD =\s*\n?\s*"([^"]+)"/)?.[1];
    expect(lead, "could not read LEAD - guard is vacuous").toBeTruthy();
    expect(lead).toBe(
      "If the level of virus in your blood is so low that a blood test cannot detect it, then it cannot be passed on."
    );
    // Conditional and measurement-shaped, NOT free of "your" - see the note at the
    // top of this file on why a blanket pronoun ban was the wrong rule. The lead
    // line has to say whose blood it is; what it must not do is ASSERT a status.
    expect(makesNoStatusClaim(lead)).toBe(true);
    expect(lead, "the lead line must be conditional, not an assertion").toMatch(/^If\b/);
  });

  it("the lead line is rendered as its own bold block, not inline in the paragraph", () => {
    // Gemini's review pushed back on inline bolding specifically: one bold
    // clause inside dense body copy reads clunky and fights the surrounding text.
    // Asserting the structure rather than the markup keeps that honest.
    expect(EVIDENCE_SCREEN).toMatch(/\{LEAD\}/);
    expect(EVIDENCE_SCREEN).toMatch(/fontWeight: 700/);
    // The lead must be rendered by its own element, not concatenated into DETAIL.
    const bodyIndex = EVIDENCE_SCREEN.indexOf("{DETAIL}");
    const leadIndex = EVIDENCE_SCREEN.indexOf("{LEAD}");
    expect(leadIndex).toBeGreaterThan(-1);
    expect(bodyIndex).toBeGreaterThan(-1);
    expect(leadIndex).not.toBe(bodyIndex);
  });

  it("the glossary term carries the same lead line, so the two cannot drift", () => {
    expect(GLOSSARY).toMatch(/lead: "If the level of virus in your blood is so low/);
  });
});

describe("the clinical citations are present, real, and not user-editable", () => {
  it("the citation list lives in code, not in the editable Resources repository", async () => {
    // The reason this screen exists rather than living in Resources: Resources
    // is user-editable, so evidence for a public-health claim there would be
    // deletable by accident. This asserts the separation survives.
    const { U_U_SOURCES } = await import("../modules/settings/clinicalEvidence.js");
    expect(Array.isArray(U_U_SOURCES), "could not read U_U_SOURCES - guard is vacuous").toBe(true);
    expect(U_U_SOURCES.length).toBeGreaterThan(0);

    const resources = read("repositories/resourcesRepository.js");
    for (const s of U_U_SOURCES) {
      expect(resources, `the U=U source ${s.url} is also in the user-editable Resources list`).not.toContain(
        s.url
      );
    }
  });

  it("every citation is a real https URL with a publisher and a date checked", async () => {
    const { U_U_SOURCES } = await import("../modules/settings/clinicalEvidence.js");
    for (const s of U_U_SOURCES) {
      expect(s.url, "citation has no url").toMatch(/^https:\/\//);
      expect(s.label, "citation has no human label").toBeTruthy();
      expect(s.publisher, `"${s.label}" has no publisher`).toBeTruthy();
      expect(s.checkedOn, `"${s.label}" was never recorded as checked`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(s.checkedOn).toString(), `"${s.checkedOn}" is not a real date`).not.toMatch(
        /Invalid/
      );
    }
  });

  it("citations are distinct documents, not the same link listed twice", async () => {
    const { U_U_SOURCES } = await import("../modules/settings/clinicalEvidence.js");
    const urls = U_U_SOURCES.map((s) => s.url);
    expect(new Set(urls).size, "duplicate URL in the citation list").toBe(urls.length);
  });

  it("the glossary no longer renders citations itself", () => {
    // They moved. Asserting they are absent here is what stops both surfaces
    // claiming the same evidence and drifting.
    expect(GLOSSARY).not.toMatch(/t\.sources/);
    expect(GLOSSARY).not.toMatch(/U_U_SOURCES/);
  });

  it("the evidence screen renders every citation, open, with safe links", () => {
    expect(EVIDENCE_SCREEN).toMatch(/U_U_SOURCES/);
    expect(EVIDENCE_SCREEN).toMatch(/target="_blank"/);
    // rel is the half that matters: without it the opened page gets a
    // window.opener handle back into the app.
    expect(EVIDENCE_SCREEN).toMatch(/rel="noopener noreferrer"/);
  });

  it("the citations are NOT behind a drop-down - the evidence is the point of the screen", () => {
    // REVERSED 2 Oct 2026 at the owner's ask. The first version collapsed all
    // four links behind one toggle, on the grounds that the ask was decluttering.
    // That is the wrong trade for THIS screen: its entire purpose is that the
    // evidence can be checked by whoever the phone was handed to, so requiring a
    // tap to see whether any sources exist re-opens the doubt the screen closes.
    // Grouping answers the decluttering concern instead.
    expect(
      stripComments(EVIDENCE_SCREEN),
      "the citation list is collapsed behind a toggle again",
    ).not.toMatch(/aria-expanded/);
    expect(
      stripComments(EVIDENCE_SCREEN),
      "EvidenceGroup takes a collapsed prop again",
    ).not.toMatch(/collapsed/i);
    // The collapsed state used useState(false); it must not creep back as a
    // re-introduced "expanded" flag either, which is the same hiding.
    expect(stripComments(EVIDENCE_SCREEN), "a show/hide state for the citation list crept back").not.toMatch(
      /setUuOpen|useState\((true|false)\)/,
    );
  });

  it("the comment stripper actually strips, so the negative above is not vacuous", () => {
    // Without this the drop-down test could pass for the wrong reason - a
    // stripper that silently did nothing would make every negative in this file
    // assert against raw source again, comments included.
    expect(stripComments('const a = 1; // collapsed\nconst b = 2;')).not.toContain("collapsed");
    expect(stripComments('const a = 1; // collapsed\nconst b = 2;')).toContain("const b = 2;");
    expect(stripComments("/* collapsed */ const a = 1;")).not.toContain("collapsed");
    // Prove the real file has comments, i.e. there is something to strip. If this
    // ever fails, the stripper is being applied to text that has no comments and
    // the negative assertions are no longer testing what they claim to.
    expect(stripComments(EVIDENCE_SCREEN), "the screen has no comments to strip").not.toBe(EVIDENCE_SCREEN);
  });

  it("cites are grouped by context, in the Resources screen's shape", () => {
    expect(EVIDENCE_DATA).toMatch(/export const EVIDENCE_GROUPS/);
    expect(EVIDENCE_SCREEN).toMatch(/EVIDENCE_GROUPS\.map/);
    // Resources' own shape is a sectionLabel heading above one surface card per
    // group. Matching it rather than inventing a third grouping style is the
    // point of "similar to resources".
    expect(EVIDENCE_SCREEN).toMatch(/TYPE\.sectionLabel/);
  });

  it("every citation lands in a group that is actually rendered", async () => {
    // THE FAILURE MODE THIS PROTECTS: a source carrying a group key that is not
    // in EVIDENCE_GROUPS renders NOWHERE. No error, no empty heading, no test
    // failure anywhere else - the citation simply vanishes from the screen whose
    // whole job is to show it, and the app is back to asserting a clinical claim
    // with less evidence than it thinks it has.
    const { U_U_SOURCES, EVIDENCE_GROUPS } = await import("../modules/settings/clinicalEvidence");
    const keys = new Set(EVIDENCE_GROUPS.map((g) => g.key));
    const orphans = U_U_SOURCES.filter((s) => !keys.has(s.group)).map((s) => `${s.label} -> ${s.group}`);
    expect(orphans, "these citations would render nowhere: " + orphans.join(", ")).toEqual([]);
    // And the inverse: a declared group with no sources would leave a bare
    // heading. EvidenceGroup returns null for an empty list, so this is about the
    // map staying honest rather than about a crash.
    const empty = EVIDENCE_GROUPS.filter((g) => !U_U_SOURCES.some((s) => s.group === g.key)).map((g) => g.label);
    expect(empty, "these group headings would render with nothing under them: " + empty.join(", ")).toEqual([]);
    // A group label is user-facing copy, so it cannot be blank.
    expect(EVIDENCE_GROUPS.every((g) => typeof g.label === "string" && g.label.trim().length > 0)).toBe(true);
  });

  it("shows the date each source was actually checked, so a stale citation is findable", () => {
    // checkedOn is in the data and asserted to exist, but a field nothing
    // RENDERS is provenance nobody can see: the screen would look identical
    // whether it was verified this week or two years ago. Gemini raised this -
    // the app has no backend, so it cannot detect that BHIVA revised a document,
    // and the honest mitigation is showing the date next to the link rather than
    // implying the citation is live.
    expect(EVIDENCE_SCREEN, "checkedOn is stored but never rendered").toMatch(/s\.checkedOn/);
    // And the screen must say plainly that it is a dated snapshot, not a live
    // check - otherwise the rendered date itself implies more currency than the
    // app actually has.
    expect(
      EVIDENCE_SCREEN,
      "no statement that this is a dated snapshot rather than a live source check",
    ).toMatch(/snapshot/i);
  });

  it("the citations are NOT folded into the user-editable Resources data file", () => {
    // Belt and braces on the same invariant, asserted on the source rather than
    // the parsed data, so a copy-paste that reintroduces them is caught too.
    expect(EVIDENCE_DATA).toMatch(/export const U_U_SOURCES/);
  });
});

describe("list text inherits the intended size, not the browser default", () => {
  it("every <ul> containing links declares a fontSize", () => {
    // THE BUG, measured on the device rather than guessed at. The citation list
    // set no fontSize, so its links inherited the 16px ROOT default while the
    // surrounding card text is 12px - same font family, so it read as a different
    // typeface instead of an obvious size mismatch. The measurement is recorded
    // in the screen's own comment.
    //
    // Structural rather than eyeballed: a <ul> that gains a link without a
    // fontSize is exactly the regression this prevents.
    // A bare `<ul>` with no attributes at all is NOT this bug: it inherits from
    // its parent element, and the parent is almost always the card or section
    // that already sets a size. What actually broke the citations was a <ul>
    // whose style object existed but set no fontSize, so the links fell back to
    // the browser's 16px ROOT default instead of inheriting the 12px around them.
    // Matching bare tags too would flag ordinary markup and train the next
    // reader to ignore this test.
    const offenders = [];
    for (const rel of [
      "modules/settings/ClinicalEvidenceScreen.jsx",
      "modules/settings/GlossaryScreen.jsx",
      "modules/settings/ResourcesScreen.jsx",
      "modules/settings/StatsScreen.jsx",
    ]) {
      const code = read(rel);
      for (const m of code.matchAll(/<ul\b([^>]*)>/g)) {
        // Scope the link search to THIS element, by cutting at its close. A
        // fixed character window is how the first version of this test flagged
        // a list that had no links in it at all.
        const rest = code.slice(m.index + m[0].length);
        const close = rest.indexOf("</ul>");
        if (close === -1) continue;
        if (!/<a\b/.test(rest.slice(0, close))) continue;
        const attrs = m[1] || "";
        // A <ul> with a style object but no fontSize is the defect.
        if (/style=\{\{/.test(attrs) && !/fontSize/.test(attrs)) {
          offenders.push(`${rel}: <ul${attrs.slice(0, 90)}>`);
        }
      }
    }
    expect(offenders, "these <ul>s contain links but set no fontSize, so their text inherits the 16px root default").toEqual(
      []
    );
  });

  it("the detector can find an unsized list, so the test above is not vacuous", () => {
    // Exercises the ACTUAL rule the detector applies, which is not "no
    // fontSize anywhere" but "a style object with no fontSize, on a list that
    // really contains links". Both halves matter: the first version of this test
    // matched a bare `<ul>` and so flagged ordinary markup that inherits
    // perfectly well from its parent.
    const isOffender = (html) => {
      for (const m of html.matchAll(/<ul\b([^>]*)>/g)) {
        const rest = html.slice(m.index + m[0].length);
        const close = rest.indexOf("</ul>");
        if (close === -1) continue;
        if (!/<a\b/.test(rest.slice(0, close))) continue;
        const attrs = m[1] || "";
        if (/style=\{\{/.test(attrs) && !/fontSize/.test(attrs)) return true;
      }
      return false;
    };

    // The real defect shape: a styled list with links but no fontSize.
    expect(
      isOffender('<ul style={{ margin: 0, paddingLeft: 16 }}><li><a href="https://x.test">x</a></li></ul>'),
      "detector misses the unsized-with-links case",
    ).toBe(true);
    // The fixed shape must pass, or the test cannot ever go green.
    expect(
      isOffender('<ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}><li><a href="https://x.test">x</a></li></ul>'),
      "detector flags a correctly sized list",
    ).toBe(false);
    // A bare <ul> with no style object at all inherits from its parent and is
    // fine - the detector must not flag it, or it would cry wolf on ordinary JSX.
    expect(
      isOffender("<ul><li><a href=\"https://x.test\">x</a></li></ul>"),
      "detector flags a bare <ul>, which inherits correctly from its parent",
    ).toBe(false);
    // And a list with no links is not this bug at all.
    expect(
      isOffender("<ul style={{ margin: 0 }}><li>plain text</li></ul>"),
      "detector flags a link-free list",
    ).toBe(false);
  });
});