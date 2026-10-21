// widgetRefillCardBudgetGuard.test.js
//
// ADDED 21 Oct 2026 - the Refills card's bands have to FIT the card.
//
// THE DEFECT. The card's body is six lines of 11sp and the card is 131dp tall
// inside its padding. On the device the last line was clipped: the body
// started at 52dp under a 24sp headline, and 52 + 80 = 132 is one dp past the
// bottom of the card. Nothing in the suite could see it:
//
//   - widgetTextFitMaxLinesGuard checks each fit() call against the layout's
//     maxLines and textSize. Both are HORIZONTAL properties.
//   - widgetVerticalBudgetGuard checks the root's gravity and that the bands
//     are placed independently. It says in its own comment that it cannot
//     measure text, so it cannot answer this question.
//
// So the shape "consistent on every axis it checks, and too tall on the one
// axis nobody checks" was invisible - which is the general failure this repo
// keeps re-learning, and the reason CLAUDE.md says to ask what shape a guard
// cannot match rather than to add guards for shapes it can.
//
// WHAT IS ASSERTED, and the honest limit. This cannot measure rendered text
// either. It uses the sizes the LAYOUT DECLARES - the marginTop of each band,
// its textSize, its maxLines - and a line height of 1.212em, which is what
// the device measured (six lines of 11sp occupied 80dp). That makes the
// arithmetic an ESTIMATE and not a bound, and the estimate is the thing that
// would be wrong if the platform's font metrics changed. It is still worth
// asserting, because the failure it catches is not a rounding error: it is a
// whole line, or a headline at the wrong size, and both of those are the
// difference between the card reading and the card being cut.
//
// The pixels are confirmed by installing the APK and screenshotting the card
// on the device, which is how this defect was found in the first place.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const LAYOUT = join(
  process.cwd(),
  "android", "app", "src", "main", "res", "layout", "refill_widget.xml"
);
const SYNC = join(
  process.cwd(), "src", "calculations", "refillReminderSync.js"
);

/**
 * The card's content box, in dp: the widget is 163dp tall on this device
 * (measured - 449px at 2.75 density) with 16dp of padding top and bottom.
 */
const CONTENT_BOX_DP = 131;

/**
 * The line height, in em. Measured on the device: six lines of 11sp
 * occupied 80dp, which is 13.3dp a line.
 */
const LINE_HEIGHT_EM = 1.212;

/** Every TextView in the layout, with the numbers the arithmetic needs. */
function bands() {
  const src = readFileSync(LAYOUT, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  return [...src.matchAll(/<TextView[\s\S]*?\/>/g)].map((m) => {
    const tag = m[0];
    const id = /android:id="@\+id\/(\w+)"/.exec(tag)?.[1] ?? "(no id)";
    const size = Number(/android:textSize="([\d.]+)sp"/.exec(tag)?.[1] ?? 0);
    const lines = Number(/android:maxLines="(\d+)"/.exec(tag)?.[1] ?? 1);
    const top = Number(/android:layout_marginTop="([\d.]+)dp"/.exec(tag)?.[1] ?? 0);
    return { id, size, lines, top, bottom: top + size * LINE_HEIGHT_EM * lines };
  });
}

describe("the Refills card's bands fit the card", () => {
  it("every band ends inside the card's content box", () => {
    const offenders = bands()
      .filter((b) => b.bottom > CONTENT_BOX_DP)
      .map(
        (b) =>
          `${b.id} ends at ${b.bottom.toFixed(1)}dp, which is past the ` +
          `${CONTENT_BOX_DP}dp the card has (163dp of widget, 16dp of padding ` +
          `top and bottom). A band that ends past the bottom is a band whose ` +
          `last line is CLIPPED - the card is 134dp of content and this is ` +
          `where it ran out.`
      );
    expect(
      offenders,
      `these bands do not fit the Refills card: ${offenders.join("; ")}`,
    ).toEqual([]);
  });

  it("no band is drawn over the one above it", () => {
    // The Cycle card was found on the device drawing its phase straight
    // THROUGH its title (20 Oct 2026), and the cause was a marginTop
    // measured from the top of the card rather than from the row below. The
    // same mistake here would put the body over the headline.
    const offenders = [];
    let previous = null;
    for (const b of bands()) {
      if (previous && b.top < previous.bottom) {
        offenders.push(
          `${b.id} starts at ${b.top}dp, which is inside ${previous.id} ` +
            `(it ends at ${previous.bottom.toFixed(1)}dp)`
        );
      }
      previous = b;
    }
    expect(
      offenders,
      `these bands overlap the one above them: ${offenders.join("; ")}.`,
    ).toEqual([]);
  });

  it("the card's line capacity is the same number in the layout and the JS", () => {
    // The JS builds the text to a number of LINES, and the layout clips at a
    // number of LINES. If they drift, the card either wastes a line or cuts
    // one - and the JS's number is the one that is easier to change without
    // thinking about the layout, so it is the one that has to be checked.
    const layoutLines = Number(
      /android:id="@\+id\/widget_next_refill"[\s\S]*?android:maxLines="(\d+)"/.exec(
        readFileSync(LAYOUT, "utf8").replace(/<!--[\s\S]*?-->/g, "")
      )?.[1] ?? 0
    );
    const jsLines = Number(
      /export const REFILL_CARD_LINES = (\d+);/.exec(readFileSync(SYNC, "utf8"))?.[1] ?? 0
    );
    expect(
      layoutLines,
      `the layout's widget_next_refill declares no maxLines, so the card has no ` +
        `line capacity for the JS to build against`,
    ).toBeGreaterThan(0);
    expect(
      jsLines,
      `refillReminderSync.js declares no REFILL_CARD_LINES, so the text is ` +
        `built without a capacity`,
    ).toBeGreaterThan(0);
    expect(
      jsLines,
      `the JS builds ${jsLines} lines of Refills text but the layout clips at ` +
        `${layoutLines} lines. The JS's number is the one that gets changed ` +
        `without thinking about the layout, so this is the check that catches it.`,
    ).toBe(layoutLines);
  });
});
