// F3 — neutral post-menopause spotting prompt. Copy boundaries are safety.
import { describe, it, expect } from "vitest";
import { menopauseSpottingPrompt } from "./menopauseSpottingPrompt.js";

const base = {
  menopauseStatus: "Post-menopause",
  menopauseConfirmedAt: "2026-01-01",
  symptomLogs: [],
  cycles: [],
  symptomNameById: new Map(),
};

describe("menopause spotting prompt", () => {
  it("stays silent unless status is Post-menopause", () => {
    expect(menopauseSpottingPrompt({ ...base, menopauseStatus: "Peri-menopause", symptomLogs: [{ title: "Spotting", dateStarted: "2026-02-01" }] })).toBeNull();
  });

  it("stays silent with no bleeding/spotting record", () => {
    expect(menopauseSpottingPrompt({ ...base, symptomLogs: [{ title: "Headache", dateStarted: "2026-02-01" }] })).toBeNull();
  });

  it("fires for a bleeding symptom and uses the approved 12-month wording", () => {
    const p = menopauseSpottingPrompt({ ...base, symptomLogs: [{ title: "Spotting", dateStarted: "2026-02-01", symptomIds: [] }] });
    expect(p).not.toBeNull();
    expect(p.text).toMatch(/more than 12 months after your periods stopped/);
    expect(p.text).toMatch(/not using hormonal contraception/);
    expect(p.text).toMatch(/consider mentioning it to a doctor or nurse/);
  });

  it("resolves symptom names through the registry", () => {
    const names = new Map([["s1", "Spotting between periods"]]);
    const p = menopauseSpottingPrompt({ ...base, symptomLogs: [{ title: "Symptom", dateStarted: "2026-02-01", symptomIds: ["s1"] }], symptomNameById: names });
    expect(p).not.toBeNull();
  });

  it("also fires for a cycle spotting record", () => {
    const p = menopauseSpottingPrompt({ ...base, cycles: [{ spotting: true, spottingDate: "2026-03-01", startDate: "2026-03-01" }] });
    expect(p).not.toBeNull();
  });

  it("appends the precise HRT qualifier when HRT is active", () => {
    const p = menopauseSpottingPrompt({ ...base, activeHrt: true, symptomLogs: [{ title: "Bleeding", dateStarted: "2026-02-01" }] });
    expect(p.hrtText).toMatch(/first 6 months of starting/);
    expect(p.hrtText).toMatch(/3 months of changing/);
  });

  it("switches to clinician-only wording with GAHT recorded", () => {
    const p = menopauseSpottingPrompt({ ...base, gender: "Trans woman", activeHrt: true, symptomLogs: [{ title: "Bleeding", dateStarted: "2026-02-01" }] });
    expect(p.clinicianOnly).toBe(true);
    expect(p.text).not.toMatch(/12 months/);
    expect(p.text).toMatch(/clinician who manages your care/);
    expect(p.hrtText).toBeNull();
  });

  it("contains no referral / triage / cancer wording", () => {
    const p = menopauseSpottingPrompt({ ...base, activeHrt: true, symptomLogs: [{ title: "Bleeding", dateStarted: "2026-02-01" }] });
    const all = `${p.text} ${p.hrtText || ""}`;
    for (const banned of ["urgent", "2-week", "two week", "cancer", "referral", "diagnos"]) {
      expect(all.toLowerCase()).not.toContain(banned);
    }
  });
});
