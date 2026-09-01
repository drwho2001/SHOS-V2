// testingRepository.js
//
// Real Notion schema (Testing database, fetched live 19 Aug 2026 —
// confirmed 🟢 Fixed as of the 31 Jul 2026 Backend Verification Report,
// no outstanding known issues carried over). Same repository pattern
// as everywhere else this session: getAll()/getById() merge each
// stored record over DEFAULT_TEST before returning, so a field added
// tomorrow is automatically safe for every test logged today — this is
// now the STANDARD pattern from day one for a new module, not something
// bolted on after the fact, per the user's explicit instruction this
// session ("ensure implemented from start in any new builds").
//
// DELIBERATE SCOPE CUT, per the user's explicit instruction this session:
// "don't worry about live relationships — add those at the end."
// UPDATE 19 Aug 2026 — Clinic Visits now exists (clinicVisitsRepository.js),
// so clinicVisitIds is real and two-way-linked (see getByLinkedTest() in
// that file, and TestDetail's own display below). relatedSymptomIds
// stays stubbed — Symptoms Tracker still doesn't exist as a module.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_tests";

export const SETTING_OPTIONS = ["🏥😎 Clinic - Routine", "🏥🤢 Clinic - Symptomatic", "🏥➕ Clinic - Positive test", "🏠 Home"];
// (SAMPLE_TYPE_OPTIONS moved to customOptionListsRepository.js, real
// in-app editable list, per the user's ask. TESTING_FOR_OPTIONS/
// SETTING_OPTIONS deliberately stay fixed here — see
// customOptionListsRepository.js's header for exactly why.)
// CHANGED 19 Aug 2026 — real feedback batch: "Other" should always
// sort to the end of any option list (it's a catch-all, reads oddly
// mixed into the middle of a specific-infection list) — moved last.
// "C&S (treatment)" renamed → "C&S (symptomatic/treatment)" per
// The user's exact wording, to be clearer this covers a symptomatic
// culture-and-sensitivity test too, not only a scheduled treatment
// follow-up.
export const TESTING_FOR_OPTIONS = ["Gonorrhoea", "HIV", "Syphilis", "Chlamydia", "Hepatitis A", "Hepatitis B", "Hepatitis C", "Mpox", "MGen", "HPV", "Herpes (HSV)", "Trichomoniasis", "Bacterial vaginosis", "C&S (symptomatic/treatment)", "Other"];

export const DEFAULT_TEST = {
  title: "",
  date: null,
  // ADDED 19 Aug 2026 — real feedback batch: Result Date, separate
  // from the specimen/test date above — the date the RESULT actually
  // came back, which can lag the test date by days depending on
  // sample type. Optional — left blank for point-of-care tests where
  // the two are effectively the same moment.
  resultDate: null,
  setting: "",
  sampleType: [],
  testingFor: [],
  organismIds: [],       // → OrganismRegistry, real and wired
  resultIds: [],         // → ResultsRegistry, real and wired
  mostRecent: false,
  followUpActionedDate: null,
  // ADDED 19 Aug 2026 — real feedback batch: a free-text "written
  // plan" — e.g. "f/u in 2 weeks for treatment" — distinct from the
  // structured Follow-up Actioned Date above. The date field answers
  // "when was follow-up actually done"; this answers "what's the plan
  // if it hasn't happened yet" — genuinely different information, not
  // a duplicate.
  writtenPlan: "",
  // ADDED 26 Aug 2026 — real bug: Testing was the only module without
  // a genuine free-text notes field (Contacts, Encounters, Clinic
  // Visits, Symptom Log, Vaccinations, Timeline all have one). The
  // form's "Notes" section title existed but only ever showed
  // conditional home-kit tracking info, so it looked broken/unwritable
  // for any non-home test.
  notes: "",
  // CHANGED 1 Sep 2026 — real ask: "there's usually a pk/sk kit code
  // and an access key... not just one field" — a real postal/home STI
  // test kit (e.g. SH:24, Freetesting.me) has these as genuinely
  // separate identifiers: two parts to the kit's own code, plus a
  // distinct access key used to log into the results portal — one
  // free-text field couldn't represent that without just concatenating
  // them by hand. trackingInfo is kept, not removed or repurposed, for
  // anything already saved there and as a genuine catch-all for
  // anything that doesn't fit the three fields below.
  trackingInfo: "",
  kitCodePk: "",
  kitCodeSk: "",
  kitAccessKey: "",
  attachments: [],        // real, wired — see attachment shape below
  // CHANGED 19 Aug 2026 — clinicVisitIds is now REAL, not stubbed.
  // Clinic Visits exists as a module now (see clinicVisitsRepository.js),
  // per the user's own instruction applied consistently: wire a relationship
  // once both ends genuinely exist and it's appropriate to. relatedSymptomIds
  // stays stubbed — Symptoms Tracker still doesn't exist.
  clinicVisitIds: [],
  relatedSymptomIds: [],
  isArchived: false,
};

// Each attachment: { id, title, type, date, fileDataUrl, linkedItem }.
// Same data-URL approach as Contacts' Profile Picture — no backend
// exists, so this is the only way to keep a file genuinely
// self-contained. Same honest size caveat applies (see
// contactRepository.js's profilePicture comment) — worth knowing, not
// a blocker for the "not actually used to date" scope the user described.
function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let tests = storage.load(STORAGE_KEY, []);
let nextTestNumber = computeNextTestNumber(tests);

function computeNextTestNumber(existing) {
  const numbers = existing.map((t) => {
    const match = /^test_(\d+)$/.exec(t.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateTestId() {
  const id = `test_${String(nextTestNumber).padStart(3, "0")}`;
  nextTestNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, tests);
}

export const TestingRepository = {
  getAll() {
    return structuredClone(tests.map((t) => ({ ...DEFAULT_TEST, ...t })));
  },

  getById(id) {
    const found = tests.find((t) => t.id === id);
    return found ? structuredClone({ ...DEFAULT_TEST, ...found }) : null;
  },

  // ADDED — real ask: "mostRecent" was a plain manual checkbox with no
  // logic behind it at all — nothing prevented a future-dated test
  // from being flagged, and nothing un-flagged an older test once a
  // newer one genuinely covered the same ground. Real definition used
  // here, matching the user's own: two tests on the SAME DAY can both
  // stay "most recent" (different sample sites, same visit) — this
  // only un-flags an test that's both OLDER (different, earlier date)
  // AND tests for at least one of the SAME infections as the new one,
  // since that's genuinely what "superseded" means — a test for
  // something completely different isn't superseded by this one.
  _supersedeOlderMostRecent(newTest) {
    if (!newTest.mostRecent || !newTest.date) return;
    const newDay = newTest.date.slice(0, 10);
    tests = tests.map((t) => {
      if (t.id === newTest.id || !t.mostRecent || !t.date) return t;
      const sameDay = t.date.slice(0, 10) === newDay;
      if (sameDay) return t; // same-day tests can coexist as most recent
      const isOlder = new Date(t.date) < new Date(newTest.date);
      const overlaps = (t.testingFor || []).some((x) => (newTest.testingFor || []).includes(x));
      if (isOlder && overlaps) return { ...t, mostRecent: false };
      return t;
    });
  },

  create(data) {
    // CHANGED — real ask: "future tests are not recent" — a test
    // dated in the future can never be marked most recent, regardless
    // of what was passed in.
    const isFuture = data.date && new Date(data.date) > new Date();
    const newTest = {
      ...DEFAULT_TEST,
      ...data,
      mostRecent: isFuture ? false : data.mostRecent,
      id: generateTestId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    tests = [...tests, newTest];
    this._supersedeOlderMostRecent(newTest);
    persist();
    return newTest;
  },

  update(id, changes) {
    let updated = null;
    tests = tests.map((t) => {
      if (t.id !== id) return t;
      // ADDED 26 Aug 2026 — real ask: last-updated indicator, rolled
      // out consistently across every module (none tracked this
      // before — only My Profile did). Purely a reference fact shown
      // to the user, deliberately NOT wired into any activity/backup-
      // check logic — per the user's own clarification, an edit isn't the
      // same thing as a logged encounter.
      const merged = { ...t, ...changes, updatedAt: new Date().toISOString() };
      // Same future-date guard as create().
      const isFuture = merged.date && new Date(merged.date) > new Date();
      updated = isFuture ? { ...merged, mostRecent: false } : merged;
      return updated;
    });
    if (updated) this._supersedeOlderMostRecent(updated);
    persist();
    return updated ? structuredClone({ ...DEFAULT_TEST, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real ask: "no option to delete erroneous tests." Archive
  // stays the default, correct choice for anything real that just
  // isn't current anymore — this is specifically for a genuinely
  // wrong entry (duplicate, mis-tapped, wrong record entirely), where
  // keeping it around forever (even archived) is actively wrong, not
  // just unwanted. Real removal, not soft-hide — the UI gates this
  // behind its own explicit confirmation step, this function itself
  // doesn't ask twice.
  delete(id) {
    tests = tests.filter((t) => t.id !== id);
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  bulkArchive(ids) {
    ids.forEach((id) => this.archive(id));
  },

  bulkDelete(ids) {
    tests = tests.filter((t) => !ids.includes(t.id));
    persist();
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  restore(record) {
    if (tests.some((t) => t.id === record.id)) return;
    tests = [...tests, record];
    persist();
  },

  // Attachment helpers — kept here rather than a separate repository
  // file: attachments in this app are always owned by exactly one test
  // (no cross-module Attachments feed exists, unlike Notion's real
  // Attachments database which can link to multiple record types) —
  // matches the user's "not actually used to date" framing: this is the
  // minimal real version, not the fuller cross-linked one.
  addAttachment(testId, { title, type, fileDataUrl, linkedItem }) {
    const attachment = {
      id: generateAttachmentId(),
      title: title || "Untitled",
      type: type || "Other",
      date: new Date().toISOString(),
      fileDataUrl: fileDataUrl || "",
      linkedItem: linkedItem || "",
    };
    return this.update(testId, {
      attachments: [...(this.getById(testId)?.attachments || []), attachment],
    });
  },

  removeAttachment(testId, attachmentId) {
    const test = this.getById(testId);
    if (!test) return null;
    return this.update(testId, {
      attachments: test.attachments.filter((a) => a.id !== attachmentId),
    });
  },

  replaceAll(newTests) {
    tests = newTests;
    persist();
  },
};
