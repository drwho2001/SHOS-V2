// t087 - the Clinic Card widget's rows are grouped under three section headings.
//
// WHY THIS EXISTS. The widget stacked eight data rows with no structure, which
// read as a mishmash: a user scanning a home screen for the clinic's address
// could not find it among the test counts and document types. Grouping under
// "When" / "Where" / "Details" makes the same rows findable in the same
// structure as the app's own Clinic Card screen.
//
// Three properties are load-bearing, so they are pinned here rather than
// assumed from reading the diff:
//
//   1. The layout stays FLAT - exactly one container. A nested ViewGroup in a
//      widget RemoteViews layout does not inflate here (L-076, proven twice on
//      the owner's device, and this very widget is the proven case: the Clinic
//      Card rendered as "Can't load widget" in both the picker and on the home
//      screen because of a nested container). Adding a heading must never mean
//      adding a container.
//
//   2. Headings carry no user data in the layout. Every data row's android:text
//      is "" and is set by the provider; the headings are static "When"/
//      "Where"/"Details". A heading naming a person or place would disclose
//      before the first push, which is the fail-open direction this whole file
//      exists to prevent.
//
//   3. All three are hidden at the Redacted tier, in the SAME branch as the
//      data rows they label. A static label is safe to show, but a bare heading
//      over a blank card reads as a broken widget rather than an intentional
//      empty state - so the rule the data rows follow applies to the headings too.
//
// The provider is read as source, the way widgetRedactedRender and
// widgetTapAndFallbackGuard already do for every other widget, because Java
// cannot be compiled on this machine (L-045, L-053) and CI's Build Android APK
// is the only real confirmation.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const LAYOUT = readFileSync(
  join(ROOT, "android/app/src/main/res/layout/clinic_card_widget.xml"),
  "utf8"
);
const PROVIDER = readFileSync(
  join(ROOT, "android/app/src/main/java/com/shos/app/widget/ClinicCardWidgetProvider.java"),
  "utf8"
);

describe("Clinic Card widget layout (t087)", () => {
  it("stays FLAT - exactly one container, because nested ViewGroups do not inflate", () => {
    const containers = LAYOUT.match(
      /<(LinearLayout|FrameLayout|RelativeLayout|GridLayout|ScrollView|ViewFlipper)\b/g
    );
    expect(containers.length, "container count in clinic_card_widget.xml").toBe(1);
  });

  it("declares the three section headings", () => {
    expect(LAYOUT).toMatch(/@\+id\/widget_clinic_heading_when/);
    expect(LAYOUT).toMatch(/@\+id\/widget_clinic_heading_where/);
    expect(LAYOUT).toMatch(/@\+id\/widget_clinic_heading_details/);
  });

  it("headings are STATIC text, so they disclose nothing before the first push", () => {
    // A heading naming a person or place would be a fail-open on a home screen.
    // Assert the literal strings and assert they are not the provider-set
    // placeholders the data rows use.
    expect(LAYOUT).toMatch(/android:text="When"/);
    expect(LAYOUT).toMatch(/android:text="Where"/);
    expect(LAYOUT).toMatch(/android:text="Details"/);
    // No heading carries an empty text or a provider placeholder.
    expect(LAYOUT).not.toMatch(/widget_clinic_heading[^>]*android:text=""/);
  });

  it("headings and data rows carry no USER DATA in the layout", () => {
    // The privacy invariant is narrower than "no android:text at all". A static
    // placeholder ("No upcoming appointment") is safe - it names nobody. What
    // must never appear in the layout is a VALUE: a name, a place, a date.
    // The provider sets those at render time, so a value baked into the layout
    // would disclose before the first push, which is the fail-open direction.
    const forbidden = [
      /widget_clinic_(date|visit_time|location|clinic_num|tests|doctype|nhs_num)[^>]*android:text="[^"]*(Dr\.|Clinic [A-Z]|Hospital|Health Centre|[A-Z][a-z]+ [A-Z][a-z]+ Road|[A-Z][a-z]+ Street|\d{1,2} [A-Z][a-z]+ \d{4})/,
    ];
    for (const re of forbidden) {
      expect(LAYOUT, "layout carries a user value").not.toMatch(re);
    }
    // The data rows must use either no text or a clearly generic placeholder,
    // never a provider-set value. Assert the generic placeholders are static
    // strings, not empty (which would mean the provider must always fill them).
    expect(LAYOUT).toMatch(/widget_clinic_date[^>]*android:text="No upcoming appointment"/);
  });

  it("XML declaration is intact and tags balance", () => {
    // A malformed view fails :app:parseDebugLocalResources on CI with no local
    // signal (L-057). Checked here because it is cheap and catches the class.
    expect(LAYOUT.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    for (const t of ["LinearLayout", "TextView"]) {
      const open = (LAYOUT.match(new RegExp("<" + t + "\\b", "g")) || []).length;
      const close = (LAYOUT.match(new RegExp("</" + t + ">", "g")) || []).length;
      const selfClose = (LAYOUT.match(new RegExp("<" + t + "\\b[^>]*/>", "g")) || []).length;
      expect(open, t + " open count").toBe(close + selfClose);
    }
  });
});

describe("Clinic Card provider hides the headings at Redacted (t087)", () => {
  it("hides all three, in the same branch as the data rows they label", () => {
    for (const id of [
      "widget_clinic_heading_when",
      "widget_clinic_heading_where",
      "widget_clinic_heading_details",
    ]) {
      expect(PROVIDER).toMatch(
        new RegExp("setViewVisibility\\(R\\.id\\." + id + ", android\\.view\\.View\\.GONE\\)")
      );
    }
  });

  it("still hides the data rows, so the headings did not displace them", () => {
    // L-083's sibling: a change that "adds headings" and accidentally drops one
    // of the seven existing hides would pass a test that only checks the
    // headings. Count the set.
    for (const id of [
      "widget_clinic_date",
      "widget_clinic_visit_time",
      "widget_clinic_location",
      "widget_clinic_clinic_num",
      "widget_clinic_tests",
      "widget_clinic_doctype",
      "widget_clinic_nhs_num",
    ]) {
      expect(PROVIDER).toMatch(
        new RegExp("setViewVisibility\\(R\\.id\\." + id + ", android\\.view\\.View\\.GONE\\)")
      );
    }
  });

  it("the Redacted branch is an early return, so no heading renders below it", () => {
    // The structural fact that makes the hide set complete: the Redacted path
    // returns, so nothing after it can render a heading at that tier. Without
    // this, a later edit could add code below the return and a Redacted card
    // would show a heading with nothing under it.
    //
    // CHANGED 18 Oct 2026 - this now distinguishes SHOWING a heading from
    // RESTORING one. The original searched for any "widget_clinic_heading"
    // reference after the return and demanded none, which was correct when the
    // only thing the provider ever did with those ids was hide them. It then began
    // failing on the VISIBLE restores added by the sticky-visibility fix - which
    // is exactly right to fail on a real leak, and exactly wrong to fail on a
    // restore. RemoteViews recycles the view, so a heading hidden at the Redacted
    // tier and never restored is blank space in the Full-tier card; see
    // widgetVisibilityRestoredGuard for the other half of that pair.
    //
    // So: no heading may be made VISIBLE below the return, and no heading may be
    // given TEXT below the return. Both would render at the Redacted tier.
    const redactedAt = PROVIDER.indexOf("widget_clinic_title, redactedText");
    expect(redactedAt).toBeGreaterThan(-1);
    const returnAt = PROVIDER.indexOf("return;", redactedAt);
    expect(returnAt, "Redacted branch has no early return").toBeGreaterThan(-1);

    // Only the TEXT assertion survives. A setViewVisibility(...VISIBLE) below the
    // return is harmless: the early return means that code never executes at the
    // Redacted tier at all, which is precisely what this test exists to establish.
    // The restores added by the sticky-visibility fix live there and must be
    // allowed to - RemoteViews recycles the view, so a heading hidden at Redacted
    // and never restored is blank space in the Full-tier card
    // (widgetVisibilityRestoredGuard covers that half).
    //
    // Giving a heading TEXT below the return is the real risk, because
    // setTextViewText on a heading that is then left visible is what would put a
    // bare "WHEN" with no rows under it on the screen.
    const after = PROVIDER.slice(returnAt);
    for (const id of [
      "widget_clinic_heading_when",
      "widget_clinic_heading_where",
      "widget_clinic_heading_details",
    ]) {
      expect(
        after,
        `${id} is given text after the Redacted return, so it would render at the ` +
          `Redacted tier with no rows under it - the exact failure t087 fixed.`,
      ).not.toMatch(new RegExp("setTextViewText\\(R\\.id\\." + id + ","));
    }
  });
});