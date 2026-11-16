// tourContentGuard.test.js — decision + wiring guard for the 16 Nov 2026
// guide changes: a demo card for the otherwise-empty live-session step, two
// settings steps (screenshots, cycles/contraception), and honest About copy.
// The tour used to spotlight empty space and claim About held privacy info;
// both were found on a real device, so the rules are asserted here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TOUR_STEPS } from "../modules/InteractiveTour";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

const step = (id) => TOUR_STEPS.find((s) => s.id === id);

describe("interactive tour content", () => {
  it("marks the live-session step as needing a demo card", () => {
    const live = step("live-session");
    expect(live).toBeTruthy();
    expect(live.demoSession).toBe(true);
    expect(live.target).toBe("live-session");
    expect(live.body).toMatch(/example/i);
  });

  it("re-measures the demo card after App renders it", () => {
    // A spotlight measured before the demo card exists dims the whole
    // screen with no outline — exactly the defect this step was fixing.
    const src = read("src/modules/InteractiveTour.jsx");
    expect(src).toMatch(/if \(step\.demoSession\)/);
    expect(src).toMatch(/setTimeout\(\(\) => recalc\(\), 300\)/);
  });

  it("opens the two settings sub-screens it explains", () => {
    const screenshots = step("screenshots-toggle");
    const cycle = step("cycle-toggle");
    expect(screenshots).toBeTruthy();
    expect(screenshots.settingsScreen).toBe("privacy");
    expect(screenshots.target).toBe("screenshots-toggle");
    expect(screenshots.body).toMatch(/Security & Privacy → Privacy/);
    expect(cycle).toBeTruthy();
    expect(cycle.settingsScreen).toBe("preferences");
    expect(cycle.target).toBe("cycle-toggle");
    expect(cycle.body).toMatch(/General → Preferences/);
    // Both are opt-in: the copy must say they are off/on by default honestly.
    expect(cycle.body).toMatch(/Off by default/);
    expect(screenshots.body).toMatch(/On by default/);
  });

  it("no longer claims About holds privacy info", () => {
    expect(step("settings-about").body).not.toMatch(/privacy info/);
  });

  it("the closing step still points at the real replay path", () => {
    expect(step("closing").body).toMatch(/Settings → Guide/);
  });
});

describe("tour wiring reaches the real anchors", () => {
  it("Home renders a labelled demo card only when the tour asks for one", () => {
    const home = read("src/modules/SHOS_Home_Prototype.jsx");
    expect(home).toMatch(/demoSession/);
    expect(home).toMatch(/!activeSession && demoSession/);
    expect(home).toMatch(/data-tour="live-session"/);
    expect(home).toMatch(/Example only · Live session/);
  });

  it("App publishes the step and passes it to Home and the tour", () => {
    const app = read("src/App.jsx");
    expect(app).toMatch(/onStepChange=\{setTourStep\}/);
    expect(app).toMatch(/demoSession=\{tourStep\?\.demoSession === true\}/);
    expect(app).toMatch(/onOpenSettings=\{\(screen\) =>/);
    // SettingsScreen must remount per sub-screen: initialScreen is a useState
    // initialiser, so changing it without a key keeps the old screen open.
    expect(app).toMatch(/key=\{settingsInitialScreen \|\| "settings"\}/);
  });

  it("both settings rows carry the spotlight anchors", () => {
    expect(read("src/modules/settings/PrivacyScreen.jsx")).toMatch(/data-tour="screenshots-toggle"/);
    expect(read("src/modules/settings/PreferencesScreen.jsx")).toMatch(/data-tour="cycle-toggle"/);
  });

  it("SettingsScreen honours every sub-screen the tour opens directly", () => {
    // initialScreen is a useState initialiser only, so a missing branch
    // silently leaves the tour on the Settings root (found on device).
    const settings = read("src/modules/SHOS_Settings_Prototype.jsx");
    expect(settings).toMatch(/useState\(initialScreen === "privacy"\)/);
    expect(settings).toMatch(/useState\(initialScreen === "preferences"\)/);
    expect(settings).toMatch(/useState\(initialScreen === "about"\)/);
  });
});
