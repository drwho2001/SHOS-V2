import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * t129: every NESTED overlay must be in the back chain, and must be
 * dismissible with Escape.
 *
 * WHY AN INVENTORY, and why the list is hand-written. The app's module
 * back-handler is ONE slot, so a screen that opens a screen - a dialog
 * inside a dialog - has nowhere to say "back should close ME, not the one
 * underneath". Twelve places had that problem, and they failed in three
 * different ways:
 *
 *   - the back button closed the screen UNDER the dialog, leaving the
 *     dialog on screen with nothing beneath it (Testing's "Scheduled retest
 *     already done" prompt - the smoke suite hit this for real);
 *   - the back button did nothing at all (the Interactive Tour was a trap:
 *     only its X worked);
 *   - or the back button fell through to HOME, abandoning the tab
 *     (Measurements' "Manage groups").
 *
 * A file-level rule would be wrong, and this file's existence is why it can
 * say so: most of the app's full-screen screens are TOP-LEVEL, and they use
 * the module slot (registerModuleBackHandler) or - for the Settings
 * sub-screens - Settings' own single chain, on purpose. Only an overlay that
 * sits ON TOP of another screen needs the stack.
 *
 * So the list is the overlays that sit on top of another screen, and each
 * one is asserted to be in the chain. A site cannot be quietly dropped from
 * the list (the count is exact) and a new one has to be added deliberately,
 * with its reason.
 */
const NESTED_OVERLAYS = [
  {
    file: "src/modules/SHOS_Testing_Prototype.jsx",
    what: "the 'Scheduled retest already done' prompt",
    why: "the worst case in the app: back closed the DETAIL screen underneath it and left the prompt on screen with nothing beneath it",
  },
  {
    file: "src/modules/SHOS_Measurements_Prototype.jsx",
    what: "the measurement preferences sheet and the manage-groups screen inside it",
    why: "back fell through to the module's handler, which knew nothing about them, and abandoned the whole Healthcare tab",
  },
  {
    file: "src/modules/SHOS_Contacts_Prototype.jsx",
    what: "the 'Possible duplicates' panel",
    why: "rendered inside the contacts list, whose back handler knew nothing about it",
  },
  {
    file: "src/modules/SHOS_RegistryManagement_Prototype.jsx",
    what: "the registry management screen and the duplicates panel inside it",
    why: "back closed the whole Manage-lists screen, skipping a level",
  },
  {
    file: "src/modules/SHOS_OptionListEditor_Prototype.jsx",
    what: "the option list detail screen",
    why: "it closed on Escape but not on back, so the two ways out of one screen behaved differently",
  },
  {
    file: "src/modules/settings/ErrorLogScreen.jsx",
    what: "the error log",
    why: "nested inside Developer Tools, and in neither chain: back closed Developer Tools, skipping a level",
  },
  {
    file: "src/modules/settings/NotificationHistoryScreen.jsx",
    what: "the notification history",
    why: "nested inside Notifications, and in neither chain",
  },
  {
    file: "src/modules/settings/CalendarScreen.jsx",
    what: "the phone calendar sync sheet",
    why: "it closed on Escape but not on back",
  },
  {
    file: "src/modules/InteractiveTour.jsx",
    what: "the interactive tour",
    why: "a trap: only its X and its Next/Skip buttons could end it, and on Home there is no module handler for back to consult",
  },
  {
    file: "src/App.jsx",
    what: "the App Lock prompt, the acknowledge sheet and the encrypted-backup prompt",
    why: "app-level overlays that back did not close: the tab underneath changed and the overlay stayed up",
  },
];

describe("every nested overlay is in the back chain", () => {
  it("the inventory is not empty, and every file it names exists", () => {
    expect(NESTED_OVERLAYS.length).toBeGreaterThan(0);
    for (const entry of NESTED_OVERLAYS) {
      expect(existsSync(path.join(process.cwd(), entry.file)), `${entry.file} does not exist`).toBe(true);
      expect(entry.why.length, `${entry.file} needs a reason`).toBeGreaterThan(20);
    }
  });

  it("each one registers a handler on the nested-overlay stack", () => {
    for (const entry of NESTED_OVERLAYS) {
      const code = readFileSync(path.join(process.cwd(), entry.file), "utf8");
      // A CALL, not the name. The first version of this asserted the file
      // CONTAINED "useOverlayBackHandler" - and the IMPORT line contains that
      // name too, so removing the call left the assertion green. A mutation
      // that unwired the Testing prompt entirely survived it.
      expect(
        code,
        `${entry.file} (${entry.what}) is not in the back chain - it needs a useOverlayBackHandler(...) call`,
      ).toMatch(/useOverlayBackHandler\s*\(/);
    }
  });

  it("each one is dismissible with Escape as well", () => {
    // Escape is the keyboard's way out of an overlay, and the repo's own
    // escapeMountAudit notes that a dialog which cannot be closed with
    // Escape is invisible to a keyboard user.
    //
    // A CALL, for the same reason as above: the import alone proves nothing.
    for (const entry of NESTED_OVERLAYS) {
      const code = readFileSync(path.join(process.cwd(), entry.file), "utf8");
      expect(
        code,
        `${entry.file} (${entry.what}) cannot be closed with Escape`,
      ).toMatch(/useEscapeToClose\s*\(/);
    }
  });

  it("the app asks the stack BEFORE anything else, so an overlay closes before the screen under it", () => {
    const app = readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
    const stackCall = app.indexOf("handleOverlayBack()");
    const moduleCall = app.indexOf("moduleBackHandlerRef.current && moduleBackHandlerRef.current()");
    expect(stackCall, "App.jsx does not consult the nested-overlay stack at all").toBeGreaterThan(-1);
    expect(moduleCall, "App.jsx no longer consults the module handler").toBeGreaterThan(-1);
    expect(
      stackCall,
      "the nested-overlay stack must be consulted BEFORE the module's own handler, or an overlay " +
        "sitting on a screen closes the screen under it - which is the bug this whole mechanism exists to fix",
    ).toBeLessThan(moduleCall);
  });
});
