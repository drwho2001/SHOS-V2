// platformParityGuard.test.js — PP2/PP3. The code already gates native-only
// controls on web and falls back from share to a real browser download; this
// guard keeps those decisions from silently regressing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("platform parity", () => {
  it("PP2: the screenshots toggle is only rendered where it can work", () => {
    const src = read("src/modules/settings/PrivacyScreen.jsx");
    expect(src).toMatch(/isScreenSecurityAvailable\(\)/);
    expect(src).toMatch(/screenshotsToggleAvailable && \(/);
    expect(src).toMatch(/data-tour="screenshots-toggle"/);
  });

  it("PP3: export falls back from web share to native share to browser download", () => {
    const src = read("src/storage/fileExportHelper.js");
    expect(src).toMatch(/navigator\.share/);
    expect(src).toMatch(/downloadInBrowser\(filename, contents, mimeType\)/);
    expect(src).toMatch(/!Capacitor\.isNativePlatform\(\)\) return false/);
    expect(src).toMatch(/isChooseFolderExportAvailable/);
  });
});
