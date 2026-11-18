// F3 (18 Nov) — stop-reminding is persistent and FIGO-episode-scoped; the Maps
// button opens Google Maps with verified on-screen steps. Source guard.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const module = read("src/modules/SHOS_MenstrualHealth_Prototype.jsx");
const contacts = read("src/modules/SHOS_Contacts_Prototype.jsx");

describe("spotting prompt episode dismiss", () => {
  it("uses persistent storage, not per-mount state", () => {
    expect(module).toMatch(/SPOTTING_PROMPT_ACK_KEY/);
    expect(module).toMatch(/storage\.load\(SPOTTING_PROMPT_ACK_KEY/);
    expect(module).toMatch(/storage\.save\(SPOTTING_PROMPT_ACK_KEY, episodeKey\)/);
    expect(module).not.toMatch(/promptDismissed/);
  });

  it("scopes the acknowledgement to the current FIGO episode", () => {
    expect(module).toMatch(/episodeKey = bleedingEpisodeKey\(/);
    expect(module).toMatch(/episodeAcknowledged/);
    expect(module).toMatch(/spottingPrompt && !episodeAcknowledged/);
  });

  it("uses plain, non-clinical dismiss wording", () => {
    expect(module).toMatch(/I've discussed this — stop reminding me/);
    expect(module).not.toMatch(/Not relevant \/ dismiss/);
  });
});

describe("Maps live-location handoff", () => {
  it("opens Google Maps and gives the verified menu path", () => {
    expect(contacts).toMatch(/Open Google Maps → start Live location sharing/);
    expect(contacts).toMatch(/Location sharing → New share/);
    expect(contacts).toMatch(/Copy link/);
    expect(contacts).toMatch(/https:\/\/www\.google\.com\/maps\//);
  });
});
