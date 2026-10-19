// widgetVisibilityRestoredGuard.test.js
//
// ADDED 18 Oct 2026 - guards a bug that no existing guard could see, and that
// looked like a different bug entirely on screen.
//
// THE BUG. RemoteViews recycles the inflated view whenever the layout id
// matches (RemoteViews.canRecycleView -> reapply -> performApply), and
// performApply walks ONLY the actions carried by the NEW RemoteViews. There is
// no reset-to-defaults pass. So any view a branch sets GONE stays GONE for every
// later update that does not mention it.
//
// In practice: the Redacted branch set a field GONE, and the Full branch set its
// TEXT without ever setting its VISIBILITY. Switching Redacted -> Full therefore
// left the widget rendering a title and nothing else, permanently - because the
// provider only rebuilt on the next data push, which for some fields was never.
//
// WHY EVERY OTHER GUARD MISSED IT. Each failed to match the shape, which is the
// general failure this repo keeps re-learning and which CLAUDE.md states
// directly: ask what shape a guard cannot match.
//
//   - widgetRedactedRender checks that a Redacted branch HIDES the sensitive
//     views. The defect is the opposite statement - that the Full branch SHOWS
//     them - and asserting it there would have been "the other guard", which is
//     how two guards end up asserting the same thing and neither noticing a gap.
//   - widgetTextFitMaxLinesGuard reads fit() call sites. Visibility is not one.
//   - widgetTapAndFallbackGuard reads the tap intent. Not this.
//   - widgetVerticalBudgetGuard reads layout geometry. A provider bug, not a
//     layout one.
//
// WHY THIS IS CHECKABLE WITHOUT RUNNING ANDROID. The assertion is structural:
// every view a provider sets GONE anywhere must be set VISIBLE somewhere too.
// That is a property of the source, it does not need a device, and it is
// exactly the pairing a code reader misses - the two statements are 60 lines
// apart in different branches.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const JAVA_DIR = join(
  process.cwd(), "android", "app", "src", "main", "java", "com", "shos", "app", "widget",
);

const providers = readdirSync(JAVA_DIR).filter(
  (f) => f.endsWith("WidgetProvider.java") && f !== "ResizingWidgetProvider.java",
);

/** Strip comments, which in this repo quote the very calls being searched for. */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/** Every view id this source sets GONE, and every one it sets VISIBLE. */
const visibilityCalls = (src) => {
  const c = code(src);
  const gone = new Set();
  const visible = new Set();
  // Matches BOTH the bare and the android.view.-qualified spellings. Three of
  // the providers use one and four use the other, because the qualified form was
  // added to a file with no View import at a time when the others already had
  // one - so a single spelling would read a real, complete fix as a violation.
  for (const m of c.matchAll(/setViewVisibility\(\s*R\.id\.(\w+)\s*,\s*(?:android\.view\.)?View\.(GONE|INVISIBLE)\s*\)/g)) {
    gone.add(m[1]);
  }
  for (const m of c.matchAll(/setViewVisibility\(\s*R\.id\.(\w+)\s*,\s*(?:android\.view\.)?View\.VISIBLE\s*\)/g)) {
    visible.add(m[1]);
  }
  return { gone, visible };
};

/**
 * Views that are hidden at EVERY tier by design, and so are legitimately never
 * set VISIBLE again.
 *
 * Asserted as an explicit exclusion list rather than tolerated as a failure,
 * because the general rule is right for everything else and this is the one
 * deliberate exception. widget_clinic_nhs_num is the case: WidgetBridgePlugin
 * never carries an NHS number and the provider has no parameter for it, so it is
 * hidden at the Full tier too - restoring it "to satisfy the guard" would put a
 * field nobody wanted on the home screen in order to make a test pass. The
 * provider's own comment records that there is deliberately no reveal affordance.
 *
 * Kept here rather than left as a failing test because a permanently red test
 * gets muted, and a muted test is how this whole class of bug ships. Adding a
 * view to this list is a PRIVACY decision and should be argued for, not done to
 * turn the suite green - which is why the comment above each name is the point.
 */
const ALWAYS_HIDDEN_BY_DESIGN = {
  widget_clinic_nhs_num:
    "never stored (the bridge ignores the field, the provider has no parameter for " +
    "it) and deliberately unrevealed - ClinicCardWidgetProvider documents that a " +
    "reveal button was tried, fired a dead deep link, and implied a permanent-unmask " +
    "kept in the widget's own preferences",
  widget_clinic_heading_details:
    "the Clinic Card keeps only appointment date/time/location in the glanceable card; " +
    "the details block was removed because it clipped the card at the placed 2-cell size",
};

describe("a view hidden in one branch is restored in another", () => {
  it("found the providers - otherwise every check below is vacuous", () => {
    expect(providers.length, "no widget providers discovered").toBe(10);
  });

  it("every view set GONE anywhere is also set VISIBLE somewhere", () => {
    const offenders = [];
    for (const f of providers) {
      const src = readFileSync(join(JAVA_DIR, f), "utf8");
      const { gone, visible } = visibilityCalls(src);
      for (const view of gone) {
        if (visible.has(view)) continue;
        if (view in ALWAYS_HIDDEN_BY_DESIGN) continue;
        offenders.push(`${f}: ${view}`);
      }
    }
    expect(
      offenders,
      `these views are set GONE but never set VISIBLE again: ${offenders.join(", ")}. ` +
        `RemoteViews recycles the view when the layout id matches and applies only the ` +
        `new RemoteViews' actions, so a view hidden in the Redacted branch stays hidden ` +
        `for every later update - and a privacy-tier change reads on screen as a ` +
        `SIZING bug, which is why it went unfixed. Set VISIBLE in the other branch. ` +
        `(A view that should stay hidden at EVERY tier belongs in ` +
        `ALWAYS_HIDDEN_BY_DESIGN, which is a privacy decision, not a tidy-up.)`,
    ).toEqual([]);
  });

  it("the by-design exclusions are all still used, and none has crept in unargued", () => {
    // Two directions, because this list can rot either way.
    //
    // Forward: a name that no provider hides any more is a stale exemption, and a
    // stale exemption is a hole - it would silently permit a field to be hidden
    // with no restore, which is the defect this file exists to prevent.
    //
    // Backward: every excluded name must be explained. An unexplained entry is a
    // privacy exemption nobody can audit, and "we added it to make the test pass"
    // is indistinguishable from "we added it because it should be hidden".
    const stillHiddenSomewhere = new Set();
    for (const f of providers) {
      for (const view of visibilityCalls(readFileSync(join(JAVA_DIR, f), "utf8")).gone) {
        stillHiddenSomewhere.add(view);
      }
    }
    const stale = Object.keys(ALWAYS_HIDDEN_BY_DESIGN)
      .filter((v) => !stillHiddenSomewhere.has(v));
    expect(
      stale,
      `these are exempt as "hidden by design" but nothing hides them any more, so the ` +
        `exemption is stale and would now hide a real regression: ${stale.join(", ")}. ` +
        `Remove them from ALWAYS_HIDDEN_BY_DESIGN.`,
    ).toEqual([]);

    const unexplained = Object.entries(ALWAYS_HIDDEN_BY_DESIGN)
      .filter(([, why]) => !why || why.length < 20)
      .map(([name]) => name);
    expect(
      unexplained,
      `every ALWAYS_HIDDEN_BY_DESIGN entry needs a written reason: ${unexplained.join(", ")}`,
    ).toEqual([]);
  });

  it("the check would actually catch a regression", () => {
    // Anti-vacuity, and it is here because this file is about a guard that could
    // not see its bug. If the regex above stopped matching anything - a renamed
    // view id, a differently-spelled constant - `gone` would be empty on every
    // provider and the test above would pass while asserting nothing.
    //
    // Fed a fixture with the exact defect shape, so the parsing is proven
    // independently of the seven real files.
    const buggy = code(`
      views.setViewVisibility(R.id.widget_thing, View.GONE);
      views.setViewVisibility(R.id.widget_other, android.view.View.GONE);
      views.setViewVisibility(R.id.widget_visible_one, View.VISIBLE);
    `);
    const { gone, visible } = visibilityCalls(buggy);
    expect([...gone].sort()).toEqual(["widget_other", "widget_thing"]);
    // Neither hidden view is restored - the defect, isolated from the repo.
    expect([...gone].filter((v) => visible.has(v))).toEqual([]);
    // And the one that is shown is not mistaken for a restore.
    expect(visible.has("widget_visible_one")).toBe(true);
  });

  it("the data providers inherit a resize re-render", () => {
    // The second half of the same defect class. onAppWidgetOptionsChanged has an
    // EMPTY base implementation in AppWidgetProvider, so a widget whose width-
    // dependent decisions (which fields to drop, what size to render) were
    // frozen at the last data push stayed frozen after a manual resize.
    const base = readFileSync(join(JAVA_DIR, "ResizingWidgetProvider.java"), "utf8");
    expect(
      /onAppWidgetOptionsChanged/.test(base) && /render\(context, appWidgetManager, appWidgetId\)/.test(base),
      "ResizingWidgetProvider must override onAppWidgetOptionsChanged and re-render. " +
        "The platform base implementation is empty, so without this a resize changes " +
        "the widget's box but nothing about its contents.",
    ).toBe(true);

    const notMigrated = providers.filter(
      (f) => !f.startsWith("QuickAdd") &&
        !/extends ResizingWidgetProvider/.test(readFileSync(join(JAVA_DIR, f), "utf8")),
    );
    expect(
      notMigrated,
      `these data providers still extend AppWidgetProvider directly, so a resize does ` +
        `not re-render them: ${notMigrated.join(", ")}. The three QuickAdd widgets are ` +
        `excluded deliberately - they render static text with no width-dependent ` +
        `decision, so there is nothing stale to re-render.`,
    ).toEqual([]);
  });
});
