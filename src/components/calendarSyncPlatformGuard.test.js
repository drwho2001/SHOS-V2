// PP1 — phone-calendar sync (@capacitor/calendar) has no web/PWA equivalent.
// A browser user must not be offered a sheet of toggles that all no-op. The
// platform-parity review deferred this pending reachability confirmation; the
// sync icon was confirmed reachable on web, so it is now gated on native.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const CAL = read("src/modules/settings/CalendarScreen.jsx");

describe("calendar sync platform gating (PP1)", () => {
  it("detects native platform the same safe way fileExportHelper does", () => {
    expect(CAL).toMatch(/import\("@capacitor\/core"\)/);
    expect(CAL).toMatch(/Capacitor\.isNativePlatform\(\)/);
    // Safe on web: the dynamic import is wrapped so a failed import is false.
    expect(CAL).toMatch(/catch \{\s*return false;/);
  });

  it("only renders the sync icon when native", () => {
    const icon = CAL.slice(CAL.indexOf("{isNative && ("), CAL.indexOf("{isNative && (") + 700);
    expect(icon).toMatch(/setShowSyncSheet\(true\)/);
    expect(CAL).not.toMatch(/<CloudArrowUp[^]*?setShowSyncSheet\(true\)[^]*?<\/div>\s*<span[^]*?Filter/s);
  });

  it("keeps an enabled setting visible read-only on web, never silently vanishing", () => {
    expect(CAL).toMatch(/!isNative && syncEnabled/);
    expect(CAL).toMatch(/calendar\.syncWebNote/);
  });

  it("guards the sheet mount too, so a stale flag cannot open a dead sheet", () => {
    expect(CAL).toMatch(/showSyncSheet && isNative && <CalendarSyncSheet/);
  });

  it("the web note exists in both locales", () => {
    for (const loc of ["en", "en-US"]) {
      const json = JSON.parse(read(`src/i18n/${loc}.json`));
      expect(json.calendar.syncWebNote, `${loc} missing calendar.syncWebNote`).toBeTruthy();
    }
  });
});
