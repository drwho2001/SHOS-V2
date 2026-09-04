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

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan): every
// method below is now `async`, `await`ing storage.load()/save() even
// though storageAdapter itself is still 100% synchronous today — a
// no-op behaviorally (await on a plain value just resolves
// immediately), but what lets storageAdapter's own real async/
// encrypted conversion land later without a second breaking change
// here. This repository was chosen first for this real end-to-end
// proof (repo goes async, every real caller across the app adapts)
// because every read/write already happened fresh inside a function —
// no module-load-time caching to redesign, unlike most repositories
// (see loadedRepositoryState.js's own header for the fuller plan).
async function loadAll() {
  return await storage.load(STORAGE_KEY, {});
}
async function saveAll(all) {
  await storage.save(STORAGE_KEY, all);
}
function generateId() {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const CustomGroupsRepository = {
  // Real ask, matching this session's "did you mean" reasoning:
  // returns [{ id, name, members: [string] }] for one domain.
  async get(domain) {
    return [...((await loadAll())[domain] || [])];
  },

  async create(domain, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return this.get(domain);
    const all = await loadAll();
    const current = all[domain] || [];
    const group = { id: generateId(), name: trimmed, members: [] };
    await saveAll({ ...all, [domain]: [...current, group] });
    return group;
  },

  async rename(domain, groupId, newName) {
    const trimmed = (newName || "").trim();
    if (!trimmed) return this.get(domain);
    const all = await loadAll();
    const current = all[domain] || [];
    const updated = current.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g));
    await saveAll({ ...all, [domain]: updated });
    return updated;
  },

  async delete(domain, groupId) {
    const all = await loadAll();
    const current = all[domain] || [];
    await saveAll({ ...all, [domain]: current.filter((g) => g.id !== groupId) });
  },

  // A member (e.g. "Testosterone") can only belong to one group at a
  // time within a domain — adding it to a group removes it from any
  // other group in that same domain first, so "which group is this
  // type in" always has one unambiguous answer for the grouped view.
  async setMemberGroup(domain, member, groupId) {
    const all = await loadAll();
    const current = (all[domain] || []).map((g) => ({
      ...g,
      members: g.id === groupId ? [...g.members.filter((m) => m !== member), member] : g.members.filter((m) => m !== member),
    }));
    await saveAll({ ...all, [domain]: current });
    return current;
  },

  async removeMemberFromAllGroups(domain, member) {
    const all = await loadAll();
    const current = (all[domain] || []).map((g) => ({ ...g, members: g.members.filter((m) => m !== member) }));
    await saveAll({ ...all, [domain]: current });
    return current;
  },

  // Real convenience for a grouped view: which group (if any) a given
  // member currently belongs to.
  async getGroupForMember(domain, member) {
    return (await this.get(domain)).find((g) => g.members.includes(member)) || null;
  },

  async getAllForBackup() {
    return await loadAll();
  },

  async replaceAll(newAll) {
    await saveAll(newAll || {});
  },
};
