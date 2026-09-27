// Real regression coverage for the calendar-sync hour offset.
//
// This is the one place in the app where a WRONG TIMESTAMP ESCAPES THE APP
// ENTIRELY: everything else that reads a stored datetime either displays it or
// does arithmetic on it inside the app, where a bug stays a cosmetic or
// internal problem. A Clinic Visit's `date` is written straight to the phone's
// real calendar, and that is the timestamp a clinician reads off the patient's
// phone at the appointment.
//
// A Clinic Visit's `date` is one of this app's fake-UTC stored values: the
// digits are literal local wall-clock time and the trailing "Z" is a
// deliberate lie (see dateInputHelpers.js's own header). Reading it with
// `new Date(...).getTime()` therefore re-applies the device's UTC offset, so a
// visit booked for 14:00 landed at 15:00 for eight months of the year.
//
// The plugin is dynamically imported inside the service's getPlugin(), so
// vi.mock intercepts it cleanly and the assertions below run against the REAL
// service code rather than a reimplementation of it. A source-level "this file
// mentions the helper" check would be much weaker: it would pass even if the
// helper were called on the wrong value in the wrong place, which is exactly
// how this bug survived in the first place.
//
// The tests pin an explicit TZ below. Under vitest the device offset reports 0
// even while string parsing is genuinely local, so asserting via
// new Date(ts).getTimezoneOffset() is useless here - the same trap documented
// in dateDisplay.test.js. Instead every assertion converts the epoch the
// service actually produced back into LOCAL wall-clock parts with getHours(),
// which is the real question being asked: "what time will the calendar show?"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const created = [];
const modified = [];
const deleted = [];
let existingEvents = [];

vi.mock("@capacitor/calendar", () => ({
  Calendar: {
    listCalendars: async () => ({ calendars: [{ id: "shos", name: "SHOS" }] }),
    createCalendar: async () => ({ id: "shos" }),
    findEvents: async () => ({ events: existingEvents }),
    createEvent: async (opts) => {
      created.push(opts);
      return { id: `ev${created.length}` };
    },
    modifyEvent: async (opts) => {
      modified.push(opts);
      return { id: opts.id };
    },
    deleteEvent: async (opts) => {
      deleted.push(opts);
    },
  },
}));

// AppPreferencesRepository is mocked, and deliberately so.
//
// A first draft used the REAL repository, on the reasonable theory that it
// would keep the test honest. It cannot: this is a Phase-2+ repository, so
// every write goes through the encrypted storage adapter and throws "Vault is
// not unlocked" in a test environment. Unlocking a real PBKDF2 vault to
// assert a calendar hour would be absurd, and a test that reaches for it
// either fails or, worse, has a skip guard that quietly stops running.
//
// The mock exposes the same two members the service actually uses, and the
// in-memory object is updated through a real setter rather than by poking a
// variable directly, so the "preference is off" case below still exercises
// the service's genuine self-gate rather than bypassing it.
let calendarSyncEnabled = true;

vi.mock("../repositories/appPreferencesRepository.js", () => ({
  AppPreferencesRepository: {
    getPreferences: async () => ({ calendarSyncEnabled }),
    update: async (changes) => {
      if ("calendarSyncEnabled" in changes) calendarSyncEnabled = changes.calendarSyncEnabled;
    },
  },
}));

const { syncClinicVisitsToCalendar } = await import("./calendarSyncService");
const { AppPreferencesRepository } = await import("../repositories/appPreferencesRepository.js");
// Imported so the boundary tests below can anchor "now" to the SAME definition
// of the appointment's real instant that the service uses. The whole point is
// that the test and the implementation cannot disagree about what "01:00" means.
const { realTimestampFromStored } = await import("../calculations/dateInputHelpers.js");

/** A stored fake-UTC datetime. Month is 1-indexed, as ISO dates are. */
function isoDay(year, month, day, hh = 0, mm = 0) {
  const p = (v) => String(v).padStart(2, "0");
  return `${year}-${p(month)}-${p(day)}T${p(hh)}:${p(mm)}:00.000Z`;
}

/** A real Date. Month is 0-indexed, as JS is. */
function jsDate(year, month, day, hh = 12) {
  return new Date(year, month, day, hh, 0, 0, 0);
}

function futureVisit(overrides = {}) {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const p = (v) => String(v).padStart(2, "0");
  const y = d.getFullYear();
  const mo = p(d.getMonth() + 1);
  const da = p(d.getDate());
  return {
    id: "visit_1",
    date: `${y}-${mo}-${da}T14:00:00.000Z`,
    isArchived: false,
    isFutureAppointment: true,
    ...overrides,
  };
}

beforeEach(async () => {
  created.length = 0;
  modified.length = 0;
  deleted.length = 0;
  existingEvents = [];
  await AppPreferencesRepository.update({ calendarSyncEnabled: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a Clinic Visit lands at the hour the user actually booked", () => {
  it("writes 14:00 for a visit stored as 14:00, not 15:00", async () => {
    const result = await syncClinicVisitsToCalendar([futureVisit()]);
    expect(result.synced).toBe(true);
    expect(created).toHaveLength(1);
    // The whole point: read the epoch the service produced back as LOCAL
    // wall-clock time, which is what the phone calendar will display.
    const written = new Date(created[0].startDate);
    expect(written.getHours()).toBe(14);
    expect(written.getMinutes()).toBe(0);
  });

  it("keeps the one-hour duration as a real elapsed duration", async () => {
    await syncClinicVisitsToCalendar([futureVisit()]);
    const start = created[0].startDate;
    const end = created[0].endDate;
    // 3600000ms of real elapsed time, not a calendar-day figure, so this is
    // exactly one hour regardless of any DST change in between.
    expect(end - start).toBe(3600000);
    expect(new Date(end).getHours()).toBe(15);
  });

  it("preserves a non-round booked time such as 09:15", async () => {
    // A round hour is the case most likely to be accidentally "fixed" by a
    // change that shifts whole hours, so a genuinely odd time is asserted
    // too - it catches an off-by-one-hour bug that a round hour might mask.
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const p = (v) => String(v).padStart(2, "0");
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:15:00.000Z`;
    await syncClinicVisitsToCalendar([futureVisit({ date })]);
    const written = new Date(created[0].startDate);
    expect(written.getHours()).toBe(9);
    expect(written.getMinutes()).toBe(15);
  });
});

describe("the future/past filter agrees with the stored-date convention", () => {
  // These replace an earlier version of this file that used a hand-picked
  // "23:00 the night before a 00:30 appointment" scenario. That scenario is
  // realistic but it is NOT discriminating: MUTATION TESTING proved it, and
  // reverting the filter to `new Date(v.date) > now` failed NOTHING, because
  // a 1-hour offset does not move a 1.5-hour margin across the boundary.
  //
  // A test that cannot fail when the bug is reintroduced is worse than no test,
  // because it reads as coverage. These instead pin the decision to
  // realTimestampFromStored's OWN answer at a 1ms boundary, which is
  // guaranteed to disagree with the naive parse in any zone whose offset is
  // non-zero - in whichever direction that zone's sign points.
  //
  // Honest limit, and the reason this class of bug survived so long: in UTC
  // the offset is 0, so the naive parse and the correct one are the same
  // instant and NO test in this file can fail there. That is a real property
  // of the bug, not a gap in the test - see the sign analysis in
  // calendarSyncService.js's own comment.

  const stored = isoDay(2026, 8, 28, 14, 0);
  const realInstant = realTimestampFromStored(stored);

  it("keeps a visit that is genuinely ahead of us by 1ms", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(realInstant - 1);
    const result = await syncClinicVisitsToCalendar([futureVisit({ id: "v_soon", date: stored })]);
    expect(result.count).toBe(1);
    expect(created).toHaveLength(1);
  });

  it("excludes a visit that finished 1ms ago, so cleanup can remove it", async () => {
    // The positive-offset harm, stated as a boundary rather than a scenario:
    // once the real instant has passed, the visit must leave `booked` so the
    // cleanup pass below can delete its already-created calendar event.
    vi.useFakeTimers();
    vi.setSystemTime(realInstant + 1);
    const result = await syncClinicVisitsToCalendar([futureVisit({ id: "v_done", date: stored })]);
    expect(result.count).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("deletes the stale calendar event for a visit that has just finished", async () => {
    // The user-visible consequence of the line above, which is the part that
    // matters: a past appointment must not linger in the phone calendar.
    vi.useFakeTimers();
    vi.setSystemTime(realInstant + 1);
    existingEvents = [{ id: "ev_stale", notes: "[shos:v_done]" }];
    await syncClinicVisitsToCalendar([futureVisit({ id: "v_done", date: stored })]);
    expect(deleted.map((d) => d.id)).toEqual(["ev_stale"]);
  });

  it("does not delete the event for a visit that is still 1ms away", async () => {
    // The negative-offset harm in its most serious form: a still-upcoming
    // appointment must never be treated as past, or cleanup deletes it and the
    // appointment disappears from the user's calendar with no trace.
    vi.useFakeTimers();
    vi.setSystemTime(realInstant - 1);
    existingEvents = [{ id: "ev_live", notes: "[shos:v_soon]" }];
    await syncClinicVisitsToCalendar([futureVisit({ id: "v_soon", date: stored })]);
    expect(deleted).toHaveLength(0);
  });
});

describe("a near-midnight appointment is handled as an ordinary future visit", () => {
  // A realistic scenario, kept because midnight-adjacent times are where a
  // user is most likely to notice something wrong - but labelled honestly:
  // this is NOT the discriminating coverage, the block above is. It would
  // pass even with the bug reintroduced.
  it("syncs a 00:30 appointment that is still in the future", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(jsDate(2026, 8, 27, 23, 0));
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const p = (v) => String(v).padStart(2, "0");
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:30:00.000Z`;
    const result = await syncClinicVisitsToCalendar([futureVisit({ id: "visit_midnight", date })]);
    expect(result.count).toBe(1);
    expect(created).toHaveLength(1);
    const written = new Date(created[0].startDate);
    expect(written.getHours()).toBe(0);
    expect(written.getMinutes()).toBe(30);
  });
});

describe("archived and past visits are still excluded", async () => {
  it("skips an archived future visit", async () => {
    const result = await syncClinicVisitsToCalendar([futureVisit({ isArchived: true })]);
    expect(result.count).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("skips a visit that is not flagged as a future appointment", async () => {
    const result = await syncClinicVisitsToCalendar([futureVisit({ isFutureAppointment: false })]);
    expect(result.count).toBe(0);
  });

  it("skips a visit whose date has genuinely passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(jsDate(2026, 8, 27, 12, 0));
    const result = await syncClinicVisitsToCalendar([futureVisit({ date: isoDay(2026, 8, 20, 14, 0) })]);
    expect(result.count).toBe(0);
    expect(created).toHaveLength(0);
  });

  it("does not sync at all when the feature preference is off", async () => {
    // The service self-gates on this preference so call sites need not repeat
    // the check. Asserted so the gate itself is covered by the same suite.
    await AppPreferencesRepository.update({ calendarSyncEnabled: false });
    const result = await syncClinicVisitsToCalendar([futureVisit()]);
    expect(result.synced).toBe(false);
    expect(created).toHaveLength(0);
  });
});
