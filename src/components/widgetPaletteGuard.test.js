import { describe, it, expect } from "vitest";
import fs from "node:fs";

// ADDED 3 Oct 2026. The ten widget layouts used to hardcode their colours per
// file - ten slightly different greys, no source of truth - and every one was
// tuned for a near-black card. When the card was re-themed to teal in light and
// dark variants, every one of those text colours needed re-checking, and one of
// them (#FF7BAC on the clinic card's inner surface) measured 4.39:1: under WCAG
// AA. A colour file with a comment claiming the pairs were fine is not evidence,
// so this computes them.
//
// The maths is self-checked against known WCAG pairs below, because a contrast
// test whose own formula is wrong would pass everything - the repo has already
// recorded a palette test that reported "no regressions" from a detector that
// had never fired.

const RES = "android/app/src/main/res";

function parseColors(file) {
  const out = {};
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/<color name="([^"]+)"\s*>([^<]+)</g)) out[m[1]] = m[2].trim();
  return out;
}

const THEMES = {
  light: parseColors(`${RES}/values/colors.xml`),
  dark: parseColors(`${RES}/values-night/colors.xml`),
};

// A text colour can land on the card OR on the clinic card's inner surface.
// Checking only the obvious background is how the 4.39:1 pair survived: it
// passes on the card and fails inside the card.
const TEXT_KEYS = [
  "widget_text_primary",
  "widget_text_muted",
  "widget_good",
  "widget_warn",
  "widget_cycle",
  "widget_accent",
];
const AA = 4.5;

const lin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (hex) => {
  const s = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("widget palette (t057 / t062)", () => {
  it("the contrast maths itself is correct - checked against known WCAG pairs", () => {
    // These four are the canonical WCAG examples; if the formula drifts, they drift.
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(ratio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(ratio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
    expect(ratio("#008000", "#FFFFFF")).toBeCloseTo(5.13, 1);
  });

  it("both system themes define exactly the same widget colours", () => {
    // A colour present only in values/ silently falls back to the light value in
    // dark mode, which is precisely the "black box in light mode" bug inverted.
    expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort());
  });

  it("every widget text colour clears WCAG AA on both backgrounds, in both themes", () => {
    const failures = [];
    for (const [mode, t] of Object.entries(THEMES)) {
      for (const name of TEXT_KEYS) {
        for (const [bgName, bg] of [
          ["card", t.widget_bg],
          ["inner surface", t.widget_surface_alt],
        ]) {
          const r = ratio(t[name], bg);
          if (r < AA) failures.push(`${mode}/${name} on ${bgName} = ${r.toFixed(2)}:1`);
        }
      }
    }
    expect(failures, "these widget colour pairs are under WCAG AA 4.5:1: " + failures.join(", ")).toEqual([]);
  });

  it("the widget background is teal-tinted, not the old near-black", () => {
    // Asserted rather than left to a comment: #1B1B1F was hardcoded in all ten
    // layouts and made every widget a black box on a light wallpaper.
    expect(THEMES.light.widget_bg.toUpperCase()).not.toBe("#1B1B1F");
    expect(THEMES.dark.widget_bg.toUpperCase()).not.toBe("#1B1B1F");
    // Teal means the green and blue channels dominate red.
    // OFFSETS [0,2,4], not [1,3,5]. The first version sliced [1,3,5] while ALSO
    // stripping the leading "#", so it skipped the red digit entirely and read
    // #10312F as r=3 g=18 b=47 - an increasing sequence that happened to pass
    // while measuring the wrong channels. It only surfaced when the background
    // changed to #1D4E4B, where the same wrong offsets read r=212 g=78 and
    // failed. A test that passes for the wrong reason is indistinguishable from
    // one that passes for the right one, right up until the value moves.
    const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
    const [r, g, b] = rgb(THEMES.dark.widget_bg);
    expect(g, `dark widget_bg ${THEMES.dark.widget_bg} is not teal-tinted`).toBeGreaterThan(r);
    expect(b, `dark widget_bg ${THEMES.dark.widget_bg} is not teal-tinted`).toBeGreaterThan(r);
    // ...and the light one, which is the case the owner actually complained about.
    const [lr, lg, lb] = rgb(THEMES.light.widget_bg);
    expect(lg, `light widget_bg ${THEMES.light.widget_bg} is not teal-tinted`).toBeGreaterThan(lr);
    expect(lb, `light widget_bg ${THEMES.light.widget_bg} is not teal-tinted`).toBeGreaterThan(lr);
  });
});

describe("widget picker (t056)", () => {
  const widgets = [
    "next_dose",
    "refill",
    "appointment",
    "test",
    "cycle",
    "doxy_pep",
    "quick_add_contact",
    "quick_add_encounter",
    "quick_add_medication",
    "clinic_card",
  ];

  it("finds all ten widget_info files, so the checks below are not vacuous", () => {
    for (const w of widgets) {
      expect(fs.existsSync(`${RES}/xml/${w}_widget_info.xml`), `missing ${w}_widget_info.xml`).toBe(true);
    }
  });

  it("every widget declares a label and a description", () => {
    // Without these the picker lists ten entries all named after the app, which
    // is the "I can't tell which tile is which" report.
    for (const w of widgets) {
      const xml = fs.readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8");
      const label = xml.match(/android:label="([^"]+)"/)?.[1];
      expect(label, `${w} has no android:label`).toBeTruthy();
      expect(label.trim().length, `${w} has a blank label`).toBeGreaterThan(0);
      expect(xml, `${w} has no android:description`).toMatch(/android:description="@string\/[a-z_]+"/);
    }
  });

  it("every widget description is a string RESOURCE reference, not inline text", () => {
    // CI caught this, not the local gate: android:description on
    // <appwidget-provider> is a reference attribute, and a literal fails with
    // "is incompatible with attribute description (attr) reference" at
    // :app:processDebugResources. The local toolchain cannot compile Android
    // resources, so nothing in verify:fast would ever have seen it. Asserting it
    // here moves the failure from a 4-minute CI round trip to a unit test.
    const strings = fs.readFileSync(`${RES}/values/strings.xml`, "utf8");
    for (const w of widgets) {
      const xml = fs.readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8");
      const desc = xml.match(/android:description="([^"]+)"/)?.[1];
      expect(desc, `${w} has no description`).toBeTruthy();
      expect(
        desc.startsWith("@string/"),
        `${w} description is "${desc}" - it must be a @string/ reference or the APK build fails`,
      ).toBe(true);
      // ...and the resource it points at must actually exist and be non-empty.
      const name = desc.replace("@string/", "");
      const declared = strings.match(new RegExp(`<string name="${name}">([^<]*)</string>`))?.[1];
      expect(declared, `${w} points at @string/${name} which is not declared`).toBeTruthy();
      expect(declared.trim().length, `@string/${name} is blank`).toBeGreaterThan(0);
    }
  });

  it("every widget has its OWN preview, and the shared placeholder is gone", () => {
    for (const w of widgets) {
      const xml = fs.readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8");
      const img = xml.match(/android:previewImage="([^"]+)"/)?.[1];
      expect(img, `${w} has no previewImage`).toBe(`@drawable/widget_preview_${w}`);
      expect(
        fs.existsSync(`${RES}/drawable/widget_preview_${w}.xml`),
        `preview drawable for ${w} does not exist - the build would fail at resource linking`,
      ).toBe(true);
      // API 31+ renders the REAL layout instead, which is strictly better
      // because the layouts already carry placeholder android:text.
      expect(xml, `${w} has no previewLayout`).toMatch(/android:previewLayout="@layout\/[a-z_]+"/);
    }
    // The single shared placeholder is the thing this change exists to remove.
    expect(
      fs.existsSync(`${RES}/drawable/widget_preview.xml`),
      "the shared placeholder preview is back - all ten widgets would look identical again",
    ).toBe(false);
  });

  it("every widget caps its resize, so enlarging cannot leave an empty box", () => {
    // This is the device-reported defect: a large widget rendered as mostly empty
    // black space and read as "did not load". The layouts are a single vertical
    // LinearLayout with no size-dependent reflow, so unbounded height adds dead
    // space rather than content.
    for (const w of widgets) {
      const xml = fs.readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8");
      const maxH = xml.match(/android:maxResizeHeight="(\d+)dp"/)?.[1];
      const maxW = xml.match(/android:maxResizeWidth="(\d+)dp"/)?.[1];
      const minH = xml.match(/android:minHeight="(\d+)dp"/)?.[1];
      expect(maxH, `${w} has no maxResizeHeight`).toBeTruthy();
      expect(maxW, `${w} has no maxResizeWidth`).toBeTruthy();
      // A cap below the floor is not a cap, it is a broken widget.
      expect(Number(maxH), `${w} maxResizeHeight is below its minHeight`).toBeGreaterThanOrEqual(
        Number(minH),
      );
      expect(Number(maxH), `${w} is not allowed to grow vertically at all`).toBeGreaterThan(
        Number(minH),
      );
    }
  });

it("every widget layout uses the shared background, not a hardcoded colour", () => {
      // Ten layouts each carrying their own literal is how they drifted apart.
      for (const w of widgets) {
        const xml = fs.readFileSync(`${RES}/layout/${w}_widget.xml`, "utf8");
        expect(xml, `${w} does not use the shared widget background`).toMatch(
          /android:background="@drawable\/widget_background"/,
        );
        expect(xml, `${w} still hardcodes a background colour`).not.toMatch(
          /android:background="#[0-9A-Fa-f]{3,8}"/,
        );
        expect(xml, `${w} still hardcodes a text colour`).not.toMatch(
          /android:textColor="#[0-9A-Fa-f]{3,8}"/,
        );
      }
    });

    it("no widget layout uses android:autoLink", () => {
      // THE Clinic Card defect. autoLink makes the TextView build Linkify and
      // ClickableSpans, which RemoteViews cannot serialise, so the widget
      // inflates empty or broken - one broken widget out of ten, while the other
      // nine rendered fine. The pool flagged this exact attribute in t059 and it
      // survived until a user actually placed that widget and saw a black card.
      // The supported pattern is a whole-view click via setOnClickPendingIntent.
      for (const w of widgets) {
        const xml = fs.readFileSync(`${RES}/layout/${w}_widget.xml`, "utf8");
        expect(xml, `${w} uses android:autoLink - RemoteViews cannot inflate it`).not.toMatch(
          /android:autoLink/,
        );
      }
    });
  });

  describe("widget picker grouping and sizing", () => {
    const widgets = [
      "next_dose", "refill", "appointment", "test", "cycle", "doxy_pep",
      "quick_add_contact", "quick_add_encounter", "quick_add_medication", "clinic_card",
    ];
    const labelOf = (w) =>
      fs
        .readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8")
        .match(/android:label="([^"]+)"/)?.[1];

    it("every widget is offered at the SAME size in the picker", () => {
      // The owner asked about varying sizes twice. Each widget's content needs
      // different room, but four different footprints in one picker list reads
      // as clutter, so min size is uniform and maxResize carries the variation.
      const sizes = new Set();
      for (const w of widgets) {
        const xml = fs.readFileSync(`${RES}/xml/${w}_widget_info.xml`, "utf8");
        const minW = xml.match(/android:minWidth="(\d+)dp"/)?.[1];
        const minH = xml.match(/android:minHeight="(\d+)dp"/)?.[1];
        const cw = xml.match(/android:targetCellWidth="(\d+)"/)?.[1];
        const ch = xml.match(/android:targetCellHeight="(\d+)"/)?.[1];
        expect(minW && minH && cw && ch, `${w} is missing a size attribute`).toBeTruthy();
        sizes.add(`${minW}x${minH}/${cw}x${ch}`);
      }
      expect([...sizes], "these widgets are offered at different picker sizes: " + [...sizes].join(", "))
        .toHaveLength(1);
    });

    it("the three Quick Add widgets share a label prefix so they sort together", () => {
      // This is the "order is cluttered" fix. Launchers sort widgets by label, so
      // without a shared prefix "Contact", "Encounter" and "Medication" sort by
      // their own first letter and scatter between the other seven.
      const quick = ["quick_add_contact", "quick_add_encounter", "quick_add_medication"];
      const labels = quick.map(labelOf);
      for (const l of labels) expect(l, "a Quick Add widget lost its label").toBeTruthy();
      const prefixes = new Set(labels.map((l) => l.split(":")[0].trim()));
      expect(
        [...prefixes],
        "these Quick Add labels do not share a prefix, so they will not cluster: " + labels.join(", "),
      ).toHaveLength(1);
    });

    it("every widget <receiver> carries its own android:label", () => {
      // Lawnchair shows the APPLICATION label as each tile title and ignores the
      // provider XML's label, which is why every tile read "SHOS". The remaining
      // app-side lever is android:label on the <receiver> itself.
      const man = fs.readFileSync(`${RES}/../AndroidManifest.xml`, "utf8");
      const strings = fs.readFileSync(`${RES}/values/strings.xml`, "utf8");
      for (const w of widgets) {
        const cls =
          w
            .split("_")
            .map((p) => p[0].toUpperCase() + p.slice(1))
            .join("")
            .replace("DoxyPep", "DoxyPEP") + "WidgetProvider";
        const re = new RegExp(`android:name="\\.widget\\.${cls}"([^>]*)`);
        const m = man.match(re);
        expect(m, `no manifest receiver found for ${cls}`).toBeTruthy();
        const label = m[1].match(/android:label="@string\/([^"]+)"/)?.[1];
        expect(label, `${cls} has no android:label - its picker tile will read "SHOS"`).toBeTruthy();
        expect(
          strings,
          `@string/${label} is referenced by the manifest but not declared`,
        ).toMatch(new RegExp(`<string name="${label}">`));
      }
    });
  });
