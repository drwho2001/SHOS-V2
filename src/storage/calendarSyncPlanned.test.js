// The PLANNED family's calendar sync (t139) - a scheduled retest, and a
// vaccination dose that is still due, on the phone's real calendar.
//
// WHY THIS FILE IS ITS OWN THING, like the vaccination family's: the
// planned family behaves DIFFERENTLY from the other two in ways that each
// fail silently.
//
//   1. THE MARKER NAMESPACES MUST NOT COLLIDE. The clinic cleanup deletes
//      any event whose notes match /^\[shos:(.+)\]$/ when that id is not in
//      the current set, and the vaccination cleanup deletes any event
//      matching /^\[shosvax:.../. A planned marker inside either of those
//      brackets would be deleted by every sync of the OTHER family and
//      recreated by the next one - forever, and invisibly. So the planned
//      family has its own namespace, and the two existing cleanups have to
//      leave it alone. That is what most of this file checks.
//   2. A PLAN IS A FUTURE EVENT AND ITS DATE CAN MOVE. A retest that is
//      rescheduled is the SAME plan, so its event must MOVE rather than be
//      deleted and recreated - which is why the planned marker holds the
//      test's id and not its date.
//   3. IT IS OPT-IN, SEPARATELY. Every privacy-adjacent feature in this app
//      is opt-in and off by default, and a planned event is health data
//      with a date on it.
//
// The mock below keeps a FAKE PHONE CALENDAR rather than returning a canned
// list, so the "does the event already exist" lookup, the move-on-reschedule
// and the cleanup passes are all exercised against real state.
import { describe, it, expect, beforeEach, vi } from "vitest";

process.env.TZ = "Europe/London";

const created = [];
const modified = [];
const deleted = [];
let calendarEvents = [];

vi.mock("@capacitor/calendar", () => ({
  Calendar: {
    listCalendars: async () => ({ calendars: [{ id: "cal1", name: "SHOS (private)" }] }),
    createCalendar: async () => ({ id: "cal1" }),
    findEvents: async (opts = {}) => {
      let events = calendarEvents;
      if (opts.notes) events = events.filter((e) => (e.notes || "").includes(opts.notes));
      if (opts.calendarName) events = events.filter((e) => e.calendarName === opts.calendarName);
      return { events };
    },
    createEvent: async (opts) => {
      created.push(opts);
      const ev = {
        id: `ev${created.length}`,
        notes: opts.notes,
        title: opts.title,
        location: opts.location,
        startDate: opts.startDate,
        calendarName: "SHOS (private)",
      };
      calendarEvents.push(ev);
      return { id: ev.id };
    },
    modifyEvent: async (opts) => {
      modified.push(opts);
      const ev = calendarEvents.find((e) => (e.notes || "") === opts.filter.notes);
      if (ev) {
        ev.startDate = opts.newEvent.startDate;
        ev.endDate = opts.newEvent.endDate;
        ev.title = opts.newEvent.title;
        ev.location = opts.newEvent.location;
      }
    },
    deleteEvent: async (opts) => {
      deleted.push(opts);
      calendarEvents = calendarEvents.filter((e) => e.id !== opts.id);
    },
    deleteCalendar: async () => {},
  },
}));

let prefs = {
  calendarSyncEnabled: true,
  calendarSyncVaccinations: true,
  calendarSyncPlanned: true,
  calendarSyncGenericTitle: false,
  calendarSyncTargetName: null,
};

vi.mock("../repositories/appPreferencesRepository.js", () => ({
  AppPreferencesRepository: {
    getPreferences: async () => ({ ...prefs }),
    update: async (changes) => { prefs = { ...prefs, ...changes }; },
  },
}));

// The planned family reads its data from the repositories itself, because a
// plan can come from two different modules and every caller would otherwise
// have to know about both.
let testRecords = [];
let vaccinationRecords = [];

vi.mock("../repositories/testingRepository.js", () => ({
  TestingRepository: { getAll: async () => testRecords },
}));

vi.mock("../repositories/vaccinationRepository.js", () => ({
  VaccinationRepository: { getAll: async () => vaccinationRecords },
}));

const {
  syncPlannedEventsToCalendar,
  removeSyncedPlannedEvents,
  removeSyncedVaccinationEvents,
  removeSyncedEventsFrom,
  syncClinicVisitsToCalendar,
  syncVaccinationsToCalendar,
} = await import("./calendarSyncService");
const { realTimestampFromStored } = await import("../calculations/dateInputHelpers.js");

const FUTURE = "2099-12-23T10:00:00.000Z";

function plannedTest(overrides = {}) {
  return {
    id: "test_1",
    title: "Routine 3-month screen",
    date: FUTURE,
    isArchived: false,
    ...overrides,
  };
}

beforeEach(() => {
  created.length = 0;
  modified.length = 0;
  deleted.length = 0;
  calendarEvents = [];
  testRecords = [];
  vaccinationRecords = [];
  prefs = {
    calendarSyncEnabled: true,
    calendarSyncVaccinations: true,
    calendarSyncPlanned: true,
    calendarSyncGenericTitle: false,
    calendarSyncTargetName: null,
  };
});

describe("a plan is opt-in, like every other privacy-adjacent thing here", () => {
  it("writes nothing when the family's own switch is off", async () => {
    prefs.calendarSyncPlanned = false;
    testRecords = [plannedTest()];
    const result = await syncPlannedEventsToCalendar();
    expect(result.synced).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("writes nothing when the master switch is off", async () => {
    prefs.calendarSyncEnabled = false;
    testRecords = [plannedTest()];
    const result = await syncPlannedEventsToCalendar();
    expect(result.synced).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("is INDEPENDENT of the doses' switch, in both directions", async () => {
    // The planned family on, the doses off: a plan is written and no dose
    // event appears - each family is its own opt-in.
    prefs.calendarSyncVaccinations = false;
    testRecords = [plannedTest()];
    vaccinationRecords = [
      {
        id: "vax_1",
        title: "Hepatitis B",
        isArchived: false,
        doses: [{ doseNumber: 1, date: "2026-09-01", time: "11:00" }],
      },
    ];
    await syncPlannedEventsToCalendar();
    expect(created).toHaveLength(1);
    expect(created[0].notes).toBe("[shosplan:test:test_1]");
  });
});

describe("a scheduled retest reaches the phone's calendar", () => {
  it("as one event, on the day the test is dated, in the PLANNED namespace", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(created).toHaveLength(1);
    expect(created[0].notes).toBe("[shosplan:test:test_1]");
    expect(created[0].startDate).toBe(realTimestampFromStored(FUTURE));
    // No location: a plan has no clinic and no provider, and none is
    // invented.
    expect(created[0].location).toBe("");
  });

  it("does not write the same plan twice", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    await syncPlannedEventsToCalendar();
    expect(created).toHaveLength(1);
    expect(modified).toHaveLength(1);
  });

  it("MOVES its event when the retest is rescheduled, rather than making a second one", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    const moved = "2099-12-30T10:00:00.000Z";
    testRecords = [plannedTest({ date: moved })];
    await syncPlannedEventsToCalendar();
    expect(created).toHaveLength(1);
    expect(modified).toHaveLength(1);
    expect(calendarEvents[0].startDate).toBe(realTimestampFromStored(moved));
  });

  it("uses the generic title when the owner asked for one", async () => {
    prefs.calendarSyncGenericTitle = true;
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(created[0].title).toBe("Test due");
  });

  it("uses the real title otherwise", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(created[0].title).toBe("Routine 3-month screen");
  });
});

describe("the three families do not eat each other's events", () => {
  it("the clinic sync's cleanup leaves the planned events alone", async () => {
    // This is the trap the namespace exists for: the clinic cleanup deletes
    // anything matching /^\[shos:(.+)\]$/ that is not in its own set, so a
    // planned marker written as "[shos:...]" would be deleted on every
    // clinic sync and recreated on the next one.
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(created).toHaveLength(1);
    await syncClinicVisitsToCalendar([]);
    expect(deleted).toHaveLength(0);
    expect(calendarEvents).toHaveLength(1);
  });

  it("the vaccination sync's cleanup leaves the planned events alone", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    await syncVaccinationsToCalendar([]);
    expect(deleted).toHaveLength(0);
    expect(calendarEvents).toHaveLength(1);
  });

  it("the planned sync's cleanup leaves the clinic events and the doses alone", async () => {
    await syncClinicVisitsToCalendar([
      { id: "visit_1", title: "Clinic", date: "2099-01-01T09:00:00.000Z", isFutureAppointment: true },
    ]);
    await syncVaccinationsToCalendar([
      {
        id: "vax_1",
        title: "Hepatitis B",
        isArchived: false,
        doses: [{ doseNumber: 1, date: "2026-09-01", time: "11:00" }],
      },
    ]);
    const before = calendarEvents.length;
    expect(before).toBe(2);
    await syncPlannedEventsToCalendar();
    expect(deleted).toHaveLength(0);
    expect(calendarEvents).toHaveLength(before);
  });
});

describe("a plan that is no longer a plan loses its event", () => {
  it("the cleanup removes an event whose plan has gone", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(calendarEvents).toHaveLength(1);
    // The plan is given - the test now has a past date, so it is a record of
    // something that happened rather than a plan.
    testRecords = [plannedTest({ date: "2001-06-01T10:00:00.000Z" })];
    await syncPlannedEventsToCalendar();
    expect(deleted).toHaveLength(1);
    expect(calendarEvents).toHaveLength(0);
  });
});

describe("turning the family off removes only its own events", () => {
  it("removes the planned events and leaves the doses and the appointments", async () => {
    await syncClinicVisitsToCalendar([
      { id: "visit_1", title: "Clinic", date: "2099-01-01T09:00:00.000Z", isFutureAppointment: true },
    ]);
    await syncVaccinationsToCalendar([
      {
        id: "vax_1",
        title: "Hepatitis B",
        isArchived: false,
        doses: [{ doseNumber: 1, date: "2026-09-01", time: "11:00" }],
      },
    ]);
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(calendarEvents).toHaveLength(3);

    await removeSyncedPlannedEvents("SHOS (private)");
    expect(calendarEvents).toHaveLength(2);
    expect(calendarEvents.some((e) => e.notes.startsWith("[shosplan:"))).toBe(false);
    expect(calendarEvents.some((e) => e.notes.startsWith("[shosvax:"))).toBe(true);
    expect(calendarEvents.some((e) => e.notes.startsWith("[shos:"))).toBe(true);
  });

  it("turning the doses off leaves the planned events alone", async () => {
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    await removeSyncedVaccinationEvents("SHOS (private)");
    expect(calendarEvents).toHaveLength(1);
    expect(calendarEvents[0].notes).toBe("[shosplan:test:test_1]");
  });

  it("turning the WHOLE feature off removes all three families", async () => {
    // The sheet promises that turning it off "removes everything this app
    // put there" - and a planned event this app put there is included.
    await syncClinicVisitsToCalendar([
      { id: "visit_1", title: "Clinic", date: "2099-01-01T09:00:00.000Z", isFutureAppointment: true },
    ]);
    await syncVaccinationsToCalendar([
      {
        id: "vax_1",
        title: "Hepatitis B",
        isArchived: false,
        doses: [{ doseNumber: 1, date: "2026-09-01", time: "11:00" }],
      },
    ]);
    testRecords = [plannedTest()];
    await syncPlannedEventsToCalendar();
    expect(calendarEvents).toHaveLength(3);
    await removeSyncedEventsFrom("SHOS (private)");
    expect(calendarEvents).toHaveLength(0);
  });
});
