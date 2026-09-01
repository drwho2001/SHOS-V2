// customGroupsRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "ability to group measurement types, or custom groupings
// — actually feel like meds should also have ability to make own
// groups with custom groupings name." One shared, generic mechanism
// rather than two bespoke ones — a "group" is just a user-named bundle
// of option-list values (e.g. Measurement types "Testosterone" +
// "Estradiol" + "LH" + "FSH" grouped as "HRT panel", or Medication
// categories bundled the same way), keyed by `domain` so Measurements
// and Medication (and anything else, later) can each have their own
// independent set of groups without colliding.
//
// DELIBERATELY NOT the same thing as CustomOptionListsRepository's
// lists — those are the actual values a record's field can hold
// (real data). A group here is a purely organisational, VIEW-level
// grouping OF those values — deleting a group never touches any
// record, and a value not in any group simply isn't grouped (shown as
// "Ungrouped" wherever the consuming screen renders these).
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_custom_groups";

function loadAll() {
  return storage.load(STORAGE_KEY, {});
}
function saveAll(all) {
  storage.save(STORAGE_KEY, all);
}
function generateId() {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const CustomGroupsRepository = {
  // Real ask, matching this session's "did you mean" reasoning:
  // returns [{ id, name, members: [string] }] for one domain.
  get(domain) {
    return [...(loadAll()[domain] || [])];
  },

  create(domain, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return this.get(domain);
    const all = loadAll();
    const current = all[domain] || [];
    const group = { id: generateId(), name: trimmed, members: [] };
    saveAll({ ...all, [domain]: [...current, group] });
    return group;
  },

  rename(domain, groupId, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return this.get(domain);
    const all = loadAll();
    const current = all[domain] || [];
    const updated = current.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g));
    saveAll({ ...all, [domain]: updated });
    return updated;
  },

  delete(domain, groupId) {
    const all = loadAll();
    const current = all[domain] || [];
    saveAll({ ...all, [domain]: current.filter((g) => g.id !== groupId) });
  },

  // A member (e.g. "Testosterone") can only belong to one group at a
  // time within a domain — adding it to a group removes it from any
  // other group in that same domain first, so "which group is this
  // type in" always has one unambiguous answer for the grouped view.
  setMemberGroup(domain, member, groupId) {
    const all = loadAll();
    const current = (all[domain] || []).map((g) => ({
      ...g,
      members: g.id === groupId ? [...g.members.filter((m) => m !== member), member] : g.members.filter((m) => m !== member),
    }));
    saveAll({ ...all, [domain]: current });
    return current;
  },

  removeMemberFromAllGroups(domain, member) {
    const all = loadAll();
    const current = (all[domain] || []).map((g) => ({ ...g, members: g.members.filter((m) => m !== member) }));
    saveAll({ ...all, [domain]: current });
    return current;
  },

  // Real convenience for a grouped view: which group (if any) a given
  // member currently belongs to.
  getGroupForMember(domain, member) {
    return this.get(domain).find((g) => g.members.includes(member)) || null;
  },

  getAllForBackup() {
    return loadAll();
  },

  replaceAll(newAll) {
    saveAll(newAll || {});
  },
};
