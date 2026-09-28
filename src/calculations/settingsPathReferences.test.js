// Regression guard for a bug class found on 27 Sep 2026, while auditing the
// app as a brand-new user: user-facing copy that tells someone WHERE something
// lives, and is wrong.
//
// The onboarding and Guide screens exist for exactly this job - their whole
// purpose is to answer "where do I do X?" for someone who has never opened the
// app. That makes a stale path worse here than almost anywhere else in the
// product: it does not merely omit a nicety, it confidently sends a first-time
// user to a screen that does not exist, and they have no way to know the
// guidance is out of date rather than their own mistake.
//
// Two real instances shipped before this test existed:
//   - "Settings -> Design"  (the row is "Colour scheme"; renamed 16 Sep)
//   - "Settings -> Developer tools -> Storage"  (Storage is a SECTION WITHIN
//     that screen, not a sub-screen you can navigate into)
//
// WHY AN EXPLICIT TABLE AND NOT A PROSE SCAN: a first version of this file
// scanned every "Settings -> X" in every module and checked X against the real
// row list. It was abandoned after it produced five false positives on its
// first run - Android's own "Settings -> Apps -> Permissions" path, a line
// ending in a quote, and prose that merely mentions Settings. Tuning a
// free-text heuristic to separate those from genuine mistakes is the kind of
// unbounded churn this project has been burned by before, and a scanner loose
// enough to be quiet is also loose enough to miss the next real instance.
//
// So this asserts the paths that are ACTUAL navigation instructions, by name.
// Each entry is checked against the live Settings source, which means renaming
// a Settings row now breaks this test instead of silently making a piece of
// onboarding copy wrong - which is the whole point. Adding a genuinely new
// instructional path to onboarding/Guide is a one-line addition here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SETTINGS = readFileSync(path.join(ROOT, "src", "modules", "SHOS_Settings_Prototype.jsx"), "utf8");
const APP = readFileSync(path.join(ROOT, "src", "App.jsx"), "utf8");
const GUIDE = readFileSync(path.join(ROOT, "src", "modules", "settings", "GuideScreen.jsx"), "utf8");

/** Every label a user can see as a Settings row: <SettingsRow ... label="X" /> */
const ROWS = new Set([...SETTINGS.matchAll(/<SettingsRow\b[^>]*?\blabel="([^"]+)"/g)].map((m) => m[1]));

/** Every section header a user can see, rendered with TYPE.sectionLabel. */
// The char class includes `&` because sections render as JSX entities
// ("Security &amp; Privacy"). Missing that initially made a real section look
// absent, which is the same false-negative trap the row matcher guards below.
// Section headers are rendered with TYPE.sectionLabel, and may contain JSX
// entities ("Security &amp; Privacy") whose `;` a naive `[A-Za-z &]*` char
// class cannot cross - which silently hid a real section on the first run.
// Matching lazily up to the closing `</div>` is the correct boundary: the
// opening tag is already consumed by `[^>]*>`.
const SECTIONS = new Set(
  [...SETTINGS.matchAll(/TYPE\.sectionLabel[^>]*>\s*([A-Za-z][^<>{}]*?)\s*<\/div>/g)].map((m) =>
    m[1].replace("&amp;", "&").trim()
  )
);

/**
 * Source with `//` line comments removed.
 *
 * Needed because this repo's comments quote the very strings being asserted
 * about - the comment above records that onboarding USED to say "Settings ->
 * Design", and the fix comment quotes the corrected text. A raw substring
 * check therefore reports the bug is still present when the only remaining
 * occurrence is the comment explaining the fix.
 */
function withoutComments(src) {
  return src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join("\n");
}

// The instructional paths that actually appear in onboarding/Guide copy, as
// [file, source, the exact rendered text to look for, the path segments it
// names]. Segments are checked against the real rows/sections.
const PATHS = [
  {
    what: "colour scheme / dark mode",
    src: APP,
    text: "Settings → Colour scheme",
    segments: ["Colour scheme"],
  },
  {
    what: "My Profile",
    src: APP,
    text: "Settings → My Profile",
    segments: ["My Profile"],
  },
  {
    what: "menstrual tracking toggle",
    src: GUIDE,
    // Escaped exactly as it appears in the source, which is a JS string
    // literal containing its own quoted toggle name.
    text: 'Settings → General → Preferences → \\"Menstrual & contraception tracking.\\"',
    segments: ["General", "Preferences"],
  },
  {
    what: "App Lock",
    src: GUIDE,
    text: "App Lock (Settings → Security & Privacy → Privacy)",
    segments: ["Security & Privacy", "Privacy"],
  },
  {
    what: "the interactive tour replay point",
    src: readFileSync(path.join(ROOT, "src", "modules", "InteractiveTour.jsx"), "utf8"),
    text: "Replay this tour anytime from Settings → Guide",
    segments: ["Guide"],
  },
  {
    what: "Trash",
    src: GUIDE,
    text: "recoverable in Trash (under Insights)",
    segments: ["Insights", "Trash"],
  },
];

describe("Settings paths quoted in onboarding and Guide copy", () => {
  it("actually parses a realistic number of rows and sections (guards the scan)", () => {
    // If these collapse to near-zero the matchers have broken and every check
    // below is vacuously green - the exact failure mode this project has been
    // bitten by before (a DST test whose window contained no due day).
    expect(ROWS.size, "no Settings rows parsed - matcher is broken").toBeGreaterThan(10);
    expect(SECTIONS.size, "no Settings sections parsed - matcher is broken").toBeGreaterThan(3);
  });

  for (const p of PATHS) {
    it(`"${p.what}" points at rows/sections that exist`, () => {
      // The text must still be in the source, or the path was reworded and this
      // table needs updating - either way, a silent stale entry.
      expect(p.src, `"${p.text}" is no longer present - update PATHS in this test`).toContain(p.text);
      for (const seg of p.segments) {
        const ok = ROWS.has(seg) || SECTIONS.has(seg);
        expect(ok, `"${seg}" (from "${p.text}") is not a Settings row or section.\n  rows: ${[...ROWS].join(", ")}\n  sections: ${[...SECTIONS].join(", ")}`).toBe(true);
      }
    });
  }

  it("no longer contains the two paths that shipped wrong", () => {
    const all = withoutComments(APP) + withoutComments(GUIDE);
    expect(all, "onboarding still sends users to a 'Settings -> Design' screen that does not exist").not.toMatch(
      /Settings\s*→\s*Design\b/
    );
    expect(all, "'Storage' is a section WITHIN Developer tools, not a screen you can navigate into").not.toMatch(
      /Developer tools\s*→\s*Storage\b/
    );
  });

  it("the negative check can still fail (guards against the comment-stripping going too far)", () => {
    // If `withoutComments` were discarding everything, the assertion above
    // would pass no matter what the app said. This proves it still sees real
    // copy: feed it a known-good path and confirm it survives the filter.
    const probe = 'x = "Settings → Colour scheme lets you switch";\n// Settings → Design in a comment';
    expect(withoutComments(probe)).toContain("Colour scheme");
    expect(withoutComments(probe)).not.toContain("Design");
  });
});
