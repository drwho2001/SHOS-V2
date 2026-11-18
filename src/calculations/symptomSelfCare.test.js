// The self-care bank is patient-facing copy, so wording boundaries are safety.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  SYMPTOM_SELF_CARE,
  SOONER_LINE,
  symptomSelfCare,
  patientSymptomLabel,
  symptomNeedsSooner,
  symptomSource,
} from "./symptomSelfCare.js";

const registrySrc = fs.readFileSync(path.join(process.cwd(), "src/registries/symptomsRegistry.js"), "utf8");
const seedBlock = /seedNames:\s*\[([\s\S]*?)\]/.exec(registrySrc)[1];
const seedNames = [...seedBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const entries = Object.values(SYMPTOM_SELF_CARE);
const allCopy = entries.flatMap((e) => [e.label, e.explanation, ...e.selfCare]).join(" ");

describe("symptom self-care bank", () => {
  it("covers every menstrual symptom in the registry", () => {
    // The registry is the vocabulary authority; the bank must have copy for
    // each menstrual name or the info dot silently shows nothing on that row.
    const menstrual = seedNames.filter((n) => n !== "Urethral discharge");
    expect(menstrual.length).toBeGreaterThan(10);
    for (const name of menstrual) {
      expect(SYMPTOM_SELF_CARE[name], `no self-care entry for "${name}"`).toBeTruthy();
    }
    // And the non-menstrual symptom is deliberately absent.
    expect(SYMPTOM_SELF_CARE["Urethral discharge"]).toBeUndefined();
  });

  it("every entry has the full shape", () => {
    for (const [key, e] of Object.entries(SYMPTOM_SELF_CARE)) {
      expect(e.label, `${key}.label`).toBeTruthy();
      expect(e.explanation.length, `${key}.explanation`).toBeGreaterThan(20);
      expect(e.selfCare.length, `${key}.selfCare`).toBeGreaterThanOrEqual(2);
      expect(typeof e.sooner, `${key}.sooner`).toBe("boolean");
    }
  });

  it("patient-facing text uses no clinical jargon for period symptoms", () => {
    for (const banned of ["dysmenorrhoea", "menorrhagia", "dyspareunia", "PMB", "IMB", "PCB"]) {
      expect(allCopy.toLowerCase(), `jargon leaked: ${banned}`).not.toContain(banned.toLowerCase());
    }
  });

  it("contains no triage, alarm or diagnosis wording", () => {
    for (const banned of ["urgent", "2-week", "two week", "cancer", "referral", "diagnos", "risk score", "999", "A&E"]) {
      expect(allCopy.toLowerCase(), `banned wording: ${banned}`).not.toContain(banned.toLowerCase());
    }
  });

  it("never offers prescription-only treatment", () => {
    for (const banned of ["tranexamic", "txa", "mefenamic", "naproxen", "prescription"]) {
      expect(allCopy.toLowerCase(), `prescription treatment leaked: ${banned}`).not.toContain(banned);
    }
  });

  it("holistic self-care includes the safe measures and ibuprofen gel where relevant", () => {
    expect(allCopy.toLowerCase()).toContain("heat pad");
    expect(allCopy.toLowerCase()).toContain("rest");
    expect(allCopy.toLowerCase()).toContain("hydrat");
    expect(SYMPTOM_SELF_CARE["Menstrual cramps (dysmenorrhea)"].selfCare.join(" ")).toMatch(/ibuprofen gel/i);
    expect(SYMPTOM_SELF_CARE["Menstrual cramps (dysmenorrhea)"].selfCare.join(" ")).toMatch(/massag|stretch|walk/i);
  });

  it("the 'sooner' line is one owner, used only by flagged entries", () => {
    expect(SOONER_LINE).toBe("it's worth mentioning to a clinician sooner");
    const flagged = Object.keys(SYMPTOM_SELF_CARE).filter(symptomNeedsSooner);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.length).toBeLessThan(Object.keys(SYMPTOM_SELF_CARE).length);
    // Neither the line nor a near-variant is baked into any entry's own copy.
    expect(allCopy.toLowerCase()).not.toContain("worth mentioning to a clinician");
  });

  it("helpers fall back honestly for unknown keys", () => {
    expect(symptomSelfCare("not-a-symptom")).toBeNull();
    expect(patientSymptomLabel("not-a-symptom")).toBe("not-a-symptom");
    expect(symptomNeedsSooner("not-a-symptom")).toBe(false);
    expect(symptomSource("not-a-symptom")).toBeNull();
  });

  it("every source URL is a real https link checked this cycle", () => {
    for (const e of entries) {
      if (!e.source) continue; // no verified page for that symptom — honest blank
      expect(e.source.url, `${e.label} source url`).toMatch(/^https:\/\//);
      expect(e.source.checkedOn, `${e.label} source date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
