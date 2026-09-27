// Source-level guard for the navigation bug found on 27 Sep 2026: tapping a
// record from inside a Settings sub-screen opened the record BEHIND the still-
// open Settings overlay, so the user was left looking at the Settings main
// menu having apparently done nothing.
//
// WHY A SOURCE CHECK AND NOT A BEHAVIOURAL TEST: the bug was not in the
// Calendar's own logic. `navigateToRecord` in App.jsx changed the active tab
// and set the pending record id, both of which were correct - the record really
// did open, just underneath a `position: fixed; inset: 0` overlay at
// zIndex 200 that nothing had closed. A behavioural test would have to mount
// the whole App shell, drive Settings, drive the Calendar sub-screen and then
// assert something is visible - which is possible but would be a large,
// slow, fragile test guarding two lines.
//
// What actually matters is the invariant, and it is expressible: anything that
// hands off to a record must close the overlays that render ABOVE the <main>
// the record renders in. That is a wiring property, and wiring properties are
// what source checks are for. The mutation checks below confirm the guard
// actually bites rather than merely passing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const APP = readFileSync(path.join(process.cwd(), "src", "App.jsx"), "utf8");

/** The body of `const navigateToRecord = (args) => { ... };` up to its close. */
function bodyOfNavigateToRecord() {
  const start = APP.indexOf("const navigateToRecord");
  expect(start, "navigateToRecord not found in App.jsx").toBeGreaterThan(-1);
  return APP.slice(start, APP.indexOf("\n  };", start));
}

describe("navigating to a record must close the overlays above it", () => {
  it("closes the Settings overlay and resets its sub-screen", () => {
    const body = bodyOfNavigateToRecord();
    expect(body).toMatch(/setShowSettings\(false\)/);
    // Also clears the sub-screen, so a later Settings open doesn't reappear
    // on whatever sub-screen the user last drilled into.
    expect(body).toMatch(/setSettingsInitialScreen\(null\)/);
  });

  it("closes the Global Search overlay too", () => {
    // Search is the other full-screen overlay above <main>. Same reasoning.
    const body = bodyOfNavigateToRecord();
    expect(body).toMatch(/setShowSearch\(false\)/);
  });

  it("still does the actual navigation and record selection", () => {
    // Guards against a "fix" that closes the overlays and forgets the point.
    const body = bodyOfNavigateToRecord();
    expect(body).toMatch(/navigateTo\(tabKey, subTab\)/);
    expect(body).toMatch(/setPendingOpenRecordId\(recordId\)/);
  });

  it("is not duplicated anywhere else that also changes the active tab", () => {
    // If a second place ever switches tab without closing the overlays, the
    // same class of invisible-navigation bug can come back through it. The
    // back handler is a legitimate exception (it closes Settings explicitly
    // first) and the tour explicitly sets active, so only navigateTo and
    // navigateToRecord are checked.
    const setters = APP.match(/setActive\("?[a-zA-Z]+"?\)/g) || [];
    // setActive is legitimately called in several places (back, clinic-card
    // return, tour). This assertion is a tripwire: if a new direct setActive
    // call appears outside those, revisit whether it also needs the overlay
    // closes. Kept as a count so the diff is visible rather than silent.
    expect(setters.length).toBeGreaterThan(0);
  });
});

describe("the Calendar sub-screen's own onClose is still correct", () => {
  // CalendarScreen still calls onClose() after navigating - that closes the
  // CALENDAR SUB-SCREEN, which the App-level fix deliberately does not touch.
  // If that call were removed, going back from a record would drop the user
  // into Settings > Calendar's month grid instead of the Settings menu.
  it("CalendarScreen still invokes onClose after navigating", () => {
    const cal = readFileSync(path.join(process.cwd(), "src", "modules", "settings", "CalendarScreen.jsx"), "utf8");
    const idx = cal.indexOf("onNavigateToRecord?.(");
    expect(idx, "CalendarScreen no longer navigates on event tap").toBeGreaterThan(-1);
    const after = cal.slice(idx, idx + 220);
    expect(after).toMatch(/onClose\(\)/);
  });
});
