// refillWidgetCardLines.test.js
//
// ADDED 21 Oct 2026 - the Refills card's text, and the capacity it has to fit
// into.
//
// THE DEFECT THIS EXISTS FOR. The card is 76.7dp of text width (about
// thirteen characters a line at 11sp) and 131dp tall inside a two-cell
// placement. The old text was one string per medication -
// "Sertraline - 14 left - requested", twenty-nine characters - so it wrapped
// across three lines, broke mid-phrase ("left -" alone on a line), and pushed
// the SECOND medication off the bottom of the card. The owner saw a card
// with one medication on it and a cut-off line.
//
// The fix has two halves and this file tests the first: the text is built as
// lines, and the number of lines is the card's real capacity. The second half
// is the layout, which `widgetRefillCardBudgetGuard.test.js` checks.
//
// The card has TWO views that share that capacity: the medication that needs
// reordering now is BRIGHT and the rest are dim, because the owner's colour
// principle is that the useful information reads first and the remainder
// should not be a muddle. A view is one colour, so that is two views.
//
// The logic under test is EXPORTED and called here. A test that pasted a copy
// of the line-building into its own file would prove that the copy is right -
// the repo has been bitten by that shape before, on the DoxyPEP payload.

import { describe, it, expect } from "vitest";
import {
  buildRefillCardLines,
  orderByNextRefill,
  REFILL_CARD_LINES,
  REFILL_CARD_CHARS_PER_LINE,
} from "./refillReminderSync.js";

/** A medication's facts, as the summary builds them. */
const entry = (name, timing) => ({ name, timing });

describe("the Refills card's lines", () => {
  it("gives the soonest medication its own bright block", () => {
    const { due, later } = buildRefillCardLines([
      entry("Sertraline", "requested"),
      entry("PrEP", "due in 179d"),
    ]);
    expect(due).toEqual(["Sertraline", "requested"]);
    expect(later).toEqual(["PrEP", "due in 179d"]);
  });

  it("keeps the rest dim, and says how many it left off", () => {
    // Four undifferentiated lines read as one list; a name and its state with
    // a gap between the pairs read as what they are. And a card that quietly
    // loses a medication is worse than one that is a line taller - the
    // owner's own data is four medications, of which the card has room for
    // two.
    const { due, later } = buildRefillCardLines([
      entry("Sertraline", "requested"),
      entry("PrEP", "due in 179d"),
      entry("Vitamin D", "due in 19d"),
      entry("DoxyPEP", "due in 40d"),
    ]);
    expect(due).toEqual(["Sertraline", "requested"]);
    expect(later).toEqual(["PrEP", "due in 179d", "+2 more"]);
  });

  it("says how many medications it left off, rather than dropping them silently", () => {
    // A card that quietly loses a medication is worse than one that is a line
    // taller - and the owner's own data is four medications, of which the
    // card has room for two.
    const { due, later } = buildRefillCardLines([
      entry("Sertraline", "requested", true),
      entry("PrEP", "due in 179d"),
      entry("Vitamin D", "due in 19d"),
      entry("DoxyPEP", "due in 40d"),
    ]);
    expect(due).toEqual(["Sertraline", "requested"]);
    expect(later[later.length - 1]).toBe("+2 more");
  });

  it("leaves the bright block empty when there is nothing to show", () => {
    const { due, later } = buildRefillCardLines([]);
    expect(due).toEqual([]);
    expect(later).toEqual([]);
  });

  it("never writes more lines than the card has", () => {
    // The property, over a range of medication counts: whatever comes in,
    // what comes out fits. A version of this function that returned eight
    // lines for eight medications would pass every other test here.
    for (let n = 1; n <= 8; n++) {
      const entries = Array.from({ length: n }, (_, i) =>
        entry(`Medication ${i + 1}`, "request now")
      );
      const { due, later } = buildRefillCardLines(entries);
      expect(
        due.length + later.length,
        `${n} medications produced ${due.length + later.length} lines, which is ` +
          `more than the card's ${REFILL_CARD_LINES}`,
      ).toBeLessThanOrEqual(REFILL_CARD_LINES);
    }
  });

  it("keeps every fact it writes on one line of the narrowest card", () => {
    // Thirteen characters is what fits at 11sp in 76.7dp, and it is measured
    // on the device. A fact that does not fit wraps, and a wrapped fact
    // spends a line the budget did not know about.
    const facts = ["requested", "request now", "due in 179d", "no schedule", "+2 more"];
    for (const fact of facts) {
      expect(
        fact.length,
        `"${fact}" is ${fact.length} characters, which is more than the ${REFILL_CARD_CHARS_PER_LINE} a line of the narrowest card holds, so it would wrap and spend a line the budget did not know about`,
      ).toBeLessThanOrEqual(REFILL_CARD_CHARS_PER_LINE);
    }
  });
});

describe("the order the card lists medications in", () => {
  const row = (name, days) => ({ med: { name }, days });

  it("puts the soonest refill first", () => {
    // The owner's instruction (21 Oct 2026): "should be listed by next due
    // refill, ie vit d or doxy sooner than prep". The key is the same number
    // the card's own wording counts down to, so the order and the words
    // cannot disagree.
    const ordered = orderByNextRefill([
      row("PrEP", 179),
      row("Vitamin D", 12),
      row("DoxyPEP", 3),
    ]);
    expect(ordered.map((r) => r.med.name)).toEqual([
      "DoxyPEP",
      "Vitamin D",
      "PrEP",
    ]);
  });

  it("puts a medication that needs action today before one that does not", () => {
    // A medication at its threshold has days === 0, so it sorts first
    // without needing a second rule.
    const ordered = orderByNextRefill([row("PrEP", 179), row("Sertraline", 0)]);
    expect(ordered.map((r) => r.med.name)).toEqual(["Sertraline", "PrEP"]);
  });

  it("puts a medication with no schedule last, not first", () => {
    // A medication with no days at all has no schedule, and pretending it is
    // urgent would be a lie the card's own words would contradict.
    const ordered = orderByNextRefill([row("PRN", null), row("PrEP", 179)]);
    expect(ordered.map((r) => r.med.name)).toEqual(["PrEP", "PRN"]);
  });

  it("orders two medications due on the same day alphabetically", () => {
    // So the card's order does not shuffle between pushes.
    const ordered = orderByNextRefill([row("Vitamin D", 5), row("DoxyPEP", 5)]);
    expect(ordered.map((r) => r.med.name)).toEqual(["DoxyPEP", "Vitamin D"]);
  });
});
