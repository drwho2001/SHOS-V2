// safetyShareGuard.test.js
//
// ADDED 14 Nov 2026 — the guard for BACKLOG 57–62, the Share-for-Safety
// cluster from the device audit. Like the other wiring guards, it asserts
// the STRUCTURE of the fix rather than behaviour the suite can't reach
// (the Android share sheet and the Geolocation prompt are both
// untestable here) — each structure is the thing whose silent regression
// produced the original bug.
//
//   57  the share goes through shareText()'s three-tier chain
//       (navigator.share → native Capacitor Share → clipboard), because
//       the audit device's WebView has no navigator.share and the old
//       code's clipboard fallback was silent;
//   58  the sheet registers on the overlay back stack, because back
//       previously did nothing while the sheet was open;
//   59  every ticked field produces a line ("not provided" when empty),
//       because the old buildMessage skipped empty fields and the sent
//       message was narrower than the ticked UI;
//   60  fields.photo is actually read into a Photo line;
//   61  the location tick embeds a captured Google Maps pin in the
//       message — the old code only window.open'ed Google Maps on the
//       SENDER's device after sharing, so the recipient got nothing;
//   62  the message is one editable textarea with a Reset, not a
//       read-only preview of generated parts.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SHEET = fs.readFileSync(
  path.join(process.cwd(), "src/modules/SHOS_Contacts_Prototype.jsx"),
  "utf8",
);
const HELPER = fs.readFileSync(
  path.join(process.cwd(), "src/storage/fileExportHelper.js"),
  "utf8",
);

// The SafetyShareSheet component's source, isolated from the rest of the
// (very large) Contacts module so guards can't be satisfied by unrelated
// code elsewhere in the file.
const sheetStart = SHEET.indexOf("function SafetyShareSheet(");
expect(sheetStart, "SafetyShareSheet not found").toBeGreaterThan(-1);
const sheetEnd = SHEET.indexOf("function ImportSharedProfileSheet(", sheetStart);
expect(sheetEnd, "SafetyShareSheet's end boundary not found").toBeGreaterThan(sheetStart);
const SHEET_SRC = SHEET.slice(sheetStart, sheetEnd);

const helperStart = HELPER.indexOf("export async function shareText(");
expect(helperStart, "shareText not found in fileExportHelper").toBeGreaterThan(-1);
const HELPER_SRC = HELPER.slice(helperStart, HELPER.indexOf("// ADDED — real ask: an editable save location", helperStart));

describe("BACKLOG 57 — the share reaches the native share sheet", () => {
  it("shareText tries navigator.share before the native plugin, and the clipboard last", () => {
    const navShare = HELPER_SRC.indexOf("navigator.share(");
    const capShare = HELPER_SRC.indexOf("Share.share(");
    const clipboard = HELPER_SRC.indexOf("navigator.clipboard.writeText");
    expect(navShare, "shareText lost the Web Share API path").toBeGreaterThan(-1);
    expect(capShare, "shareText lost the native Capacitor Share path").toBeGreaterThan(-1);
    expect(clipboard, "shareText lost the clipboard fallback").toBeGreaterThan(-1);
    expect(navShare, "navigator.share must be tried first").toBeLessThan(capShare);
    expect(capShare, "the native sheet must come before the clipboard").toBeLessThan(clipboard);
  });

  it("a user cancel is NOT silently turned into a clipboard copy", () => {
    // Backing out of the share sheet means "don't send" — falling through
    // to the clipboard after that would fill a clipboard nobody asked to
    // fill. Both the AbortError rethrow and the native-cancel rethrow
    // must exist.
    expect(HELPER_SRC).toMatch(/err\.name === "AbortError"\) throw err/);
    expect(HELPER_SRC).toMatch(/if \(\/cancel\/i\.test\(msg\)\) throw err/);
  });

  it("SafetyShareSheet sends through shareText, not its own navigator.share call", () => {
    expect(SHEET_SRC).toMatch(/await shareText\("Safety share"/);
    expect(SHEET_SRC, "SafetyShareSheet must not bypass shareText with its own navigator.share").not.toMatch(/navigator\.share/);
    expect(SHEET_SRC, "SafetyShareSheet must not silently clipboard on its own").not.toMatch(/clipboard\.writeText/);
  });

  it("the clipboard fallback is confirmed to the user, not silent", () => {
    expect(HELPER_SRC).toMatch(/Copied to clipboard — no share sheet was available/);
  });
});

describe("BACKLOG 58 — hardware back closes the sheet", () => {
  it("the sheet registers on the overlay back stack", () => {
    expect(SHEET_SRC).toMatch(/useOverlayBackHandler\(\(\) => \{ onClose\(\); return true; \}\)/);
  });
});

describe("BACKLOG 59 — ticked-but-empty fields are not silently dropped", () => {
  it("phone/address/vehicle render a 'not provided' line when the record is empty", () => {
    expect(SHEET_SRC).toMatch(/`Phone: \$\{contact\?\.phone \|\| "not provided"\}`/);
    expect(SHEET_SRC).toMatch(/`Address: \$\{contact\?\.address \|\| "not provided"\}`/);
    expect(SHEET_SRC).toMatch(/`Vehicle: \$\{contact\?\.vehicle \|\| "not provided"\}`/);
  });
});

describe("BACKLOG 60 — the profile photo note actually does something", () => {
  it("fields.photo produces a Photo line reflecting what's on record", () => {
    expect(SHEET_SRC).toMatch(/fields\.photo\) lines\.push\(`Photo: \$\{/);
  });
});

describe("BACKLOG 61 — the location tick reaches the recipient", () => {
  it("the pin is captured from geolocation when the box is ticked", () => {
    expect(SHEET_SRC).toMatch(/navigator\.geolocation\.getCurrentPosition/);
  });

  it("the captured pin goes INTO the message as a shareable maps link", () => {
    expect(SHEET_SRC).toMatch(/https:\/\/maps\.google\.com\/\?q=\$\{latitude\},\$\{longitude\}/);
    expect(SHEET_SRC).toMatch(/My location \(as of \$\{locationPin\.asOf\}\): \$\{locationPin\.url\}/);
  });

  it("the old sender-side window.open of Google Maps is gone", () => {
    expect(SHEET_SRC).not.toMatch(/window\.open\("https:\/\/www\.google\.com\/maps"/);
  });

  it("an unavailable fix is stated in the message, not silently omitted", () => {
    expect(SHEET_SRC).toMatch(/My location: unavailable/);
  });
});

describe("BACKLOG 62 — the message is editable before it is sent", () => {
  it("the preview is an editable textarea bound to the sent text", () => {
    expect(SHEET_SRC).toMatch(/<textarea value=\{message\}/);
    expect(SHEET_SRC).toMatch(/const message = editedMessage \?\? generatedMessage;/);
  });

  it("a Reset returns to the generated draft", () => {
    expect(SHEET_SRC).toMatch(/setEditedMessage\(null\)/);
  });
});
