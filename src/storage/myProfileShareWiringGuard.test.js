// myProfileShareWiringGuard.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 128's fix, written for the same
// reason the widget guards exist: the end-to-end behaviour ("tap the share
// icon, the Android share sheet opens") cannot be exercised in this suite,
// so the guard asserts the CHAIN instead — every link between the tap and
// the platform API, verified by reading the code that ships. A broken link
// (the icon's onClick deleted, the panel unmounted, exportProfileShare
// bypassed for a raw <a download>) fails here even though nothing else
// would notice.
//
// WHY THIS SHAPE. The original device bug was "tapping the share button
// does absolutely nothing": the icon rendered, the tap landed, and no
// handler was reachable — silent because every unit test only checked the
// pieces in isolation. This file checks the CONNECTIONS.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MODULE = fs.readFileSync(
  path.join(process.cwd(), "src/modules/SHOS_MyProfile_Prototype.jsx"),
  "utf8",
);
const SERVICE = fs.readFileSync(
  path.join(process.cwd(), "src/storage/profileShareService.js"),
  "utf8",
);
const HELPER = fs.readFileSync(
  path.join(process.cwd(), "src/storage/fileExportHelper.js"),
  "utf8",
);

describe("the Share My Profile tap reaches the platform share sheet", () => {
  it("the header share icon toggles the panel", () => {
    // The icon's onClick must drive showShare — the exact regression that
    // shipped as "button does nothing" was an icon with no reachable
    // handler.
    expect(MODULE, "share icon has no onClick handler").toMatch(
      /onClick=\{\(\) => setShowShare\(\(s\) => !s\)\}/,
    );
  });

  it("the panel is rendered when showShare is true", () => {
    expect(MODULE, "ShareProfilePanel is never rendered — the icon toggles nothing visible").toMatch(
      /\{showShare && <ShareProfilePanel/,
    );
  });

  it("the panel's Save-as-file path goes through exportProfileShare", () => {
    expect(MODULE, "panel does not call exportProfileShare").toMatch(/await exportProfileShare\(shareOptions\)/);
  });

  it("exportProfileShare writes a real share blob, not an <a download>", () => {
    // The original silent no-op on Android WebView was a blob+<a download>.
    // The fix routes through exportTextFile; assert the service never grew
    // a second, bypassing export path.
    expect(SERVICE, "exportProfileShare must delegate to exportTextFile").toMatch(
      /await exportTextFile\(/,
    );
    expect(SERVICE, "a plain <a download> export reappeared in profileShareService").not.toMatch(
      /document\.createElement\(["']a["']\)/,
    );
  });

  it("exportTextFile offers navigator.share before any fallback", () => {
    // Order matters: navigator.share is what actually opens the Android
    // share sheet from the WebView. The native Capacitor Share and browser
    // download are fallbacks BELOW it.
    const navShare = HELPER.indexOf("navigator.share");
    const capShare = HELPER.indexOf("await Share.share");
    const browser = HELPER.indexOf("function downloadInBrowser");
    expect(navShare, "fileExportHelper lost navigator.share").toBeGreaterThan(-1);
    expect(capShare, "fileExportHelper lost the native Share fallback").toBeGreaterThan(-1);
    expect(navShare, "navigator.share must come before the Capacitor fallback").toBeLessThan(capShare);
  });

  it("the panel exposes both a file path and a copy path", () => {
    // Copy-as-text is the fallback the status message itself recommends
    // ("try Copy as text instead") — if the file path fails on some device,
    // this is the way out. It must exist.
    expect(MODULE, "panel lost the Copy-as-text action").toMatch(/setConfirming\("text"\)/);
    expect(MODULE, "panel lost the Save-as-file action").toMatch(/setConfirming\("file"\)/);
  });
});
