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
// ADDED — Measurements: deleting a test must clear any Measurement's
// link to it, never delete the Measurement itself (see
// measurementRepository.js's own "one room, three doors" comment).
import { MeasurementRepository } from "./measurementRepository.js";
// ADDED — real gap found via the new orphan-reference checker
// (orphanReferenceCheck.js): delete-time cleanup needs both directions
// of the Testing↔Clinic Visits relationship — clinicVisitsRepository.js
// imports this file right back, a genuine circular import, safe here
// because every use on both sides is a method CALL deferred inside a
// function body (delete()), never read at module-evaluation time. See
// that file's own import comment for the fuller reasoning.
import { ClinicVisitsRepository } from "./clinicVisitsRepository.js";
import { SymptomLogRepository } from "./symptomLogRepository.js";
import { EpisodeRepository } from "./episodeRepository.js";
import { PartnerNotificationRepository } from "./partnerNotificationRepository.js";

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
  // once both ends genuinely exist and it's appropriate to.
  clinicVisitIds: [],
  // relatedSymptomIds: was "stays stubbed — Symptoms Tracker doesn't
  // exist" — stale, Symptom Log is now a real module. FOUND DEAD in a
  // full-app audit: never read or written anywhere. Left unremoved,
  // matching the clinicVisitIds precedent above (SAME reasoning: don't
  // add a second, unsynced way to represent a relationship that already
  // has a real source of truth). Symptom Log's own relatedTestIds
  // (SHOS_SymptomLog_Prototype.jsx) is that source of truth — Testing's
  // own detail screen now shows a reverse lookup into it instead
  // (TestDetail's relatedSymptoms, via SymptomLogRepository.getAll()
  // filtered on relatedTestIds), same shape as linkedVisits below.
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

// ADDED 1 Sep 2026 — real ask: richer example data — the positive
// test and its TOC (test of cure) half of the example Timeline
// episode (see episodeRepository.js's own seed for the full arc: this
// symptomatic test comes back positive for Gonorrhoea despite regular
// PrEP and DoxyPEP taken after the exposure encounter, since neither
// is fully protective against Gonorrhoea specifically — clinically
// accurate, not a gap in the example). Relative dates, same daysAgo
// approach used throughout this session's other seed data.
function daysAgo(n, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedTests = [
  {
    ...DEFAULT_TEST,
    id: "test_001",
    title: "Symptomatic screen — Gonorrhoea positive",
    date: daysAgo(9),
    resultDate: daysAgo(7),
    setting: "🏥🤢 Clinic - Symptomatic",
    sampleType: ["Urine", "Rectal swab"],
    testingFor: ["Gonorrhoea", "Chlamydia", "HIV", "Syphilis"],
    organismIds: ["organism_002"],
    resultIds: ["result_001"],
    mostRecent: false,
    followUpActionedDate: daysAgo(8),
    notes: "Discharge + discomfort a few days after an encounter. Positive for Gonorrhoea, negative for everything else screened.",
    clinicVisitIds: ["visit_001"],
    relatedSymptomIds: ["symlog_001"],
    isArchived: false,
  },
  {
    ...DEFAULT_TEST,
    id: "test_002",
    title: "Test of cure — Gonorrhoea",
    date: daysAgo(2),
    resultDate: daysAgo(1),
    setting: "🏥😎 Clinic - Routine",
    sampleType: ["Urine", "Rectal swab"],
    testingFor: ["Gonorrhoea"],
    organismIds: [],
    resultIds: ["result_002"],
    mostRecent: true,
    notes: "Test of cure, 2 weeks after treatment — confirms it's cleared.",
    clinicVisitIds: ["visit_001"],
    isArchived: false,
  },
  // ADDED — real ask: "testing needed encounters with different
  // types" — real variety across the 4-month window, not just the
  // Gonorrhoea episode's own two tests. A routine quarterly PrEP
  // monitoring screen (full blood panel, standard cadence for anyone
  // on PrEP) and a pre-relationship screen before going condomless
  // with Morgan (see encounterRepository.js/contactRepository.js).
  {
    ...DEFAULT_TEST,
    id: "test_003",
    title: "Routine PrEP monitoring screen",
    date: daysAgo(100),
    resultDate: daysAgo(97),
    setting: "🏥😎 Clinic - Routine",
    sampleType: ["Blood", "Urine"],
    testingFor: ["HIV", "Chlamydia", "Gonorrhoea", "Syphilis"],
    organismIds: [],
    resultIds: ["result_002"],
    mostRecent: false,
    notes: "Quarterly PrEP bloods and STI screen — all clear.",
    isArchived: false,
  },
  {
    ...DEFAULT_TEST,
    id: "test_004",
    title: "Pre-relationship screen",
    date: daysAgo(113),
    resultDate: daysAgo(110),
    setting: "🏥😎 Clinic - Routine",
    sampleType: ["Blood", "Urine"],
    testingFor: ["HIV", "Chlamydia", "Gonorrhoea", "Syphilis"],
    organismIds: [],
    resultIds: ["result_002"],
    mostRecent: false,
    notes: "Screen before going condom-free with Morgan — all clear.",
    isArchived: false,
  },
  // ADDED 9 Sep 2026 — real ask: richer demo data covering fields the
  // original 4 never exercised at all — a real home-kit test (Setting
  // = "🏠 Home", kitCodePk/kitCodeSk/kitAccessKey, all empty on every
  // existing seed test even though the real field was added specifically
  // for this — see DEFAULT_TEST's own 1 Sep 2026 comment), a genuine
  // Chlamydia-positive result (every existing positive is Gonorrhoea —
  // organism_001, confirmed against the real, live OrganismRegistry the
  // same way contactRepository.js's kink ids were), and a Pending result
  // (result_003) — a real, reachable state (posted a kit, result not
  // back yet) no existing seed test represents, so the UI branch for it
  // was never exercised by demo data.
  {
    ...DEFAULT_TEST,
    id: "test_005",
    title: "Home kit STI screen",
    date: daysAgo(3),
    resultDate: null,
    setting: "🏠 Home",
    sampleType: ["Urine", "Blood"],
    testingFor: ["HIV", "Chlamydia", "Gonorrhoea", "Syphilis"],
    organismIds: [],
    resultIds: ["result_003"],
    mostRecent: false,
    kitCodePk: "PK-48291",
    kitCodeSk: "SK-77016",
    kitAccessKey: "AXQ-93K1",
    notes: "SH:24 kit posted, awaiting result.",
    isArchived: false,
  },
  {
    ...DEFAULT_TEST,
    id: "test_006",
    title: "Symptomatic screen — Chlamydia positive",
    date: daysAgo(196),
    resultDate: daysAgo(193),
    setting: "🏥🤢 Clinic - Symptomatic",
    sampleType: ["Urine"],
    testingFor: ["Chlamydia", "Gonorrhoea", "HIV", "Syphilis"],
    organismIds: ["organism_001"],
    resultIds: ["result_001"],
    mostRecent: false,
    writtenPlan: "Doxycycline course, test of cure in 3 weeks.",
    notes: "Mild discharge after a hookup — positive for Chlamydia, negative for everything else screened.",
    clinicVisitIds: ["visit_004"],
    isArchived: false,
  },
  {
    ...DEFAULT_TEST,
    id: "test_007",
    title: "Routine annual screen",
    date: daysAgo(160),
    resultDate: daysAgo(155),
    setting: "🏥😎 Clinic - Routine",
    sampleType: ["Blood", "Urine", "Rectal swab"],
    testingFor: ["HIV", "Chlamydia", "Gonorrhoea", "Syphilis", "Hepatitis B", "Hepatitis C"],
    organismIds: [],
    resultIds: ["result_002"],
    mostRecent: false,
    clinicVisitIds: ["visit_005"],
    isArchived: false,
  },
];

// CHANGED — Phase 2 encryption groundwork: ensureLoaded()/memoized-
// loadPromise pattern, same as every other module-load-cached
// repository converted this session (see CLAUDE.md).
let tests = null;
let nextTestNumber = null;
let loadPromise = null;
async function ensureLoaded() {
  if (tests === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, seedTests);
    tests = await loadPromise;
    nextTestNumber = computeNextTestNumber(tests);
  }
  return tests;
}

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

async function persist() {
  await storage.save(STORAGE_KEY, tests);
}

export const TestingRepository = {
  async getAll() {
    await ensureLoaded();
    return structuredClone(tests.map((t) => ({ ...DEFAULT_TEST, ...t })));
  },

  async getById(id) {
    await ensureLoaded();
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

  async create(data) {
    await ensureLoaded();
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
    await persist();
    return newTest;
  },

  async update(id, changes) {
    await ensureLoaded();
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
    await persist();
    return updated ? structuredClone({ ...DEFAULT_TEST, ...updated }) : null;
  },

  async archive(id) {
    return this.update(id, { isArchived: true });
  },

  // ADDED — real gap found in an "undo/edit/delete/archive" consistency
  // audit: every sibling repository with archive() also has the
  // reverse — this one didn't, so an archived test had no way back
  // short of manually editing storage.
  async unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // ADDED — real gap found via the new orphan-reference checker
  // (orphanReferenceCheck.js): clinicVisitIds needs cleaning up when
  // the Clinic Visit it points at is hard-deleted elsewhere — called
  // by clinicVisitsRepository.js's own delete(). Only clears the link,
  // same role as measurementRepository.js's own unlink methods.
  async unlinkClinicVisit(visitId) {
    await ensureLoaded();
    tests = tests.map((t) => ({ ...t, clinicVisitIds: (t.clinicVisitIds || []).filter((id) => id !== visitId) }));
    await persist();
  },

  // ADDED — real ask: "no option to delete erroneous tests." Archive
  // stays the default, correct choice for anything real that just
  // isn't current anymore — this is specifically for a genuinely
  // wrong entry (duplicate, mis-tapped, wrong record entirely), where
  // keeping it around forever (even archived) is actively wrong, not
  // just unwanted. Real removal, not soft-hide — the UI gates this
  // behind its own explicit confirmation step, this function itself
  // doesn't ask twice.
  async delete(id) {
    await ensureLoaded();
    tests = tests.filter((t) => t.id !== id);
    await persist();
    MeasurementRepository.unlinkTest(id);
    // ADDED — real gap found via the new orphan-reference checker
    // (orphanReferenceCheck.js): Clinic Visit/Symptom Log/Episode all
    // reference a Test by id too, same "only clears the link" role as
    // the call above. Partner Notification is different — "ONE LIST
    // PER TEST" means its own list has no meaning once the Test is
    // gone, so that one is a real delete, not a link clear.
    ClinicVisitsRepository.unlinkTest(id);
    SymptomLogRepository.unlinkTest(id);
    EpisodeRepository.unlinkTest(id);
    PartnerNotificationRepository.deleteForTest(id);
  },

  // ADDED 26 Aug 2026 — real ask: long-press multi-select rolled out
  // to every module.
  async bulkArchive(ids) {
    for (const id of ids) await this.archive(id);
  },

  async bulkDelete(ids) {
    await ensureLoaded();
    tests = tests.filter((t) => !ids.includes(t.id));
    await persist();
    for (const id of ids) {
      MeasurementRepository.unlinkTest(id);
      ClinicVisitsRepository.unlinkTest(id);
      SymptomLogRepository.unlinkTest(id);
      EpisodeRepository.unlinkTest(id);
      PartnerNotificationRepository.deleteForTest(id);
    }
  },

  // ADDED 26 Aug 2026 — real ask: undo for delete, not just archive.
  async restore(record) {
    await ensureLoaded();
    if (tests.some((t) => t.id === record.id)) return;
    tests = [...tests, record];
    await persist();
  },

  // Attachment helpers — kept here rather than a separate repository
  // file: attachments in this app are always owned by exactly one test
  // (no cross-module Attachments feed exists, unlike Notion's real
  // Attachments database which can link to multiple record types) —
  // matches the user's "not actually used to date" framing: this is the
  // minimal real version, not the fuller cross-linked one.
  async addAttachment(testId, { title, type, fileDataUrl, linkedItem }) {
    const attachment = {
      id: generateAttachmentId(),
      title: title || "Untitled",
      type: type || "Other",
      date: new Date().toISOString(),
      fileDataUrl: fileDataUrl || "",
      linkedItem: linkedItem || "",
    };
    return this.update(testId, {
      attachments: [...((await this.getById(testId))?.attachments || []), attachment],
    });
  },

  async removeAttachment(testId, attachmentId) {
    const test = await this.getById(testId);
    if (!test) return null;
    return this.update(testId, {
      attachments: test.attachments.filter((a) => a.id !== attachmentId),
    });
  },

  async replaceAll(newTests) {
    tests = newTests;
    nextTestNumber = computeNextTestNumber(tests);
    await persist();
  },
};
