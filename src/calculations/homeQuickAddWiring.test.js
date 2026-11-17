// homeQuickAddWiring.test.js — source-level guard for the 17 Nov 2026 Home
// quick-add rework. Decision tests for the lockout rule live in
// homeQuickAddEligibility.test.js; this proves the screen actually USES them
// (Home previously wrote doses with no lockout check and set a flash it never
// rendered), plus the tour's X-closes-in-place behaviour.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const HOME = codeOnly(read("src/modules/SHOS_Home_Prototype.jsx"));
const APP = codeOnly(read("src/App.jsx"));
const TOUR = codeOnly(read("src/modules/InteractiveTour.jsx"));

describe("Home quick-add ordering and labels", () => {
  it("removes the old 'Log dose' navigation shortcut", () => {
    expect(HOME).not.toMatch(/label="Log dose"/);
    expect(HOME).not.toMatch(/onNavigateToRecord\("medication", null\)/);
  });

  it("orders encounters, contacts, medications, healthcare", () => {
    const at = (s) => {
      const i = HOME.indexOf(s);
      expect(i, `missing ${s}`).toBeGreaterThan(-1);
      return i;
    };
    expect(at('label="New encounter"')).toBeLessThan(at('label="New session"'));
    expect(at('label="New session"')).toBeLessThan(at('label="New contact"'));
    expect(at('label="New contact"')).toBeLessThan(at('tr("home.medications", "Medications")'));
    expect(at('tr("home.medications", "Medications")')).toBeLessThan(at('label="Take DoxyPEP now"'));
    expect(at('label="Take DoxyPEP now"')).toBeLessThan(at('label="Take PrEP now"'));
    expect(at('label="Take PrEP now"')).toBeLessThan(at('label="Log all due routine meds"'));
    expect(at('label="Log all due routine meds"')).toBeLessThan(at('tr("home.healthcare", "Healthcare")'));
  });
});

describe("Home medication shortcuts use the shared rules and give feedback", () => {
  it("asks the shared lockout helper before writing a PrEP/DoxyPEP dose", () => {
    expect(HOME).toMatch(/isQuickActionLocked\(med, logs\)/);
    expect(HOME).toMatch(/quickActionLockoutMessage\(med, logs\)/);
    expect(HOME).toMatch(/dueRoutineMedications\(allMeds, logsByMed\)/);
  });

  it("ghosts locked-out and nothing-due buttons", () => {
    expect(HOME).toMatch(/muted=\{doxyLocked\}/);
    expect(HOME).toMatch(/muted=\{prepLocked\}/);
    expect(HOME).toMatch(/muted=\{routineDueCount === 0\}/);
    expect(HOME).toMatch(/opacity: muted \? 0\.55 : 1/);
  });

  it("actually renders the flash it sets, as a live status", () => {
    expect(HOME).toMatch(/showDoseFlash\(/);
    expect(HOME).toMatch(/role="status" aria-live="polite"/);
    expect(HOME).toMatch(/\{doseFlash\.message\}/);
  });
});

describe("closing the tour leaves the screen it was explaining", () => {
  it("X, Escape and hardware back all report 'skipped'", () => {
    expect(TOUR).toMatch(/onDone\("skipped"\)/);
    expect((TOUR.match(/onDone\?\.\("skipped"\)/g) || []).length).toBe(2);
  });

  it("App only resets navigation on a genuine finish", () => {
    expect(APP).toMatch(/const finishTour = async \(reason\)/);
    expect(APP).toMatch(/if \(reason !== "skipped"\)/);
    expect(APP).toMatch(/setShowTour\(false\)/);
  });
});
