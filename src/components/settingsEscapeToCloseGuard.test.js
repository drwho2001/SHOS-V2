// settingsEscapeToCloseGuard.test.js — AX2, 25 Nov 2026.
//
// 20 Nov inventory: 25 settings screens render role="dialog", only six had
// Escape-to-close. This guard is deliberately INCREMENTAL: it locks the 11
// screens that are now covered and states the remaining ones rather than
// pretending a blanket sweep is safe. Several of the rest have layered
// confirm dialogs whose Escape semantics need per-screen thought.
//
// The shared hook owns topmost-only handling and unmount cleanup, so one
// screen cannot steal Escape from a confirm stacked above it.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SETTINGS = path.join(process.cwd(), "src/modules/settings");
const read = (file) => fs.readFileSync(path.join(SETTINGS, file), "utf8");

const WITH_HOOK = [
  "CalendarScreen.jsx",
  "ErrorLogScreen.jsx",
  "NotificationHistoryScreen.jsx",
  "PrivacyScreen.jsx",
  // AX2 25 Nov, first scoped chunk: read-only / non-destructive screens.
  "AboutScreen.jsx",
  "GlossaryScreen.jsx",
  "ResourcesScreen.jsx",
  "ClinicalEvidenceScreen.jsx",
  "DataNetworkScreen.jsx",
  // AX2 25 Nov, second chunk: no destructive confirm state in these screens.
  "AutomaticBackupsScreen.jsx",
  "DesignScreen.jsx",
  "GuideScreen.jsx",
  "LocationsScreen.jsx",
  "ManageListsScreen.jsx",
  "PreferencesScreen.jsx",
  "ShareScreen.jsx",
  "WidgetsScreen.jsx",
];
const INLINE_ESCAPE = [
  "EncountersSettingsScreen.jsx",
  "HealthcareSettingsScreen.jsx",
];
// The five added in this chunk have no layered confirm, so they pass onClose
// directly. ErrorLog/NotificationHistory pass a ternary that closes a
// confirmation first - that is why their call cannot be asserted the same way.
const NEW_HOOK = [
  "AboutScreen.jsx",
  "GlossaryScreen.jsx",
  "ResourcesScreen.jsx",
  "ClinicalEvidenceScreen.jsx",
  "DataNetworkScreen.jsx",
  // AX2 25 Nov, second chunk: no destructive confirm state in these screens.
  "AutomaticBackupsScreen.jsx",
  "DesignScreen.jsx",
  "GuideScreen.jsx",
  "LocationsScreen.jsx",
  "ManageListsScreen.jsx",
  "PreferencesScreen.jsx",
  "ShareScreen.jsx",
  "WidgetsScreen.jsx",
];

describe("AX2 settings dialogs close with Escape", () => {
  it("every covered screen imports and calls the shared hook", () => {
    for (const file of WITH_HOOK) {
      const src = read(file);
      expect(src, `${file} must import useEscapeToClose`)
        .toMatch(/import \{ useEscapeToClose \} from "\.\.\/\.\.\/components\/useEscapeToClose"/);
      expect(src, `${file} must call the hook`).toMatch(/useEscapeToClose\(/);
    }
    for (const file of NEW_HOOK) {
      expect(read(file), `${file} must close itself, not another dialog`)
        .toMatch(/useEscapeToClose\(onClose\);/);
    }
  });

  it("the two module settings screens already handle Escape inline", () => {
    for (const file of INLINE_ESCAPE) {
      expect(read(file), `${file} lost its inline Escape handler`)
        .toMatch(/e\.key === "Escape"/);
    }
  });

  it("anti-vacuity: the settings tree still has the dialogs this guard is about", () => {
    const dialogs = fs.readdirSync(SETTINGS)
      .filter((f) => f.endsWith(".jsx") && read(f).includes('role="dialog"'));
    expect(dialogs.length).toBeGreaterThanOrEqual(25);
    expect(WITH_HOOK.length + INLINE_ESCAPE.length).toBe(19);
  });

  it("the hook closes only the topmost dialog", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/useEscapeToClose.js"), "utf8");
    expect(src).toMatch(/closeStack\[closeStack\.length - 1\]/);
    expect(src).toMatch(/e\.defaultPrevented/);
    expect(src).toMatch(/removeEventListener\("keydown"/);
  });
});
