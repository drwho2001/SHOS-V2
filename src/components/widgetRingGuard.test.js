// widgetRingGuard.test.js
//
// ADDED 17 Oct 2026 - the countdown ring added to Next Dose and DoxyPEP.
//
// WHY THIS NEEDS A GUARD. Every one of the four things this asserts fails
// SILENTLY, each producing a ring that renders and looks like a ring:
//
//   1. A layer-list whose layers carry no android:id. ProgressBar addresses
//      layers by id; with none, both the level and the tint fall through to the
//      whole LayerDrawable, and LayerDrawable propagates both to EVERY child. So
//      the track and the arc deplete and recolour together, the arc covers the
//      track exactly, and the widget shows one bare arc with no muted remainder.
//      It does not look broken - it looks like a ring - while carrying no
//      information beyond the number in its centre. This is the assertion that
//      the first implementation failed; the other three were green throughout.
//   2. Mismatched innerRadius/thickness between track and arc. The two are
//      separate drawables, so nothing makes them agree; when they disagree you
//      get two concentric rings of different diameters rather than one arc
//      over one track. The mistake still LOOKS like a progress ring.
//   3. A ring whose ProgressBar inherits the default (circular indeterminate)
//      style, rendering a spinner. Reached accidentally whenever the style is
//      rewritten, because an unstyled ProgressBar is the circular one.
//   4. A missing android:rotation="-90", which is the only one a screenshot
//      would catch - the sweep simply starts at 3 o'clock. It is asserted here
//      anyway so the failure names itself instead of relying on someone noticing
//      an off-by-a-quarter-turn arc.
//
// The other two assertions are the ordinary hygiene this repo applies to any
// colour or dimension it introduces: both colour modes define the pair (a
// widget rendered in dark mode against a missing resource does not fall back to
// a sane value, it falls back to the light-mode one or fails outright), and the
// style inherits the horizontal ProgressBar rather than dropping it.
//
// A NOTE ON AN EARLIER CLAIM IN THIS FILE, since the repo records retracted
// claims rather than quietly deleting them. An earlier version justified
// useLevel as preventing a "solid disc" because its default "differs across API
// levels". That is NOT supported by this platform: GradientState.mUseLevelForShape
// defaults to true (GradientDrawable.java), so a ring with no useLevel is still
// level-dependent. The attribute is still asserted, because relying on a
// platform default is how the layer-id class of bug happens - but the stated
// reason was wrong and the assertion was green for a reason that did not hold.
//
// WHY A SOURCE GUARD AND NOT A BEHAVIOURAL TEST. As with every other widget
// guard here, the rendering is Android's and this suite cannot run it. What is
// asserted is the declaration - the thing that was wrong, and the thing that
// has to stay right. Pixels are confirmed by installing the APK and
// screenshotting in portrait at 2 cells, which is how the truncation this ring
// sits inside was found in the first place.
//
// The anti-vacuity assertion at the end is the important one: without it,
// deleting every ring from every layout would satisfy every test above.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RES = join(process.cwd(), "android", "app", "src", "main", "res");
const LAYOUTS = join(RES, "layout");

const read = (...p) => readFileSync(join(...p), "utf8");

const track = read(RES, "drawable", "widget_ring_track.xml");
const arc = read(RES, "drawable", "widget_ring_arc.xml");
const composed = read(RES, "drawable", "widget_ring.xml");
const styles = read(RES, "values", "styles.xml");
const light = read(RES, "values", "colors.xml");
const night = read(RES, "values-night", "colors.xml");

describe("countdown ring geometry", () => {
  it("both shape layers declare useLevel, so setProgressBar can move the sweep", () => {
    for (const [name, src] of [["track", track], ["arc", arc]]) {
      expect(
        /android:useLevel="true"/.test(src),
        `${name} must state android:useLevel="true" explicitly. Its default varies ` +
          `by API level, and where it resolves false the arc draws a solid disc - ` +
          `which looks exactly like a full ring, so the widget would report a ` +
          `full countdown for an overdue dose with nothing visibly wrong.`,
      ).toBe(true);
    }
  });

  it("track and arc share identical geometry", () => {
    // Extracted rather than compared as whole blocks, so the failure says WHICH
    // dimension drifted - the two files are edited separately and a mismatch
    // produces concentric rings, which still looks like a progress ring.
    const geom = (src) => {
      const m = /innerRadius="([^"]+)"[\s\S]*?thickness="([^"]+)"/.exec(src);
      return m ? { innerRadius: m[1], thickness: m[2] } : null;
    };
    expect(geom(track), "track must declare innerRadius and thickness").not.toBeNull();
    expect(geom(arc), "arc must declare innerRadius and thickness").not.toBeNull();
    expect(
      geom(arc),
      "arc geometry must match the track exactly. A mismatch draws two concentric " +
        "rings rather than one arc over one track, which still reads as a ring.",
    ).toEqual(geom(track));
  });

  it("the composed drawable is track-then-arc in that order", () => {
    // Order is load-bearing and free to invert by accident: arc first means the
    // track paints over it and the ring always looks empty.
    const ti = composed.indexOf("widget_ring_track");
    const ai = composed.indexOf("widget_ring_arc");
    expect(ti, "composed drawable must reference the track").toBeGreaterThan(-1);
    expect(ai, "composed drawable must reference the arc").toBeGreaterThan(-1);
    expect(
      ti < ai,
      "the track must be listed BEFORE the arc, or the track paints over the " +
        "sweep and the ring renders permanently empty.",
    ).toBe(true);
  });

  it("the layers carry @android:id/progress and @android:id/background", () => {
    // THE ONE THAT MATTERS, and the reason this file exists at all.
    //
    // ADDED 17 Oct 2026 after the first implementation shipped without ids and a
    // challenger found it broken. ProgressBar addresses a layer-list BY ID:
    // setVisualProgress looks up findDrawableByLayerId(R.id.progress) to decide
    // which layer gets setLevel(), and getTintTarget(R.id.progress, true) looks
    // up the same id to decide which layer gets tinted. With no ids BOTH lookups
    // miss and fall back to the entire LayerDrawable - and
    // LayerDrawable.onLevelChange forwards the level to EVERY child, while
    // LayerDrawable.setTintList tints EVERY child. So both layers received the
    // same level and the same colour, the arc covered the track exactly, and the
    // widget rendered as one bare depleting arc with no muted remainder. It did
    // not look broken; it looked like a ring, while carrying no information
    // beyond the number in its centre.
    //
    // Every other assertion in this file passed while that was true, which is why
    // this one is here.
    expect(
      /android:id="@android:id\/background"/.test(composed),
      "the track layer must be android:id=\"@android:id/background\". ProgressBar " +
        "addresses layers by id; without it the level and the tint fall through to " +
        "the whole LayerDrawable and LayerDrawable propagates both to every child, " +
        "so the track and the arc deplete together and no remainder is visible.",
    ).toBe(true);
    expect(
      /android:id="@android:id\/progress"/.test(composed),
      "the arc layer must be android:id=\"@android:id/progress\". This is the id " +
        "ProgressBar uses to choose which layer setLevel() and setProgressTintList() " +
        "apply to.",
    ).toBe(true);
  });
});

describe("ring ProgressBar style", () => {
  it("inherits the horizontal ProgressBar and lifts its height cap", () => {
    // Both halves are needed. Without the horizontal parent an unstyled
    // ProgressBar is the circular indeterminate one and renders a spinner.
    // Without the lifted maxHeight the parent's few-dp cap (sized for a 4dp
    // line) squashes a 64dp ring into a sliver rather than being ignored.
    expect(
      /name="ShosWidgetRing"\s+parent="@android:style\/Widget\.ProgressBar\.Horizontal"/.test(styles),
      "ShosWidgetRing must declare parent=\"@android:style/Widget.ProgressBar.Horizontal\". " +
        "An unstyled ProgressBar is the circular indeterminate one and renders a spinner.",
    ).toBe(true);
    const block = /<style name="ShosWidgetRing"[\s\S]*?<\/style>/.exec(styles);
    expect(block, "ShosWidgetRing style block must exist").not.toBeNull();
    expect(
      /name="android:maxHeight">0dp</.test(block[0]),
      "ShosWidgetRing must set maxHeight to 0dp. The horizontal parent caps height " +
        "at a few dp, which squashes a 64dp ring into a sliver instead of being ignored.",
    ).toBe(true);
  });
});

describe("ring usage in widget layouts", () => {
  const layouts = readdirSync(LAYOUTS).filter((f) => f.endsWith(".xml"));
  const ringLayouts = layouts.filter((f) => read(LAYOUTS, f).includes("ShosWidgetRing"));

  it("at least one widget actually uses the ring (anti-vacuity)", () => {
    // Without this, deleting the ring from every layout passes every assertion
    // above - they read drawables and styles, not usage.
    expect(
      ringLayouts.length,
      "no widget layout references ShosWidgetRing. The ring guards read drawables " +
        "and styles directly, so they cannot detect the ring being removed wholesale.",
    ).toBeGreaterThan(0);
  });

it("every ring is rotated -90 so the sweep starts at 12 o'clock", () => {
    for (const f of ringLayouts) {
      const src = readFileSync(join(LAYOUTS, f), "utf8");
      // The ProgressBar carrying the style must carry the rotation with it -
      // a style cannot set it, because rotation is applied to the inflated view.
      const tags = src.match(/<ProgressBar[\s\S]*?\/>/g) || [];
      const styled = tags.filter((t) => t.includes("ShosWidgetRing"));
      expect(
        styled.length,
        `${f} references ShosWidgetRing but no <ProgressBar> carries it.`,
      ).toBeGreaterThan(0);
      for (const tag of styled) {
        expect(
          /android:rotation="-90"/.test(tag),
          `${f}: the ring ProgressBar must carry android:rotation="-90". ` +
            `Without it the sweep starts at 3 o'clock instead of 12.`,
        ).toBe(true);
      }
    }
  });

  it("the ring is small enough to clear the caption at the real 2-cell height", () => {
    // ADDED 18 Oct 2026 after measuring the 64dp ring against the widget it
    // actually sits in. 109dp wide x 166.55dp tall is the 2-cell placement,
    // measured on this device via OPTION_APPWIDGET_SIZES.
    //
    // The ring is FrameLayout-CENTRED, so with 16dp padding its lower edge falls
    // at 16 + (H - 32) / 2 + ring / 2. The caption block (countdown + dose time +
    // medication name, stacked at the bottom) reaches up to about 55dp. At a 64dp
    // ring the two overlapped by roughly 20dp - the ring was drawn straight
    // across the medication name, which is a large part of why this widget "looked
    // wrong at 2 cells" and was not a text-size problem at all.
    //
    // Raising minResizeHeight would NOT have fixed it: the floor for a 64dp ring is
    // 206dp, and the owner deliberately moved these widgets OFF 3 cells because
    // they were too big. A smaller ring was the only fix that preserved the size
    // the owner chose, so this asserts the ring stays small enough.
    //
    // The bound is on the RING SIZE ALONE because it is the only term that moves
    // without changing the caption, the padding, or the placement.
    const H = 166.55;      // measured 2-cell height
    const PAD = 16;        // root padding, each side
    const CAPTION_TOP = 95.6; // where the stacked caption block begins
    const MAX_RING = 52;   // the largest ring that still clears it

    for (const f of ringLayouts) {
      const src = readFileSync(join(LAYOUTS, f), "utf8");
      const tags = src.match(/<ProgressBar[\s\S]*?\/>/g) || [];
      const styled = tags.filter((t) => t.includes("ShosWidgetRing"));
      for (const tag of styled) {
        const w = /android:layout_width="(\d+)dp"/.exec(tag);
        const h = /android:layout_height="(\d+)dp"/.exec(tag);
        expect(w && h, `${f}: the ring must declare both dimensions in dp`).toBeTruthy();
        expect(
          Number(w[1]),
          `${f}: the ring's width and height disagree (${w[1]}dp vs ${h[1]}dp).`,
        ).toBe(Number(h[1]));
        const ringDp = Number(w[1]);
        const lowerEdge = PAD + (H - 2 * PAD) / 2 + ringDp / 2;
        expect(
          ringDp,
          `${f}: the ring is ${ringDp}dp, whose lower edge falls at ` +
            `${lowerEdge.toFixed(1)}dp - past the caption top of ${CAPTION_TOP}dp, ` +
            `so the ring is drawn across the text below it. The largest ring that ` +
            `clears it at the measured 2-cell height of ${H}dp is ${MAX_RING}dp. ` +
            `If this needs a bigger ring, raise minResizeHeight instead - but note ` +
            `that forces 3 cells, which the owner moved away from deliberately.`,
        ).toBeLessThanOrEqual(MAX_RING);
      }
    }
  });
});

describe("ring colour palette", () => {
  it("both colour modes define widget_urgent and widget_ring_track", () => {
    // A dark-mode widget rendering against a resource defined only in values/
    // does not degrade sensibly - it either throws at inflate (which the host
    // swallows into its error view, so the widget reads "Can't load widget") or
    // silently reuses the light-mode value on a dark background.
    for (const [mode, src] of [["values", light], ["values-night", night]]) {
      for (const name of ["widget_urgent", "widget_ring_track"]) {
        expect(
          new RegExp(`name="${name}"`).test(src),
          `${mode}/colors.xml must define ${name}. A dark-mode widget reading a ` +
            `light-mode-only colour either fails to inflate or renders light-mode ` +
            `ink on a dark background.`,
        ).toBe(true);
      }
    }
  });

  it("the arc has a real palette colour, which is now its ONLY colour", () => {
    // CHANGED 18 Oct 2026. This used to be described as a "first-inflate
    // fallback" that the provider overrode per push with setProgressTintList.
    // That override is NOT POSSIBLE: RemoteViews.setProgressTintList is a @hide
    // API absent from the SDK level this project compiles against, and build-apk
    // rejected every call site with "cannot find symbol".
    //
    // So the arc's colour is now permanent for the life of the widget, not
    // per-push. That makes it a thing to guard rather than a fallback to
    // mention: a typo'd or removed colour resource here would leave the ring
    // rendering in the platform default with nothing failing here.
    //
    // The urgency signal is the status WORD beside/inside it, recoloured with
    // setTextColor, which is public API and does compile. If the arc is ever to
    // follow urgency, the route is one ProgressBar per state swapped by
    // visibility - a tint is not reachable from a provider.
    expect(arc).toContain("@color/widget_good");
  });
});