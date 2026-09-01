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
// WHY NO REAL LINKS/PHONE NUMBERS ARE SEEDED HERE, stated plainly: a
// URL or a helpline number for something in this category — especially
// domestic violence — has to be right, not "probably right". This
// session already has a standing rule against inventing a URL (the
// coffee-donation link stayed blank rather than guess), and the stakes
// here are real, not cosmetic. So this file seeds real, well-known UK
// organisation NAMES only — Refuge, Terrence Higgins Trust, Mermaids,
// etc. genuinely exist and are correctly categorised — with every
// link/phone field left blank for the user to fill in themselves with
// a verified, current number/URL via the Resources screen's own edit
// UI. Same shape as every other "seeded but user-editable" list this
// app already has (CustomOptionListsRepository, Registries).
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_resources";

export const CATEGORY_LABELS = {
  domesticViolence: "Domestic violence support",
  contraception: "Contraceptive advice",
  transHrt: "HRT & trans support",
  charities: "Charities",
  gettingTested: "Get tested — find a clinic or order a postal kit",
};

// Real, well-known UK organisations, named only — see the header above
// for why no link/phone is pre-filled. `link` and `notes` are exactly
// what the Resources screen's edit UI writes to; both start blank.
const SEED_ENTRIES = {
  domesticViolence: [
    { name: "Refuge", link: "", notes: "" },
    { name: "National Domestic Abuse Helpline", link: "", notes: "" },
    { name: "Men's Advice Line", link: "", notes: "" },
  ],
  contraception: [
    { name: "NHS sexual health services", link: "", notes: "" },
    { name: "Brook", link: "", notes: "" },
  ],
  transHrt: [
    { name: "Gendered Intelligence", link: "", notes: "" },
    { name: "Mermaids", link: "", notes: "" },
    { name: "GIRES", link: "", notes: "" },
  ],
  charities: [
    { name: "Terrence Higgins Trust", link: "", notes: "" },
    { name: "National AIDS Trust", link: "", notes: "" },
  ],
  gettingTested: [
    { name: "NHS.uk — find a sexual health clinic", link: "", notes: "" },
    { name: "SH:24", link: "", notes: "" },
    { name: "Freetesting.me", link: "", notes: "" },
  ],
};

function generateEntryId() {
  return `resource_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withIds(entries) {
  return entries.map((e) => ({ id: generateEntryId(), ...e }));
}

// Merge-on-load, same pattern as CustomOptionListsRepository: a
// category the user has never touched still picks up a future seed
// update automatically; one they HAVE edited keeps their version.
let categories = (() => {
  const stored = storage.load(STORAGE_KEY, null);
  if (stored) return stored;
  const seeded = {};
  for (const key of Object.keys(SEED_ENTRIES)) seeded[key] = withIds(SEED_ENTRIES[key]);
  return seeded;
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
