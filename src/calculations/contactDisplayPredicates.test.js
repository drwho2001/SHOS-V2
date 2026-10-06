// t077 and t079: two display defects on the Contacts card, both of which look
// cosmetic and are not.
//
// t077 - the age guard was `contact.age != null`, so any contact whose age was an
// empty string, a non-numeric string or NaN rendered a bare separator dot with
// nothing after it. The Contacts editor normalises "" to null on change, which is
// precisely why it never showed up while typing and looked impossible to
// reproduce: the bad values arrive from paths the editor does not own (backup
// import, shared-profile import, an older build's records).
//
// t079 - methods is a real multi-select, so the same service can be present
// twice. The badges were keyed by the method string, so a duplicate was two React
// children with the same key, not merely two identical icons.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { displayableAge, dedupeContactMethods } from "./contactCalculations.js";

describe("displayableAge - is there an age worth printing?", () => {
  it("returns a real age as a number", () => {
    expect(displayableAge({ age: 34 })).toBe(34);
    expect(displayableAge({ age: "34" })).toBe(34); // imported numeric string
    expect(displayableAge({ age: " 29 " })).toBe(29);
  });

  it("returns null for the values that produced the dangling dot", () => {
    // The three shapes the old `!= null` guard let through.
    expect(displayableAge({ age: "" })).toBeNull();
    expect(displayableAge({ age: "unknown" })).toBeNull();
    expect(displayableAge({ age: NaN })).toBeNull();
  });

  it("returns null when there is genuinely no age", () => {
    expect(displayableAge({ age: null })).toBeNull();
    expect(displayableAge({ age: undefined })).toBeNull();
    expect(displayableAge({})).toBeNull();
    expect(displayableAge(null)).toBeNull();
  });

  it("treats 0 as no age", () => {
    // Not a plausible age, and it is what a number input left at its default
    // produces. Rendering "0" would be a false statement about a person.
    expect(displayableAge({ age: 0 })).toBeNull();
    expect(displayableAge({ age: "0" })).toBeNull();
    expect(displayableAge({ age: -3 })).toBeNull();
  });

  it("keeps a genuine age that happens to look odd", () => {
    // Guards against over-correction: this fix must not start hiding real ages.
    expect(displayableAge({ age: 1 })).toBe(1);
    expect(displayableAge({ age: 99 })).toBe(99);
  });
});

describe("dedupeContactMethods - one icon per service", () => {
  it("collapses an exact duplicate", () => {
    expect(dedupeContactMethods(["WhatsApp", "WhatsApp"])).toEqual(["WhatsApp"]);
  });

  it("collapses a case-variant duplicate, keeping the FIRST spelling", () => {
    // The badge table is matched on the exact string, so two spellings would also
    // have produced two visually identical icons. First spelling wins because that
    // is the one the user chose and the one the option list can match.
    expect(dedupeContactMethods(["WhatsApp", "whatsapp"])).toEqual(["WhatsApp"]);
    expect(dedupeContactMethods(["whatsapp", "WhatsApp"])).toEqual(["whatsapp"]);
  });

  it("preserves original order and keeps distinct services", () => {
    expect(dedupeContactMethods(["Recon", "WhatsApp", "Snapchat", "Recon"]))
      .toEqual(["Recon", "WhatsApp", "Snapchat"]);
  });

  it("does not reorder around a later duplicate", () => {
    expect(dedupeContactMethods(["A", "B", "A", "C"])).toEqual(["A", "B", "C"]);
  });

  it("drops blanks and non-strings without throwing", () => {
    expect(dedupeContactMethods(["WhatsApp", "", "   ", null, undefined, 7, {}]))
      .toEqual(["WhatsApp"]);
  });

  it("handles the degenerate inputs defensively", () => {
    // Every caller is a load path, and this file's rule is that a broken storage
    // read must not take a screen down.
    expect(dedupeContactMethods([])).toEqual([]);
    expect(dedupeContactMethods(null)).toEqual([]);
    expect(dedupeContactMethods(undefined)).toEqual([]);
    expect(dedupeContactMethods("WhatsApp")).toEqual([]);
  });
});

// The unit tests above prove the predicates are right. They cannot prove the UI
// USES them - and the weak guard was in the UI, which is exactly the layer none
// of those tests reach. Same gap this repo has been bitten by repeatedly: a
// correct function behind a call site that never calls it.
describe("the Contacts card and profile actually use the shared predicates", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src", "modules", "SHOS_Contacts_Prototype.jsx"), "utf8");

  // A real comment stripper, not a line-prefix filter.
  //
  // The first version only dropped lines beginning "//", "*" or "/*", and it went
  // RED on the fix itself - because the explanatory comment inside the card quotes
  // the old expression (`contact.age != null`) on a continuation line that starts
  // with neither marker, being a JSX {/* ... */} block. That is this repo's
  // recorded failure mode for negative source checks, and it is why this exists.
  //
  // Order matters: block comments are removed before line comments, or a "//"
  // inside a block comment's text could start a line comment early and leave the
  // rest of the block in place.
  function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  }

  it("the comment stripper is not itself vacuous", () => {
    // Proved against a throwaway fixture rather than asserted on the real file,
    // because a stripper that removed nothing would make every negative check
    // below pass for the wrong reason.
    const probe = [
      "const keep = 1; // contact.age != null",
      "{/* a block comment",
      "   continuing on a line that starts with neither marker",
      "   and still mentioning contact.age != null */}",
      "const keep2 = 2;",
    ].join("\n");
    const stripped = stripComments(probe);
    expect(stripped).toContain("const keep = 1;");
    expect(stripped).toContain("const keep2 = 2;");
    expect(stripped, "a line comment must be removed").not.toMatch(/contact\.age/);
    expect(stripped, "a multi-line block comment must be removed entirely").not.toMatch(/continuing on a line/);
  });

  it("no age is rendered through the weak `!= null` guard any more", () => {
    // The regression this guard exists for, stated as a negative on the exact
    // literal, over comment-stripped source.
    const code = stripComments(source);
    expect(code, "an age must not be rendered behind `contact.age != null` again")
      .not.toMatch(/contact\.age\s*!=\s*null/);
  });

  it("both age render sites go through displayableAge", () => {
    // Counted rather than asserted once, because the defect was that the two
    // sites disagreed - one fixed and one left behind is the same bug half done.
    const uses = source.match(/displayableAge\(contact\)/g) || [];
    expect(uses.length, "card + profile header should both render via displayableAge").toBeGreaterThanOrEqual(4);
  });

  it("MethodIcons renders the deduplicated list, and gates on it", () => {
    const fn = source.slice(source.indexOf("function MethodIcons("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body, "the badge list must map the deduplicated methods")
      .toMatch(/unique\.map\(/);
    expect(body, "the emptiness check and the render must agree on the same list")
      .toMatch(/if \(unique\.length === 0\) return null;/);
    // The duplicate-key defect itself: keying on the raw value while rendering a
    // different list is what produced two children sharing a key.
    expect(body).not.toMatch(/\{methods\.map\(/);
  });

  it("the social-media summary comes after the travel and accommodation icons", () => {
    // t078 is an ORDERING requirement, which no unit test can see, so it has to be
    // asserted against the source. Scoped to the card's own header row so it
    // cannot be satisfied by an unrelated MethodIcons elsewhere in the file.
    const card = source.slice(source.indexOf("function ContactCard("));
    const row = card.slice(0, card.indexOf("showStatusInfo && (() => {"));
    const methodsAt = row.indexOf("<MethodIcons");
    const transportAt = row.indexOf("getTransportIcon(contact)");
    const hostsAt = row.indexOf('contact.hosts === "Yes"');
    expect(transportAt, "transport icon should be present on the row").toBeGreaterThan(-1);
    expect(hostsAt, "hosts/travels icon should be present on the row").toBeGreaterThan(-1);
    expect(methodsAt, "MethodIcons should be present on the row").toBeGreaterThan(-1);
    expect(methodsAt, "the social-media summary must come after travel/accommodation")
      .toBeGreaterThan(Math.max(transportAt, hostsAt));
  });

  it("the name row reserves room for the favourite star and can wrap", () => {
    // t076: the star is position:absolute, so without reserved space a long name
    // ran underneath it. Asserted on the two properties, not on the exact style
    // string, so a future restyle cannot quietly remove either.
    const card = source.slice(source.indexOf("function ContactCard("));
    const rowStyle = card.slice(card.indexOf("function ContactCard("), card.indexOf("statusCopy.title"));
    expect(rowStyle, "the name row must wrap so a long name drops to a second line")
      .toMatch(/flexWrap:\s*"wrap"/);
    expect(rowStyle, "the name row must reserve space for the absolutely-positioned star")
      .toMatch(/paddingRight:/);
  });

  it("a favourited card gets the accent, and selection still wins over it", () => {
    // t080. Two properties, and the second is the one that matters: a checkbox
    // the user is looking at must never be overridden by a stored preference, and
    // a gold-tinted selected card reads as "selected AND favourite" when the
    // truth is "selected".
    const card = source.slice(source.indexOf("function ContactCard("));
    const cardStyle = card.slice(card.indexOf("style={{ position: \"relative\""), card.indexOf("style={{ position: \"relative\"") + 420);
    expect(cardStyle, "a favourited card should carry the accent")
      .toMatch(/contact\.favourited/);
    // Selection is the FIRST branch of both the background and the border, so it
    // takes precedence by construction rather than by ordering luck.
    expect(cardStyle, "selection must be evaluated before the favourite accent")
      .toMatch(/background: selected \?/);
    expect(cardStyle, "selection must be evaluated before the favourite accent")
      .toMatch(/border: `1px solid \$\{selected \?/);
  });

  it("the favourite accent and the favourite star share one colour constant", () => {
    // Two hardcoded golds on one card is two definitions of "this is a favourite",
    // and the kind of thing that drifts the moment one is restyled.
    const card = source.slice(source.indexOf("function ContactCard("));
    const golds = card.match(/E8A33D/g) || [];
    expect(golds.length, "the gold should be defined once and used by the star and the accent")
      .toBeGreaterThanOrEqual(2);
  });
});
