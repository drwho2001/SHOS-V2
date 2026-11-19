// doxyPepBannerLogDoseGuard.test.js — 19 Nov 2026 owner request: the DoxyPEP
// window-countdown banner at the top of Home showed the timer but its only
// action was navigating to the medication record. It now offers a direct
// "Log dose" button that reuses the SAME locked-out-aware write as the
// "Take DoxyPEP now" quick-add (no new write path), and can never be a no-op
// because it only renders when a DoxyPEP medication actually exists.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const read = (f) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("DoxyPEP banner log-dose button", () => {
  const home = read("src/modules/SHOS_Home_Prototype.jsx");

  it("renders a real, labelled button that stops propagation", () => {
    expect(home).toMatch(/aria-label="Log a DoxyPEP dose"/);
    expect(home).toMatch(/onClick=\{\(e\) => \{ e\.stopPropagation\(\); logMedicationDose\(doxyMed\); \}\}/);
    expect(home).toMatch(/onKeyDown=\{\(e\) => \{ e\.stopPropagation\(\); \}\}/);
  });

  it("reuses the existing quick-add write rather than a new LogRepository.create", () => {
    expect(home).toMatch(/const logMedicationDose = async \(med\) => \{/);
    // The banner itself must not write — it only calls the shared helper.
    const banner = home.slice(home.indexOf("doxyBannerVisible &&"), home.lastIndexOf("status at a glance"));
    expect(banner).not.toMatch(/LogRepository\.create/);
    expect(banner).toMatch(/logMedicationDose\(doxyMed\)/);
  });

  it("only appears when a DoxyPEP medication exists (never a no-op)", () => {
    const banner = home.slice(home.indexOf("doxyBannerVisible &&"), home.lastIndexOf("status at a glance"));
    expect(banner).toMatch(/\{doxyMed && \(/);
  });

  it("keeps the existing Dismiss and 'Don't warn me' controls", () => {
    const banner = home.slice(home.indexOf("doxyBannerVisible &&"), home.lastIndexOf("status at a glance"));
    expect(banner).toMatch(/Don't warn me about this exposure again/);
    expect(banner).toMatch(/aria-label="Dismiss DoxyPEP banner"/);
  });
});
