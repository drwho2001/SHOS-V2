// Coverage for the vaccination family's calendar sync (t130) - one event per
// DOSE on the phone's real calendar.
//
// WHY THIS FILE IS ITS OWN THING, and not more cases in calendarSyncOffset:
// the two families behave DIFFERENTLY in three ways that each break a
// shared assumption, and every one of them is a silent failure:
//
//   1. THE PLUGIN'S DEFAULT WINDOW IS A TRAP HERE. @capacitor/calendar's
//      findEvents() defaults to now MINUS 182 DAYS to now plus 2 years.
//      Clinic visits are always in the future, so that window covers them.
//      A dose is a PAST event, and one older than six months falls outside
//      the window - so the "do I already have this event?" lookup answers
//      "no" and EVERY sync creates a SECOND event for the same dose. The
//      duplicate is invisible until the dose ages past six months, and then
//      it happens on every single sync.
//   2. THE MARKER NAMESPACES COLLIDE IF THEY ARE NOT SEPARATE. The clinic
//      cleanup deletes any event whose notes match /^\[shos:(.+)\]$/ when the
//      id is not in the current set - so a vaccination marker inside those
//      brackets would be deleted by every clinic sync, and recreated by the
//      next one.
//   3. A DOSE'S DATE IS NOT A STORED DATETIME. It is a plain day key
//      ("2026-09-01") from a date input, so the fake-UTC reading has to be
//      built before it goes through the stored-frame helper.
//
// The mock below keeps a FAKE PHONE CALENDAR rather than returning a
// canned list, so the "does the event already exist" lookup, the move-on-
// edit, and the cleanup pass are all exercised against real state - a mock
// that always returns "nothing there" would make the duplicate bug
// impossible to see.
import { describe, it, expect, beforeEach, vi } from "vitest";

// The local wall-clock reading matters here (a dose is a local day, and the
// calendar shows the local day), so the zone is pinned. The honest limit,
// documented in calendarSyncOffset.test.js: in UTC the offset is 0, so a
// naive parse and the correct one are the same instant - which is why the
// assertions below compare the produced epoch with the helper's OWN answer
// rather than only reading the date back.
process.env.TZ = "Europe/London";

const created = [];
const modified = [];
const deleted = [];
let calendarEvents = [];
let findCalls = [];

vi.mock("@capacitor/calendar", () => ({
  Calendar: {
    listCalendars: async () => ({ calendars: [{ id: "cal1", name: "SHOS (private)" }] }),
    createCalendar: async () => ({ id: "cal1" }),
    findEvents: async (opts = {}) => {
      findCalls.push(opts);
      // The real plugin's notes filter is a case-insensitive SUBSTRING match
      // (LIKE %needle%), and there is no id filter at all.
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

let prefs = { calendarSyncEnabled: true, calendarSyncVaccinations: true, calendarSyncGenericTitle: false, calendarSyncTargetName: null };

vi.mock("../repositories/appPreferencesRepository.js", () => ({
  AppPreferencesRepository: {
    getPreferences: async () => ({ ...prefs }),
    update: async (changes) => { prefs = { ...prefs, ...changes }; },
  },
}));

const { syncVaccinationsToCalendar, removeSyncedEventsFrom, removeSyncedVaccinationEvents } =
  await import("./calendarSyncService");
const { realTimestampFromStored } = await import("../calculations/dateInputHelpers.js");

/** A vaccination with a dose series. */
function vaccination(overrides = {}) {
  return {
    id: "vax_1",
    title: "Hepatitis B",
    vaccine: "Hepatitis B",
    isArchived: false,
    doses: [{ doseNumber: 1, date: "2026-09-01", time: "11:00", provider: "56 Dean Street" }],
    ...overrides,
  };
}

beforeEach(() => {
  created.length = 0;
  modified.length = 0;
  deleted.length = 0;
  calendarEvents = [];
  findCalls = [];
  prefs = { calendarSyncEnabled: true, calendarSyncVaccinations: true, calendarSyncGenericTitle: false, calendarSyncTargetName: null };
});

describe("a dose becomes one calendar event, on the day it was given", () => {
  it("writes the dose's own time, on the dose's own day", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    expect(created).toHaveLength(1);
    // The helper's OWN answer is the definition of "the real instant of that
    // wall clock" - and it is what the naive parse disagrees with in every
    // zone whose offset is not zero.
    expect(created[0].startDate).toBe(realTimestampFromStored("2026-09-01T11:00:00.000Z"));
    // And the question a user actually asks: what DAY does the calendar show?
    expect(new Date(created[0].startDate).getDate()).toBe(1);
    expect(new Date(created[0].startDate).getMonth()).toBe(8); // September, 0-indexed
    expect(new Date(created[0].startDate).getHours()).toBe(11);
  });

  it("a dose with no time is local midnight, not the previous day", async () => {
    await syncVaccinationsToCalendar([vaccination({ doses: [{ doseNumber: 1, date: "2026-09-01" }] })]);
    expect(created[0].startDate).toBe(realTimestampFromStored("2026-09-01T00:00:00.000Z"));
    expect(new Date(created[0].startDate).getDate()).toBe(1);
  });

  it("a four-week course is FOUR events, on four days", async () => {
    const doses = [1, 2, 3, 4].map((n) => ({ doseNumber: n, date: `2026-09-0${n}` }));
    const result = await syncVaccinationsToCalendar([vaccination({ doses })]);
    expect(created).toHaveLength(4);
    expect(result.count).toBe(4);
    expect(calendarEvents.map((e) => new Date(e.startDate).getDate())).toEqual([1, 2, 3, 4]);
  });

  it("TWO DIFFERENT VACCINES ON THE SAME DAY ARE TWO EVENTS", async () => {
    // The owner's own case: mpox and bexcero on the same day are two
    // different things that happened, so they are two events - not one
    // merged one, and not one of them lost.
    const mpox = vaccination({ id: "vax_mpox", title: "Mpox", vaccine: "Mpox", doses: [{ doseNumber: 1, date: "2026-09-01" }] });
    const bexcero = vaccination({ id: "vax_bex", title: "Bexcero", vaccine: "Bexcero", doses: [{ doseNumber: 1, date: "2026-09-01" }] });
    await syncVaccinationsToCalendar([mpox, bexcero]);
    expect(created).toHaveLength(2);
    expect(calendarEvents.map((e) => e.title).sort()).toEqual(["Bexcero", "Mpox"]);
    // Both on the same day.
    expect(calendarEvents.every((e) => new Date(e.startDate).getDate() === 1)).toBe(true);
  });
});

describe("the marker namespaces cannot delete each other", () => {
  it("a vaccination event is NOT deleted by the clinic-visit cleanup", async () => {
    // The clinic cleanup deletes anything matching /^\[shos:(.+)\]$/ whose id
    // is not in the current set. A vaccination marker must not match it.
    calendarEvents = [{ id: "ev_vax", notes: "[shosvax:vax_1:1]", calendarName: "SHOS (private)" }];
    const { syncClinicVisitsToCalendar } = await import("./calendarSyncService");
    await syncClinicVisitsToCalendar([]);
    expect(deleted.map((d) => d.id)).not.toContain("ev_vax");
  });

  it("a clinic-visit event is NOT deleted by the vaccination cleanup", async () => {
    calendarEvents = [{ id: "ev_visit", notes: "[shos:visit_1]", calendarName: "SHOS (private)" }];
    await syncVaccinationsToCalendar([vaccination()]);
    expect(deleted.map((d) => d.id)).not.toContain("ev_visit");
  });

  it("turning the whole feature off removes BOTH families", async () => {
    // The sheet promises that turning it off removes everything this app put
    // there. A prefix test that only knew the clinic namespace would leave
    // the dose events behind in a calendar the user has stopped using.
    calendarEvents = [
      { id: "ev_visit", notes: "[shos:visit_1]", calendarName: "SHOS (private)" },
      { id: "ev_vax", notes: "[shosvax:vax_1:1]", calendarName: "SHOS (private)" },
    ];
    await removeSyncedEventsFrom("SHOS (private)");
    expect(deleted.map((d) => d.id).sort()).toEqual(["ev_vax", "ev_visit"]);
  });

  it("turning the doses off leaves the appointments alone", async () => {
    calendarEvents = [
      { id: "ev_visit", notes: "[shos:visit_1]", calendarName: "SHOS (private)" },
      { id: "ev_vax", notes: "[shosvax:vax_1:1]", calendarName: "SHOS (private)" },
    ];
    await removeSyncedVaccinationEvents("SHOS (private)");
    expect(deleted.map((d) => d.id)).toEqual(["ev_vax"]);
  });
});

describe("the reads use a window wide enough for a real dose", () => {
  it("every findEvents call passes an explicit window", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    expect(findCalls.length).toBeGreaterThan(0);
    for (const call of findCalls) {
      expect(typeof call.startDate, "a findEvents without an explicit window uses the plugin's 182-day default").toBe("number");
      expect(typeof call.endDate, "a findEvents without an explicit window uses the plugin's default").toBe("number");
    }
    // And the window is wide enough to hold a dose from years ago.
    const wide = findCalls[0];
    expect(wide.startDate).toBe(0);
  });

  it("a dose older than the plugin's default window is FOUND, not duplicated", async () => {
    // The failure this prevents: the dose is two years old, the plugin's
    // default window does not reach it, the lookup answers "no", and a
    // SECOND event is created - on every sync, forever.
    const old = vaccination({ doses: [{ doseNumber: 1, date: "2024-03-05" }] });
    await syncVaccinationsToCalendar([old]);
    expect(created).toHaveLength(1);
    // A second sync must find the first event and MOVE it, not add another.
    created.length = 0;
    await syncVaccinationsToCalendar([old]);
    expect(created).toHaveLength(0);
    expect(modified).toHaveLength(1);
    expect(calendarEvents).toHaveLength(1);
  });
});

describe("editing a dose moves its event", () => {
  it("a changed date rewrites the same event rather than adding one", async () => {
    const before = vaccination({ doses: [{ doseNumber: 1, date: "2026-09-01" }] });
    await syncVaccinationsToCalendar([before]);
    expect(created).toHaveLength(1);
    const after = vaccination({ doses: [{ doseNumber: 1, date: "2026-10-15" }] });
    await syncVaccinationsToCalendar([after]);
    expect(created).toHaveLength(1); // still only the first one
    expect(modified).toHaveLength(1);
    expect(calendarEvents).toHaveLength(1);
    expect(new Date(calendarEvents[0].startDate).getDate()).toBe(15);
  });
});

describe("archived and deleted doses lose their events", () => {
  it("an archived vaccination has no event, and a stale one is removed", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    expect(calendarEvents).toHaveLength(1);
    await syncVaccinationsToCalendar([vaccination({ isArchived: true })]);
    expect(calendarEvents).toHaveLength(0);
    expect(deleted).toHaveLength(1);
  });

  it("a deleted vaccination has no event", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    await syncVaccinationsToCalendar([]);
    expect(calendarEvents).toHaveLength(0);
  });

  it("a restored vaccination gets its event back", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    await syncVaccinationsToCalendar([]);
    expect(calendarEvents).toHaveLength(0);
    await syncVaccinationsToCalendar([vaccination()]);
    expect(calendarEvents).toHaveLength(1);
  });
});

describe("what the event actually says", () => {
  it("the notes are the MARKER and nothing else", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    // The notes are where the marker lives, and the plugin appends a URL to
    // them on Android - so a vaccine name or a clinic in here would be
    // disclosed to whoever can see the event.
    expect(created[0].notes).toMatch(/^\[shosvax:vax_1:1\]$/);
    expect(created[0].notes).not.toContain("Hepatitis");
    expect(created[0].notes).not.toContain("Dean Street");
  });

  it("the generic setting blanks BOTH the vaccine name and the clinic", async () => {
    prefs = { ...prefs, calendarSyncGenericTitle: true };
    await syncVaccinationsToCalendar([vaccination()]);
    expect(created[0].title).toBe("Vaccination");
    // The provider is a NAMED CLINIC - "56 Dean Street" is the most
    // identifying field of the three, and the generic setting exists to
    // stop exactly this kind of thing reaching a lock screen.
    expect(created[0].location).toBe("");
  });

  it("without the generic setting the real vaccine and clinic are used", async () => {
    await syncVaccinationsToCalendar([vaccination()]);
    expect(created[0].title).toBe("Hepatitis B");
    expect(created[0].location).toBe("56 Dean Street");
  });
});

describe("the feature is off unless the owner asked for it", () => {
  it("does nothing when the doses' own switch is off", async () => {
    prefs = { ...prefs, calendarSyncVaccinations: false };
    const result = await syncVaccinationsToCalendar([vaccination()]);
    expect(result.synced).toBe(false);
    expect(created).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  it("does nothing when the master switch is off", async () => {
    prefs = { ...prefs, calendarSyncEnabled: false };
    const result = await syncVaccinationsToCalendar([vaccination()]);
    expect(result.synced).toBe(false);
    expect(created).toHaveLength(0);
  });
});
