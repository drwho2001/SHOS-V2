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
  REFILL_CARD_LINES,
  REFILL_CARD_CHARS_PER_LINE,
} from "./refillReminderSync.js";

/** A medication's three facts, as the summary builds them. */
const entry = (name, count, timing) => ({ name, count, timing });

describe("the Refills card's lines", () => {
  it("gives two medications six lines - three each - with nothing dropped", () => {
    // The owner's card: Sertraline, already requested, and PrEP, 179 days out.
    const lines = buildRefillCardLines([
      entry("Sertraline", "14 left", "requested"),
      entry("PrEP", "199 left", "due in 179d"),
    ]);
    expect(lines).toEqual([
      "Sertraline",
      "14 left",
      "requested",
      "PrEP",
      "199 left",
      "due in 179d",
    ]);
    expect(lines.length).toBe(REFILL_CARD_LINES);
  });

  it("drops the count before it drops a medication", () => {
    // Three medications do not fit with a count line each (that is nine
    // lines), so the count goes first: the card shows all three and says
    // nothing about stock. Silently dropping a medication instead would be
    // the worse of the two, and the count is the least load-bearing fact.
    const lines = buildRefillCardLines([
      entry("Sertraline", "14 left", "requested"),
      entry("PrEP", "199 left", "due in 179d"),
      entry("Buprenorphine", "3 left", "request now"),
    ]);
    expect(lines).toEqual([
      "Sertraline",
      "requested",
      "PrEP",
      "due in 179d",
      "Buprenorphine",
      "request now",
    ]);
    expect(lines.length).toBe(REFILL_CARD_LINES);
  });

  it("says how many medications it left off, rather than dropping them silently", () => {
    // Four medications is eight lines. Two fit, and the card says what the
    // other two are - a card that quietly loses a medication is worse than
    // one that is a line taller.
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
    // The long name's two lines plus its timing, then the other medication's
    // three: seven lines, so the count is dropped to fit six.
    expect(lines).toEqual([
      "Co-trimoxazole",
      "request now",
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

  it("says the medication's name, its stock and what happened with the refill", () => {
    // The shape of a medication's block, asserted on its own: a reader must
    // be able to tell which line is which.
    const lines = buildRefillCardLines([entry("Sertraline", "14 left", "requested")]);
    expect(lines).toEqual(["Sertraline", "14 left", "requested"]);
  });
});
