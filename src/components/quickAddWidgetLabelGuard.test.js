// quickAddWidgetLabelGuard.test.js
//
// The three Quick Add widgets (Add Contact, Log Encounter, Log Medication) were
// device-measured on 23124RA7EO on 16 Oct 2026 rendering as:
//
//     + Add Co...      + Log Enc...      + Log Me...
//
// The words were not lost by a measuring bug and nothing was shrunk. Each label
// is a STATIC string declared in the layout XML as
//
//     android:text="+ Log Medication"
//     android:maxLines="1"
//     android:ellipsize="end"
//
// so the TextView measured a string wider than the 109dp 2-column widget, was
// told to keep it on one line, and ellipsized. The fix is maxLines="2", at which
// point the label wraps onto two clean lines and nothing is lost.
//
// WHY THIS NEEDS A GUARD RATHER THAN A FIX, given widgetTextFitMaxLinesGuard
// already exists. That guard exists to catch DRIFT BETWEEN A fit() CALL AND ITS
// LAYOUT, so it only sees TextViews that have an android:id to key on and are
// passed to WidgetTextFit.fit(). These three labels are excluded from it twice
// over: their TextViews carry no android:id at all, and their providers
// (QuickAddContactWidgetProvider and siblings) never call fit() - the text is a
// compile-time constant, so there is nothing to measure or shrink. The existing
// guard is structurally incapable of seeing them, which is why the truncation
// survived a full install-and-look cycle on a real device.
//
// So maxLines here is the ONLY control on whether the label is complete. A
// well-meaning "this label is short, one line is fine" tidy-up puts the ellipsis
// straight back with nothing failing. This asserts the property directly.
//
// WHY THIS IS A SOURCE GUARD AND NOT A BEHAVIOURAL TEST. As with the fitter, the
// rendering is Android and this suite cannot run it. What is asserted here is the
// layout declaration, which is the thing that was wrong and the thing that has to
// stay right; the pixels are confirmed by installing the APK and screenshotting,
// which is how the original defect was found in the first place.
//
// The family is matched as a glob rather than as three filenames so a fourth
// Quick Add widget is covered the day it is added, and the expected-label
// assertion below stops that coverage from being defeated by deleting a layout.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LAYOUTS = join(process.cwd(), "android", "app", "src", "main", "res", "layout");

/** Every Quick Add layout, e.g. quick_add_contact_widget.xml. */
const quickAddLayouts = readdirSync(LAYOUTS).filter((f) =>
  /^quick_add_.*_widget\.xml$/.test(f),
);

/**
 * The label each layout is expected to carry. The emoji prefix is deliberately
 * not asserted - it is not what this guard is about, and matching on it would
 * make the test depend on source encoding rather than on the truncation.
 */
const EXPECTED_LABELS = {
  "quick_add_contact_widget.xml": "Add Contact",
  "quick_add_encounter_widget.xml": "Log Encounter",
  "quick_add_medication_widget.xml": "Log Medication",
};

/** The single TextView block in a layout, plus the two attributes under test. */
function labelBlock(layoutFile) {
  const xml = readFileSync(join(LAYOUTS, layoutFile), "utf8");
  const blocks = xml.match(/<TextView[\s\S]*?\/>/g) || [];
  return blocks
    .map((b) => ({
      block: b,
      text: b.match(/android:text="([^"]*)"/)?.[1],
      maxLines: b.match(/android:maxLines="(\d+)"/)?.[1],
    }))
    .filter((b) => b.text !== undefined);
}

describe("Quick Add widget labels are allowed to wrap", () => {
  it("found the whole Quick Add family and each expected label", () => {
    // Without this the suite passes vacuously if the glob stops matching - e.g.
    // the layouts are renamed, or move out of res/layout. Every other assertion
    // below would then be checking an empty list.
    expect(
      quickAddLayouts,
      "expected to find quick_add_*_widget.xml layouts to check",
    ).toEqual(Object.keys(EXPECTED_LABELS).sort());

    for (const file of quickAddLayouts) {
      const labels = labelBlock(file);
      expect(
        labels.length,
        `${file}: expected exactly one labelled TextView, found ${labels.length}`,
      ).toBe(1);
      expect(
        labels[0].text,
        `${file}: label changed - re-measure it on a device before assuming the ` +
          `string is still short enough to need fewer than two lines`,
      ).toContain(EXPECTED_LABELS[file]);
    }
  });

  it("each label declares maxLines >= 2 so it wraps instead of ellipsizing", () => {
    const offenders = [];
    for (const file of quickAddLayouts) {
      for (const { block, maxLines } of labelBlock(file)) {
        if (maxLines === undefined || Number(maxLines) < 2) {
          offenders.push(
            `${file}: label TextView declares ` +
              `${maxLines === undefined ? "no maxLines" : `maxLines="${maxLines}"`}, ` +
              `so a label wider than the 2-column widget ellipsizes to "Add Co..." ` +
              `with nothing failing (block: ${block.replace(/\s+/g, " ")})`,
          );
        }
      }
    }
    expect(
      offenders,
      "Quick Add labels are static XML text with no android:id and no fit() call, " +
        "so maxLines is the only thing preventing truncation - see the header",
    ).toEqual([]);
  });

  it("no Quick Add provider calls WidgetTextFit.fit() (they must not grow one)", () => {
    // Not a style rule - it pins down WHY maxLines is the only control here. If a
    // provider ever starts fitting its label, this fails and the reasoning above
    // has to be revisited rather than silently invalidated, because a fit() call
    // passing maxLines=1 would reintroduce exactly the HITS_FLOOR lie the sibling
    // guard exists to prevent.
    const java = readFileSync(
      join(
        process.cwd(),
        "android",
        "app",
        "src",
        "main",
        "java",
        "com",
        "shos",
        "app",
        "widget",
        "QuickAddContactWidgetProvider.java",
      ),
      "utf8",
    );
    expect(java).not.toMatch(/WidgetTextFit\.fit\(/);
  });
});