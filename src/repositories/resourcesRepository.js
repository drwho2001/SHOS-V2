// resourcesRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "want resources section in settings maybe - domestic
// violence, contraceptive advice, hrt and trans support, charities,
// clinical justifications used, finding a local clinic or ordering.
// [a] sexual health test postal." "Finding a local clinic or ordering"
// and the postal-test ask are the same real need (get tested —
// locally or by post) so those two are one category below, not two —
// same "combine into similar things if better" call the user made
// about Settings itself, applied here too.
//
// UPDATED 1 Sep 2026 — real ask: the user supplied their own real,
// verified URLs directly (a large curated list across 8 areas), which
// is exactly the case the header below always said would unblock
// this — not a guess, the source this repository was always waiting
// on. Every link below is one the user gave verbatim; nothing here is
// invented. Three new entries genuinely didn't fit any of the original
// 5 categories (public sex/cruising, drugs/chemsex, kink/relationships/
// sex-ed, mental health as its own topic) so those became new
// categories rather than forced into a mismatched one — same
// "combine into similar things IF it's actually the same thing" call
// the user made about Settings itself; Galop and the NHS rape/sexual-
// assault page, by contrast, genuinely are the same need as the
// existing "Domestic violence support" category (abuse/sexual
// violence support broadly), so those joined it instead of forking a
// near-duplicate — the label widened slightly to say so honestly.
//
// STILL LEFT BLANK: `notes` fields on every entry — the user supplied
// URLs, not descriptions, and writing our own summary of a domestic-
// violence helpline's services would be exactly the kind of "probably
// right" guess the original standing rule here was about. Free for
// the user to fill in via the Resources screen's own edit UI, same as
// before.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_resources";

export const CATEGORY_LABELS = {
  domesticViolence: "Domestic violence & sexual abuse support",
  contraception: "Contraceptive advice",
  transHrt: "HRT & trans support",
  charities: "Charities",
  gettingTested: "Get tested — find a clinic or order a postal kit",
  sexualHealth: "Sexual health",
  lgbtqGender: "LGBTQ+ support & gender",
  kinkRelationshipsSexEd: "Kink, relationships & sexual education",
  publicSexCruising: "Public sex & cruising",
  drugsChemsex: "Drugs & chemsex",
  mentalHealth: "Mental health",
};

const SEED_ENTRIES = {
  domesticViolence: [
    { name: "Refuge", link: "", notes: "" },
    { name: "National Domestic Abuse Helpline", link: "https://www.nationaldahelpline.org.uk/", notes: "" },
    { name: "Men's Advice Line", link: "", notes: "" },
    { name: "Galop (LGBT+ anti-abuse charity)", link: "https://www.galop.org.uk/", notes: "" },
    { name: "NHS — help after rape and sexual assault", link: "https://www.nhs.uk/live-well/sexual-health/help-after-rape-and-sexual-assault/", notes: "" },
  ],
  contraception: [
    { name: "NHS sexual health services", link: "", notes: "" },
    { name: "Brook", link: "", notes: "" },
    { name: "SH:24 — emergency contraception", link: "https://sh24.org.uk/contraception/emergency-contraception", notes: "" },
  ],
  transHrt: [
    { name: "Gendered Intelligence", link: "https://genderedintelligence.co.uk/", notes: "" },
    { name: "Mermaids", link: "https://mermaidsuk.org.uk/", notes: "" },
    { name: "GIRES", link: "", notes: "" },
  ],
  charities: [
    { name: "Terrence Higgins Trust", link: "https://tht.org.uk/", notes: "" },
    { name: "National AIDS Trust", link: "https://nat.org.uk/", notes: "" },
  ],
  gettingTested: [
    { name: "NHS.uk — find a sexual health clinic", link: "https://www.nhs.uk/nhs-services/sexual-health-services/find-a-sexual-health-clinic/", notes: "" },
    { name: "SH:24", link: "https://www.sh.uk/", notes: "" },
    { name: "Freetesting.me", link: "", notes: "" },
  ],
  // ADDED 1 Sep 2026 — real ask, general sexual health info that
  // didn't belong under a specific "getting tested"/"contraception"
  // heading — PrEP/PEP/DoxyPEP guidance and two NHS condition pages
  // (Mpox, Hepatitis B) both directly relevant to what this app
  // already tracks in Vaccinations/Testing.
  sexualHealth: [
    { name: "NHS inform (Scotland) — HIV PrEP", link: "https://www.nhsinform.scot/hiv-prep-pre-exposure-prophylaxis/what-is-hiv-prep", notes: "" },
    { name: "Terrence Higgins Trust — PEP (post-exposure prophylaxis)", link: "https://tht.org.uk/hiv/protection/pep-post-exposure-prophylaxis-hiv", notes: "" },
    { name: "Vaccinations against STIs", link: "https://www.shl.uk/en-gb/article/vaccinations-against-stis", notes: "" },
    { name: "DoxyPEP — how and when to take it", link: "https://www.buckshealthcare.nhs.uk/pifs/doxypep-how-and-when-to-take-it/", notes: "" },
    { name: "NHS — Mpox", link: "https://www.nhs.uk/conditions/mpox/", notes: "" },
    { name: "NHS — Hepatitis B", link: "https://www.nhs.uk/conditions/hepatitis-b/", notes: "" },
  ],
  lgbtqGender: [
    { name: "Switchboard LGBT+ Helpline", link: "https://switchboard.lgbt/", notes: "" },
    { name: "Stonewall", link: "https://www.stonewall.org.uk/", notes: "" },
    { name: "LGBT Foundation", link: "https://lgbt.foundation/", notes: "" },
  ],
  kinkRelationshipsSexEd: [
    { name: "Pillow Talk — sex ed for grown-ups", link: "https://pillowtalk.scot/category/sex-ed-for-grown-ups/sex-ed-for-grown-ups-resources/", notes: "" },
    { name: "Choice Support — Supported Loving, kink toolkit", link: "https://www.choicesupport.org.uk/about-us/what-we-do/supported-loving/supported-loving-toolkit/kink", notes: "" },
    { name: "NELFT — CAMHS sex education", link: "https://www.nelft.nhs.uk/camhs-sex-education/", notes: "" },
  ],
  publicSexCruising: [
    { name: "Terrence Higgins Trust — public sex environments", link: "https://tht.org.uk/sexual-health/improving-your-sexual-health/public-sex-environments", notes: "" },
  ],
  drugsChemsex: [
    { name: "We Are With You — chemsex, staying safe", link: "https://www.wearewithyou.org.uk/advice-and-information/advice-for-you/chemsex-how-to-stay-safe-and-get-back-in-control", notes: "" },
    { name: "Release", link: "https://www.release.org.uk/", notes: "" },
    { name: "Mind — drug and alcohol addiction contacts", link: "https://www.mind.org.uk/information-support/types-of-mental-health-problems/recreational-drugs-alcohol-and-addiction/drug-and-alcohol-addiction-useful-contacts/", notes: "" },
    { name: "Talk to Frank — find support near you", link: "https://talktofrank.com/get-help/find-support-near-you", notes: "" },
  ],
  mentalHealth: [
    { name: "Mind", link: "https://www.mind.org.uk/", notes: "" },
    { name: "Samaritans", link: "https://www.samaritans.org/how-we-can-help/contact-samaritan/", notes: "" },
  ],
};

function generateEntryId() {
  return `resource_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withIds(entries) {
  return entries.map((e) => ({ id: generateEntryId(), ...e }));
}

// Merge-on-load — CHANGED 1 Sep 2026, real fix: the old version here
// returned `stored` as-is whenever ANYTHING had ever been saved,
// despite this same comment already claiming a real category-level
// merge — so someone who'd touched Resources even once before today's
// new categories/links were added would never see any of them. Now a
// genuine merge, three real cases: a stored entry the user has already
// given its own link is left untouched (their edit wins); a stored
// entry still blank gets today's newly-supplied real URL by matching
// on name; a category or entry that's brand new since they last
// loaded gets appended. Same "a category the user has never touched
// still picks up a future seed update automatically" intent this
// comment always described — now actually true at the entry level,
// not just when the whole category was untouched.
let categories = (() => {
  const stored = storage.load(STORAGE_KEY, null);
  const seeded = {};
  for (const key of Object.keys(SEED_ENTRIES)) seeded[key] = withIds(SEED_ENTRIES[key]);
  if (!stored) return seeded;

  const merged = { ...stored };
  for (const key of Object.keys(SEED_ENTRIES)) {
    if (!merged[key]) { merged[key] = seeded[key]; continue; }
    const seedByName = new Map(SEED_ENTRIES[key].map((e) => [e.name, e]));
    merged[key] = merged[key].map((entry) => {
      const seedMatch = seedByName.get(entry.name);
      return (seedMatch && !entry.link && seedMatch.link) ? { ...entry, link: seedMatch.link } : entry;
    });
    const existingNames = new Set(merged[key].map((e) => e.name));
    const newOnes = SEED_ENTRIES[key].filter((e) => !existingNames.has(e.name));
    if (newOnes.length) merged[key] = [...merged[key], ...withIds(newOnes)];
  }
  return merged;
})();

function persist() {
  storage.save(STORAGE_KEY, categories);
}

export const ResourcesRepository = {
  getAllCategoryKeys() {
    return Object.keys(CATEGORY_LABELS);
  },

  getEntries(categoryKey) {
    return [...(categories[categoryKey] || [])];
  },

  addEntry(categoryKey, { name, link = "", notes = "" }) {
    const trimmed = (name || "").trim();
    if (!trimmed) return this.getEntries(categoryKey);
    const current = this.getEntries(categoryKey);
    categories = { ...categories, [categoryKey]: [...current, { id: generateEntryId(), name: trimmed, link, notes }] };
    persist();
    return categories[categoryKey];
  },

  updateEntry(categoryKey, entryId, changes) {
    const current = this.getEntries(categoryKey);
    categories = { ...categories, [categoryKey]: current.map((e) => (e.id === entryId ? { ...e, ...changes } : e)) };
    persist();
    return categories[categoryKey];
  },

  removeEntry(categoryKey, entryId) {
    const current = this.getEntries(categoryKey);
    categories = { ...categories, [categoryKey]: current.filter((e) => e.id !== entryId) };
    persist();
    return categories[categoryKey];
  },

  // For backupService.js — same singleton-object shape/reasoning as
  // CustomOptionListsRepository's own getAllForBackup()/replaceAll().
  getAllForBackup() {
    return { ...categories };
  },

  replaceAll(newCategories) {
    categories = newCategories && typeof newCategories === "object" ? newCategories : categories;
    persist();
  },
};
