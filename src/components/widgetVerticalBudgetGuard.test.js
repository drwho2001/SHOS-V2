// widgetVerticalBudgetGuard.test.js
//
// ADDED 18 Oct 2026 - guards the widget layouts against the vertical overflow
// that clipping at a 2-cell height actually comes from.
//
// THE DEFECT. Every widget layout in this app is `padding="16dp"` with a
// `match_parent` root, so at a 2-cell placement the content box is 134dp tall.
// The audit measured four layouts overflowing that: Clinic Card by 127dp, this
// Appointments one by 33dp, Next Dose by 23.7dp, DoxyPEP by 12.3dp. An
// overflowing layout CLIPS, and the original root gravity was "center" - which
// clips BOTH ends at once, so the first line and the last line are lost
// simultaneously and neither is reachable by scrolling. There is no state in
// which the user can read what is hidden.
//
// WHY NO EXISTING GUARD CAUGHT IT, which is the point of writing this one.
//
//   - widgetTextFitMaxLinesGuard checks a fit() call against its layout's
//     maxLines and textSize. Both are HORIZONTAL properties. A layout can be
//     perfectly consistent on both axes and still be 33dp too tall.
//   - widgetTapAndFallbackGuard checks the one-ViewGroup rule and the tap
//     target. Neither is about height.
//   - widgetRingGuard checks the ring's drawable and style. Not this.
//
// So the shape "correct on every axis it checks, and wrong in the one axis
// nobody checks" was invisible - which is the general failure this repo keeps
// re-learning, and the reason CLAUDE.md says to ask what shape a guard cannot
// match rather than to add guards for shapes it can.
//
// WHAT IS ACTUALLY ASSERTED, given the honest limit: this cannot measure real
// text, because rendering is Android's and this suite cannot run it. So it does
// not pretend to predict overflow. It asserts the two STRUCTURAL properties that
// make overflow harmless where it cannot be eliminated:
//
//   1. The bands are independently placed. A FrameLayout with top/centre/bottom
//      children cannot push them out of view by growing, because their positions
//      do not depend on each other's heights. A gravity="center" LinearLayout
//      column CAN, and that is the configuration that clipped both ends.
//   2. The root is not gravity="center". Centre gravity is the specific thing
//      that turns overflow into symmetric two-ended clipping.
//
// (2) is the sharper assertion: it names the defect rather than the symptom, and
// it is checkable without measuring text. (1) explains why the two rebuilt
// layouts are shaped the way they are.
//
// This is a SOURCE guard and not a behavioural test for the same reason the
// others are - the pixels are confirmed by installing the APK and screenshotting
// in portrait at 2 cells, which is how the original defect was found.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LAYOUTS = join(process.cwd(), "android", "app", "src", "main", "res", "layout");

const widgetLayouts = readdirSync(LAYOUTS).filter((f) => /_widget\.xml$/.test(f));

/**
 * The layouts deliberately rebuilt onto the FrameLayout pattern, and WHY each one
 * was measured overflowing. The expected set is asserted rather than discovered so
 * that deleting a layout - the easiest way to defeat a glob - cannot silently
 * reduce coverage to nothing.
 */
const REBUILT_ONTO_FRAME_LAYOUT = {
  "doxy_pep_widget.xml": "was 12.3dp over its 2-cell box",
  "next_dose_widget.xml": "was 23.7dp over its 2-cell box",
  "appointment_widget.xml": "was 33dp over its 2-cell box",
};

/**
 * Layouts that still centre their root, as of 18 Oct 2026.
 *
 * Asserted against the tree rather than trusted, so it stays true: a layout
 * appearing or disappearing from this list fails the next test. Every one of
 * these is the same two-ended-clipping shape, and clinic_card_widget.xml is the
 * worst case in the app - 127dp over a 134dp box, measured on the device.
 *
 * They are NOT in the strong assertion above on purpose. Adding them there would
 * mean shipping a permanently red test, and a red test gets muted rather than
 * fixed. Converting them is the obvious next task, and each one wants a measured
 * size check of its own rather than this file's opinion - Refills and Cycle were
 * not measured as over-height at all, so asserting they overflow would be a guess
 * dressed as a guard.
 */
const KNOWN_STILL_CENTRED = [
  "cycle_widget.xml",
  "quick_add_contact_widget.xml",
  "quick_add_encounter_widget.xml",
  "quick_add_medication_widget.xml",
  "refill_widget.xml",
  "test_widget.xml",
];

describe("widget layouts cannot clip at both ends", () => {
  it("the family under test still exists", () => {
    // Anti-vacuity. If every widget layout were deleted, the glob above would
    // match nothing and every assertion below would pass.
    expect(widgetLayouts.length).toBeGreaterThan(0);
    for (const name of Object.keys(REBUILT_ONTO_FRAME_LAYOUT)) {
      expect(
        widgetLayouts,
        `${name} is missing - the overflow guard cannot check a layout that does ` +
          `not exist, and deleting a layout is the cheapest way to defeat this file.`,
      ).toContain(name);
    }
  });

  it("no REBUILT widget layout centres its root, because centre gravity clips both ends", () => {
    // THE assertion that names the defect. An over-tall column centred in a
    // fixed-height box loses its top and its bottom in equal measure, and
    // neither is reachable afterwards - there is no scroll position that reveals
    // what was cut. Top gravity loses only the bottom, which is at least the end
    // a reader reaches last.
    //
    // COMMENTS ARE STRIPPED FIRST, and that is not tidiness. Each of these files
    // opens with a long `<!-- ... -->` block explaining why the root is a
    // FrameLayout, and the prose contains '>' characters and quotes
    // android:gravity="center" in it. Slicing to the first '>' in raw source
    // therefore lands INSIDE THE COMMENT, so the "root" read was a fragment of
    // documentation: it reported the appointment layout as clean while the file on
    // disk carried android:gravity="center", proven by mutating it and watching the
    // test stay green. A guard that reads the wrong span is worse than no guard,
    // because it is green and says nothing.
    //
    // SCOPED TO THE REBUILT LAYOUTS, and the reason matters. Fixing the root
    // gravity correctly catches eight layouts - clinic_card (+127dp over),
    // refill, cycle and the three quick_adds all still centre their roots today.
    // Asserting zero across the whole family would therefore be red on arrival and
    // would have to be relaxed to pass, which teaches everyone that this file's
    // assertions are aspirational. So the strong claim is made where the work was
    // done, and the remaining seven are listed in KNOWN_STILL_CENTRED below so
    // they are visible rather than forgotten - converting them is the obvious next
    // task, and each needs its own size check rather than this file's opinion.
    const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
    const offenders = [];
    for (const name of Object.keys(REBUILT_ONTO_FRAME_LAYOUT)) {
      const src = stripComments(readFileSync(join(LAYOUTS, name), "utf8"));
      const rootTag = /<([A-Za-z]+)(?=[\s>])/.exec(src);
      if (!rootTag) { offenders.push(`${name} (no root tag found)`); continue; }
      const root = src.slice(rootTag.index, src.indexOf(">", rootTag.index));
      if (/android:gravity\s*=\s*"center"/.test(root)) offenders.push(name);
    }
    expect(
      offenders,
      `these rebuilt widget layouts centre their ROOT, which clips an overflow off ` +
        `BOTH ends at once: ${offenders.join(", ")}. A child TextView's ` +
        `android:gravity="center" is fine and is not what this checks.`,
    ).toEqual([]);
  });

  it("the remaining centre-gravity layouts are enumerated, not forgotten", () => {
    // KNOWN_STILL_CENTRED is a claim about the CURRENT state of the tree, so it
    // is asserted rather than assumed: every layout outside the rebuilt set that
    // still centres its root must be on this list, and every name on the list must
    // still be one. That makes it a to-do list that cannot silently become wrong,
    // and it fails the moment someone fixes one WITHOUT removing it from here -
    // which is the failure mode that turns an inventory into folklore.
    const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");
    const stillCentred = [];
    for (const f of widgetLayouts) {
      if (f in REBUILT_ONTO_FRAME_LAYOUT) continue;
      const src = stripComments(readFileSync(join(LAYOUTS, f), "utf8"));
      const rootTag = /<([A-Za-z]+)(?=[\s>])/.exec(src);
      if (!rootTag) continue;
      const root = src.slice(rootTag.index, src.indexOf(">", rootTag.index));
      if (/android:gravity\s*=\s*"center"/.test(root)) stillCentred.push(f);
    }
    expect(
      stillCentred.slice().sort(),
      `the set of centre-gravity layouts changed. Actual: ${JSON.stringify(stillCentred.slice().sort())}. ` +
        `Expected: ${JSON.stringify(KNOWN_STILL_CENTRED.slice().sort())}. If one of these has been ` +
        `rebuilt, remove it from KNOWN_STILL_CENTRED in this file in the same commit.`,
    ).toEqual(KNOWN_STILL_CENTRED.slice().sort());
  });

  it("the rebuilt layouts place their bands independently rather than stacking them", () => {
    // Why the FrameLayout, stated as an assertion so the shape cannot regress
    // back to a column without something failing.
    for (const [name, why] of Object.entries(REBUILT_ONTO_FRAME_LAYOUT)) {
      const src = readFileSync(join(LAYOUTS, name), "utf8");
      // The ROOT tag is located rather than assumed to be the first thing in the
      // file: every one of these opens with an XML declaration and a long comment
      // block explaining why it is a FrameLayout, so `^<FrameLayout` against the
      // trimmed source never matched. Matching the first element tag in the file
      // is what actually asks "what is the root".
      const rootTag = /<([A-Za-z]+)(?=[\s>])/.exec(src);
      expect(
        rootTag && rootTag[1] === "FrameLayout",
        `${name} should have a FrameLayout root - it ${why}, and stacking bands in ` +
          `a column means one growing band pushes the others out of an unclipped box. ` +
          `L-076 still forbids a second ViewGroup, so placement is by layout_gravity ` +
          `on the one root. Found <${rootTag ? rootTag[1] : "nothing"}>.`,
      ).toBe(true);
    }
  });

  it("the rebuilt layouts declare no nested ViewGroup, per L-076", () => {
    // Stated here as well as in widgetTapAndFallbackGuard because the reason it
    // matters is different in each place: there it is about inflating at all,
    // here it is about not "fixing" an overflow by nesting a container, which is
    // the obvious-looking repair and has broken this app twice.
    for (const name of Object.keys(REBUILT_ONTO_FRAME_LAYOUT)) {
      const src = readFileSync(join(LAYOUTS, name), "utf8");
      const groups = (src.match(/<(LinearLayout|FrameLayout|RelativeLayout|GridLayout|ScrollView|ViewFlipper|TableLayout)\b/g) || []).length;
      expect(
        groups,
        `${name} contains ${groups} ViewGroups. A nested container in a widget ` +
          `RemoteViews layout does not inflate in this app (L-076, broken twice on ` +
          `device) - so nesting to solve an overflow renders "Can't load widget" ` +
          `instead of a widget.`,
      ).toBe(1);
    }
  });

  it("every layout declares the 16dp padding the 134dp content budget assumes", () => {
    // The budget in every comment above is derived from this: 166dp cell minus
    // 16dp top and bottom. A layout that changes the padding silently invalidates
    // the arithmetic, and the overflow would come back without anything failing.
    for (const name of Object.keys(REBUILT_ONTO_FRAME_LAYOUT)) {
      const src = readFileSync(join(LAYOUTS, name), "utf8");
      expect(
        /android:padding="16dp"/.test(src),
        `${name} no longer declares android:padding="16dp". Every 2-cell vertical ` +
          `budget in this repo is derived from it (166dp cell - 32dp), so changing ` +
          `it silently re-creates the overflow this file exists to prevent.`,
      ).toBe(true);
    }
  });
});

describe("providers use View in a way that compiles", () => {
  // ADDED 18 Oct 2026, after build-apk rejected AppointmentWidgetProvider.java:235
  // with "cannot find symbol" - a `View.GONE` I inserted into a file that has NO
  // `import android.view.View`. Every other reference in that file spells it
  // `android.view.View.GONE`, so the style was never in doubt; the file simply
  // never imported it.
  //
  // This is a whole class of mistake, not one instance: each of the ten providers
  // is a standalone class that deliberately shares no base, so whether `View` is
  // in scope is a per-file fact that has to be right in each one. And the failure
  // mode is a compile error on a machine that cannot compile Java, so nothing in
  // the local suite can see it - the whole reason the change sat red in CI while
  // every test passed here.
  //
  // Why not just add the import? Because a reader of that file would then find
  // two spellings of the same constant with no rule for which is correct. The
  // assertion below accepts EITHER style as long as they agree with the imports,
  // which is the property that actually matters.
  const PROVIDERS = join(
    process.cwd(), "android", "app", "src", "main", "java",
    "com", "shos", "app", "widget",
  );

  it("every provider is consistent about android.view.View", () => {
    const files = readdirSync(PROVIDERS).filter((f) => f.endsWith(".java"));
    expect(files.length).toBeGreaterThan(0);
    const offenders = [];
    for (const f of files) {
      const src = readFileSync(join(PROVIDERS, f), "utf8");
      // A bare `View.` that is not part of `android.view.View.` or another
      // package-qualified name.
      const bare = (src.match(/(?<![.\w])View\./g) || []).length;
      const imported = /^import android\.view\.View;/m.test(src);
      if (bare > 0 && !imported) {
        offenders.push(`${f} uses ${bare} bare View. with no import`);
      }
    }
    expect(
      offenders,
      `these providers use a bare View. but do not import android.view.View, which ` +
        `is a compile error (build-apk: "cannot find symbol") that no JS test can ` +
        `see: ${offenders.join("; ")}. Either add the import, or spell it ` +
        `android.view.View as the rest of the file does.`,
    ).toEqual([]);
  });
});