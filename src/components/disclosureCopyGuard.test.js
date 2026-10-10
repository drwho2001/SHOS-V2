// PrivacyScreen must not claim the disclosure level governs widgets when it
// deliberately does not.
//
// WHY THIS EXISTS (t043). The disclosure level (detailed/glanceable/masked)
// controls the TEXT of notifications on surfaces outside the app. Home-screen
// widgets are governed by a SEPARATE, finer control: a per-widget privacy tier
// (full/redacted/off) in Settings -> Widgets, defined in widgetPrivacy.js and
// user-settable per widget. That split is deliberate and is already stated in
// the duress-mode copy in this same file ("Home-screen widgets are separate
// from the app ... allowed by each widget's privacy setting. Set sensitive
// widgets to Redacted or Off in Settings -> Widgets").
//
// The disclosure-level copy said "your notifications and home-screen widgets",
// which promised widget coverage the app does not provide. Two copies in one
// file contradicted each other, and a user reading only the first would set a
// level believing it protected their home screen. It did not.
//
// This guard keeps the two settings' copy from drifting apart again. It
// asserts the PROSE, because the defect was prose - no test imports this
// screen's rendered text, and a behaviour test here would need the whole React
// tree to mount for a string comparison.
//
// It is deliberately narrow: it asserts the specific false claim is gone and
// that the copy points at the real control. It does NOT assert the tier system
// works - widgetPrivacy.test.js and widgetRedactedRender.test.js do that.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src", "modules", "settings", "PrivacyScreen.jsx");
const src = readFileSync(SRC, "utf8");

describe("PrivacyScreen disclosure-level copy", () => {
  it("the disclosure-level blurb does NOT claim it covers home-screen widgets", () => {
    // The exact sentence that was wrong. Asserted as a whole phrase so a
    // rewrite that keeps the false promise still trips it.
    expect(src).not.toMatch(/notifications and home-screen widgets say/i);
  });

  it("points the reader at Settings -> Widgets for widget detail", () => {
    // The replacement must not merely REMOVE the claim; it must answer the
    // question the removed sentence was answering, or the user is left with no
    // idea where widget privacy lives.
    expect(src).toMatch(/home-screen widgets are NOT covered by this setting/i);
    expect(src).toMatch(/own privacy tier in Settings . Widgets/i);
  });

  it("the source comment above the control no longer says it acts on the home screen", () => {
    // The comment is load-bearing for the next session editing this file, and
    // it made the same false claim. Asserted separately because a reader can
    // act on the comment without ever seeing the rendered blurb.
    expect(src).not.toMatch(/persistent and acts on the lock screen and the home screen/i);
  });

  it("still states the duress-mode split, which is the honest version", () => {
    // Guards against "fixing" t043 by deleting the correct explanation at the
    // bottom of the file instead of reconciling it with the top.
    expect(src).toMatch(/allowed by each widget.s privacy setting/i);
  });
});