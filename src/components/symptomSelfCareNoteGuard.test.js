// The self-care note is patient-facing copy at the point of use. Guard that
// the words stay in one keyed bank, the note follows the touch disclosure
// pattern, and every symptom's Resources link is a real verified URL.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const NOTE = read("src/components/SymptomSelfCareNote.jsx");
const BANK = read("src/calculations/symptomSelfCare.js");
const RESOURCES = read("src/repositories/resourcesRepository.js");
// Scope to the 18 Nov per-symptom block only, not the older curated links
// (RCOG/FSRH/charities) that were already verified in their own right.
const symStart = RESOURCES.indexOf("// ADDED 18 Nov 2026 — one link per menstrual symptom");
const SYMPTOM_RESOURCES = RESOURCES.slice(symStart, RESOURCES.indexOf("abortionPregnancyLoss:", symStart));
const SYMPTOM_LOG = read("src/modules/SHOS_SymptomLog_Prototype.jsx");
const MENSTRUAL = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");

describe("symptom self-care info dot", () => {
  it("is a tap disclosure with an accessible name, never a hover tooltip", () => {
    expect(NOTE).toMatch(/aria-expanded=\{open\}/);
    expect(NOTE).toMatch(/aria-label=\{`About \$\{entry\.label\}/);
    expect(NOTE).toMatch(/role="button"/);
    expect(NOTE).toMatch(/tabIndex=\{0\}/);
    expect(NOTE).not.toMatch(/\btitle=/);
    expect(NOTE).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });

  it("takes a symptom key, not caller copy, and hides unknown keys", () => {
    const sig = /export function SymptomSelfCareNote\(\{([^}]*)\}\)/.exec(NOTE);
    expect(sig, "could not read component props").not.toBeNull();
    expect(sig[1]).toMatch(/symptom/);
    expect(sig[1]).not.toMatch(/\b(text|copy|body|explanation|selfCare)\b/);
    expect(NOTE).toMatch(/if \(!entry\) return null/);
  });

  it("renders the bank's approved line and explanation, not its own wording", () => {
    expect(NOTE).toMatch(/SOONER_LINE/);
    expect(NOTE).toMatch(/entry\.explanation/);
    expect(NOTE).toMatch(/entry\.selfCare\.map/);
    expect(BANK).toMatch(/export const SOONER_LINE = "it's worth mentioning to a clinician sooner"/);
  });

  it("uses only theme tokens so no colour baseline is needed", () => {
    // A new .jsx with a raw hex / rgba / ACCENTS read would fail styleColourGuard.
    expect(NOTE).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(NOTE).not.toMatch(/\brgba?\(/);
    expect(NOTE).not.toMatch(/\bACCENTS\.|\bACTION\./);
  });

  it("is wired into Symptom Log detail and the cycle form", () => {
    expect(SYMPTOM_LOG).toMatch(/import SymptomSelfCareNote/);
    expect(SYMPTOM_LOG).toMatch(/<SymptomSelfCareNote[^\n]*symptom=\{name\}/);
    expect(MENSTRUAL).toMatch(/import SymptomSelfCareNote/);
    expect(MENSTRUAL).toMatch(/<SymptomSelfCareNote[^\n]*symptom="Spotting between periods"/);
  });
});

describe("symptom Resources links", () => {
  it("has a named entry for every patient-facing symptom label", () => {
    // Labels are the join key between the bank and Resources ("one key, two
    // views"). A missing entry means the info dot's subject has nowhere to
    // read more.
    const labels = [...BANK.matchAll(/^\s{4}label: "([^"]+)",$/gm)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(10);
    const resourcesCategory = RESOURCES.slice(RESOURCES.indexOf("menstruationMenopause: ["));
    for (const label of labels) {
      expect(resourcesCategory, `no Resources entry for "${label}"`).toContain(`name: "${label}"`);
    }
  });

  it("uses only verified https links or an honest blank", () => {
    const urls = [...SYMPTOM_RESOURCES.matchAll(/link: "([^"]*)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(10);
    for (const url of urls) {
      if (url === "") continue; // honest blank where no page was verified
      expect(url, `unverified link: ${url}`).toMatch(/^https:\/\/(www\.)?nhs\.uk\/conditions\//);
    }
  });
});
