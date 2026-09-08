// partnerNotificationRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "partner notification - produce a task... should be able
// to generate a task/checklist of who to contact - produce name,
// contact method and detail (@/#)." Deliberately NOT an auto-send
// feature — the user's own explicit line: "not gonna get you to send
// automatically." This is a real, persistent checklist tied to the
// positive Test that triggered it, editable and tickable off over
// time, not a one-shot export that's forgotten the moment you close
// the sheet.
//
// SCOPE CALL, stated plainly: the user also raised a bigger open
// question — real task management, additional modules, where they
// live, a customisable nav — and explicitly flagged that as its own
// separate tangent to come back to later, not something to resolve to
// build this. So this stays narrowly scoped to exactly what was asked:
// one checklist per Test, reached from that Test's own detail screen,
// not a new generic cross-app Task system or a new nav entry.
//
// ONE LIST PER TEST, not a history of many — regenerating (see the
// UI's own "Edit contacts" flow) updates the existing list in place
// rather than creating a second one for the same Test. A given
// positive result has one real set of people to notify; multiple
// competing lists for the same test would just be confusing.
//
// CLINICAL VERSION — real ask: "also consider a clinical version for
// tracking which may ask DOB/Age and address for sourcing." A clinic's
// own partner-notification team needs enough to actually locate/
// contact someone themselves — DOB and address aren't tracked
// anywhere else in this app (Contact only has an approximate `age`,
// see contactRepository.js), so those two are captured HERE, per
// checklist item, at generation time — not added as new permanent
// Contact fields just to serve this one occasional export, which would
// be scope creep for data that's only ever relevant in this specific
// context.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_partner_notification_lists";

// One entry per contact selected onto the list.
export const DEFAULT_NOTIFICATION_ITEM = {
  contactId: "",
  name: "",
  methods: "",     // free text — human-readable "Phone: 07700... / Snapchat: @handle" summary, editable
  dob: "",          // clinical only — freeform, this app has no DOB field elsewhere to pull from
  age: null,        // clinical only — prefilled from Contact.age when known
  address: "",      // clinical only — prefilled from Contact.address/city when known
  notified: false,
};

export const DEFAULT_NOTIFICATION_LIST = {
  id: "",
  testId: "",
  createdAt: "",
  updatedAt: "",
  clinical: false,
  items: [],
};

function generateListId() {
  return `partnernotify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// CHANGED — Phase 2 encryption groundwork: ensureLoaded()/memoized-
// loadPromise pattern, same as every other module-load-cached
// repository converted this session (see CLAUDE.md).
let lists = null;
let loadPromise = null;
async function ensureLoaded() {
  if (lists === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, []);
    lists = await loadPromise;
  }
  return lists;
}
async function persist() {
  await storage.save(STORAGE_KEY, lists);
}

export const PartnerNotificationRepository = {
  async getAll() {
    await ensureLoaded();
    return structuredClone(lists.map((l) => ({ ...DEFAULT_NOTIFICATION_LIST, ...l })));
  },

  async getByTestId(testId) {
    await ensureLoaded();
    const found = lists.find((l) => l.testId === testId);
    return found ? structuredClone({ ...DEFAULT_NOTIFICATION_LIST, ...found }) : null;
  },

  async getById(id) {
    await ensureLoaded();
    const found = lists.find((l) => l.id === id);
    return found ? structuredClone({ ...DEFAULT_NOTIFICATION_LIST, ...found }) : null;
  },

  // Creates a new list, OR — if one already exists for this testId —
  // replaces its items in place (same id, same createdAt), matching
  // the "one list per test" rule above. Existing items whose contactId
  // is still present keep their notified/edited fields; anything new
  // shows up as items are handed in fresh by the caller (the UI's own
  // "Edit contacts" flow does that merge, not this function — this
  // just persists whatever item array it's given).
  async save({ testId, clinical, items }) {
    await ensureLoaded();
    const existing = lists.find((l) => l.testId === testId);
    const now = new Date().toISOString();
    if (existing) {
      lists = lists.map((l) => (l.testId === testId ? { ...l, clinical, items, updatedAt: now } : l));
      await persist();
      return structuredClone({ ...DEFAULT_NOTIFICATION_LIST, ...lists.find((l) => l.testId === testId) });
    }
    const newList = { ...DEFAULT_NOTIFICATION_LIST, id: generateListId(), testId, clinical, items, createdAt: now, updatedAt: now };
    lists = [...lists, newList];
    await persist();
    return structuredClone(newList);
  },

  async updateItem(listId, contactId, changes) {
    await ensureLoaded();
    lists = lists.map((l) => {
      if (l.id !== listId) return l;
      return { ...l, items: l.items.map((i) => (i.contactId === contactId ? { ...i, ...changes } : i)), updatedAt: new Date().toISOString() };
    });
    await persist();
    return this.getById(listId);
  },

  async toggleNotified(listId, contactId) {
    await ensureLoaded();
    const list = lists.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.contactId === contactId);
    if (!item) return this.getById(listId);
    return this.updateItem(listId, contactId, { notified: !item.notified });
  },

  async remove(listId) {
    await ensureLoaded();
    lists = lists.filter((l) => l.id !== listId);
    await persist();
  },

  // ADDED — real gap found via the new orphan-reference checker
  // (orphanReferenceCheck.js): a checklist item's contactId needs
  // clearing when that CONTACT is hard-deleted elsewhere — called by
  // contactRepository.js's own delete(). Only clears the link, same
  // "only clears the link" role as measurementRepository.js's own
  // unlink methods. Left fire-and-forget from that still-synchronous
  // caller, same precedent as LocationsRepository.unlinkContact.
  async unlinkContact(contactId) {
    await ensureLoaded();
    lists = lists.map((l) => ({ ...l, items: l.items.map((i) => (i.contactId === contactId ? { ...i, contactId: "" } : i)) }));
    await persist();
  },

  // Same reasoning, called by testingRepository.js's own delete() —
  // also left fire-and-forget there.
  async deleteForTest(testId) {
    await ensureLoaded();
    lists = lists.filter((l) => l.testId !== testId);
    await persist();
  },

  async replaceAll(newLists) {
    lists = Array.isArray(newLists) ? newLists : [];
    await persist();
  },
};
