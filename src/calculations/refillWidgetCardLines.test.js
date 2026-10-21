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

/** A medication's three facts, as the summary builds them. */
const entry = (name, count, timing) => ({ name, count, timing });

describe("the Refills card's lines", () => {
  it("separates one medication from the next with a blank line", () => {
    // The owner's instruction (21 Oct 2026): "spacing of lines not great".
    // Four undifferentiated lines read as one list; a name and its state with
    // a gap between the pairs read as what they are.
    const lines = buildRefillCardLines([
      entry("Sertraline", "14 left", "requested"),
      entry("PrEP", "199 left", "due in 179d"),
    ]);
    expect(lines).toEqual([
      "Sertraline",
      "requested",
      "",
      "PrEP",
      "due in 179d",
    ]);
  });

  it("shows the stock count when there is room for it", () => {
    // One medication spends three lines and there is nothing to separate it
    // from, so the count - how much is left in the container - is shown.
    const lines = buildRefillCardLines([entry("Sertraline", "14 left", "requested")]);
    expect(lines).toEqual(["Sertraline", "14 left", "requested"]);
  });

  it("drops the count before it drops a medication", () => {
    // Three medications do not fit with a count line each and a blank line
    // between them, so the count goes first: the card shows what it can and
    // says how many it left off. Silently dropping a medication instead would
    // be the worse of the two.
    const lines = buildRefillCardLines([
      entry("Sertraline", "14 left", "requested"),
      entry("PrEP", "199 left", "due in 179d"),
      entry("Buprenorphine", "3 left", "request now"),
    ]);
    expect(lines).toEqual([
      "Sertraline",
      "requested",
      "",
      "PrEP",
      "due in 179d",
      "+1 more",
    ]);
  });

  it("says how many medications it left off, rather than dropping them silently", () => {
    // Four medications is eight lines with the blank separators. Two fit, and
    // the card says what the other two are - a card that quietly loses a
    // medication is worse than one that is a line taller.
    const lines = buildRefillCardLines([
      entry("Aaa", "1 left", "request now"),
      entry("Bbb", "2 left", "request now"),
      entry("Ccc", "3 left", "request now"),
      entry("Ddd", "4 left", "request now"),
    ]);
    expect(lines[lines.length - 1]).toBe("+2 more");
    expect(lines.length).toBeLessThanOrEqual(REFILL_CARD_LINES);
  });

  it("counts a long name as two lines, because it wraps", () => {
    // "Co-trimoxazole" is fourteen characters, which is more than the narrow
    // card holds, so it takes two of the card's lines. The budget has to know
    // that, or the last line of the card is pushed off the bottom - which is
    // the defect this change exists to remove.
    const lines = buildRefillCardLines([
      entry("Co-trimoxazole", "10 left", "request now"),
      entry("Sertraline", "14 left", "requested"),
    ]);
    expect(lines).toEqual([
      "Co-trimoxazole",
      "request now",
      "",
      "Sertraline",
      "requested",
    ]);
    expect(lines.length).toBeLessThanOrEqual(REFILL_CARD_LINES);
  });

  it("keeps every fact it writes on one line of the narrowest card", () => {
    // Thirteen characters is what fits at 11sp in 76.7dp, and it is measured
    // on the device. A fact that does not fit wraps, and a wrapped fact
    // spends a line the budget did not know about.
    const facts = [
      "requested",
      "request now",
      "due in 179d",
      "no schedule",
      "14 left",
      "199 left",
      "+2 more",
    ];
    for (const fact of facts) {
      expect(
        fact.length,
        `"${fact}" is ${fact.length} characters, which is more than the ${REFILL_CARD_CHARS_PER_LINE} a line of the narrowest card holds, so it would wrap and spend a line the budget did not know about`,
      ).toBeLessThanOrEqual(REFILL_CARD_CHARS_PER_LINE);
    }
  });

  it("never writes more lines than the card has", () => {
    // The property, over a range of medication counts: whatever comes in,
    // what comes out fits. A version of this function that returned eight
    // lines for eight medications would pass every other test here.
    for (let n = 1; n <= 8; n++) {
      const entries = Array.from({ length: n }, (_, i) =>
        entry(`Medication ${i + 1}`, `${i + 1} left`, "request now")
      );
      const lines = buildRefillCardLines(entries);
      expect(
        lines.length,
        `${n} medications produced ${lines.length} lines, which is more than the card's ${REFILL_CARD_LINES}`,
      ).toBeLessThanOrEqual(REFILL_CARD_LINES);
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
