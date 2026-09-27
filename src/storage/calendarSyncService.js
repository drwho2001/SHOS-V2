// calendarSyncService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "calendar sync could be good, if ensured kept separate/
// private and never accidentally shared to anyone else unless
// deliberately and explicitly said so/selected." Syncs booked clinic
// appointments (Clinic Visits with isFutureAppointment on) to the
// phone's real native calendar app, via @capacitor/calendar (the
// official first-party plugin — chosen specifically over community
// alternatives for that reason).
//
// TWO SYNC TARGETS, per the follow-up ask ("I still want to have the
// option to share with a calendar, but... not sure if this is
// something you can force, if not allow sync with warning"):
//
// 1. DEFAULT — this app's own "SHOS (private)" calendar, created via
//    createCalendar(). THE PRIVACY GUARANTEE here is structural, not
//    just a naming convention — verified directly against the
//    plugin's own native Android source (not assumed): createCalendar()
//    hardcodes CalendarContract.ACCOUNT_TYPE_LOCAL. A local-type
//    calendar is never tied to a Google/cloud account and cannot sync
//    anywhere or be shared with anyone by itself — the only way an
//    event leaves the device is the user manually sharing that one
//    event themselves, a deliberate act.
// 2. OPTIONAL — any EXISTING calendar already on the device (whatever
//    listCalendars() actually returns — could include a Google/
//    Outlook/Apple-synced calendar if that account is already added
//    on the phone; Notion is NOT a real option here, it isn't a
//    native OS calendar account the way those are, so it can never
//    appear in this list regardless of anything this app does).
//    HONEST LIMIT, stated plainly: once an event is written to an
//    EXTERNAL calendar, this app has no control at all over that
//    calendar's own sharing settings — whether it's private or shared
//    with a family/work group is entirely up to how that account was
//    already configured, outside this app's reach. Settings' own UI
//    surfaces a real warning plus provider guidance before this
//    option can be picked, since it genuinely can't be forced safe
//    the way option 1 can.
//
// The private calendar is named "SHOS (private)" specifically so it
// also reads as obviously app-specific/private if the user ever opens
// their real calendar app and sees it listed there, not just
// invisibly safe under the hood.
//
// IDEMPOTENT SYNC: each event's `notes` field carries a hidden marker
// ("[shos:<clinic visit id>]") so re-syncing (on every relevant save,
// or catching up on app load) finds and UPDATES the same real calendar
// event instead of creating a duplicate every time.
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository.js";
// FIXED 27 Sep 2026 — a Clinic Visit's `date` is one of this app's fake-UTC
// stored values, not a real instant. Reading it with `new Date(...)` and
// comparing or writing the result as an epoch re-applies the device's UTC
// offset. See realTimestampFromStored's own header for the full explanation.
import { realTimestampFromStored } from "../calculations/dateInputHelpers.js";

let Calendar = null;
let pluginLoadAttempted = false;

// FIXED — real bug found live-debugging notifications on a real device
// (chrome://inspect showed "X.then() is not implemented on android" as
// an uncaught rejection for other plugins with this exact pattern —
// see notificationService.js's own getPlugin() comment for the full
// mechanism). This used to `return Calendar;` — the bare Capacitor
// plugin proxy — as an async function's own return value, which is
// exactly the shape that triggers it. Wrapped instead.
async function getPlugin() {
  if (pluginLoadAttempted) return { plugin: Calendar };
  pluginLoadAttempted = true;
  try {
    const mod = await import("@capacitor/calendar");
    Calendar = mod.Calendar;
  } catch {
    console.warn("[calendarSyncService] @capacitor/calendar not available — calendar sync will not run in this environment.");
  }
  return { plugin: Calendar };
}

export const SHOS_CALENDAR_NAME = "SHOS (private)";
const MARKER_PREFIX = "[shos:";

function markerFor(visitId) {
  return `${MARKER_PREFIX}${visitId}]`;
}

// Real device/permission check happens here at toggle-on time — never
// just flips a stored flag and hopes. Returns { available, reason }.
export async function checkCalendarAvailable() {
  const { plugin } = await getPlugin();
  if (!plugin) return { available: false, reason: "Calendar sync isn't available in this environment." };
  const status = await plugin.checkPermissions();
  if (status.readCalendar === "granted" && status.writeCalendar === "granted") return { available: true };
  const requested = await plugin.requestPermissions();
  if (requested.readCalendar === "granted" && requested.writeCalendar === "granted") return { available: true };
  return { available: false, reason: "Calendar permission was denied." };
}

// Real calendars actually on the device (requires permission already
// granted — call checkCalendarAvailable() first) — what Settings' own
// picker offers beyond the private default. Could be empty (no other
// accounts added on this phone), could include a Google/Outlook/
// Apple-synced calendar if that account already exists here.
export async function listAvailableCalendars() {
  const { plugin } = await getPlugin();
  if (!plugin) return [];
  const { calendars } = await plugin.listCalendars();
  return calendars.filter((c) => c.name !== SHOS_CALENDAR_NAME);
}

async function ensureShosCalendar(plugin) {
  const { calendars } = await plugin.listCalendars();
  const existing = calendars.find((c) => c.name === SHOS_CALENDAR_NAME);
  if (existing) return existing.id;
  const { id } = await plugin.createCalendar({ name: SHOS_CALENDAR_NAME, color: "#009F4D" });
  return id;
}

// Resolves which calendar to actually sync into right now: the
// user-picked external one IF it's still really there, otherwise the
// private default (auto-created if needed) — a picked calendar that
// later disappears (e.g. its account was removed from the phone)
// falls safely back to private rather than silently failing.
async function resolveTargetCalendar(plugin) {
  const targetName = (await AppPreferencesRepository.getPreferences()).calendarSyncTargetName;
  if (targetName) {
    const { calendars } = await plugin.listCalendars();
    const found = calendars.find((c) => c.name === targetName);
    if (found) return { id: found.id, name: found.name };
  }
  const id = await ensureShosCalendar(plugin);
  return { id, name: SHOS_CALENDAR_NAME };
}

async function findSyncedEventId(plugin, calendarName, visitId) {
  const { events } = await plugin.findEvents({ notes: markerFor(visitId), calendarName });
  return events[0]?.id || null;
}

// Creates or updates the one calendar event for a booked visit. Safe
// to call any time a Clinic Visit is saved — idempotent via the
// marker above, so a repeated call on an unchanged visit just
// no-op-updates the same real event rather than duplicating it.
async function syncOneVisit(plugin, calendar, visit) {
  // CHANGED — real ask from a security audit finding: a visit's real
  // title (free text, could be explicit — "e.g. Routine screening" is
  // only a placeholder) traveling into a calendar event means it can
  // surface on a lock-screen notification or a synced calendar's own
  // smart features, independent of whether that calendar is shared
  // with anyone — a risk the existing calendar-sharing warning doesn't
  // cover. Opt-in generic title, off by default (unchanged behavior
  // unless explicitly turned on).
  const useGenericTitle = (await AppPreferencesRepository.getPreferences()).calendarSyncGenericTitle;
  const eventOptions = {
    title: useGenericTitle ? "Clinic appointment" : (visit.title || "Clinic appointment"),
    location: visit.location || "",
    notes: markerFor(visit.id),
      // FIXED 27 Sep 2026 — `new Date(visit.date).getTime()` is the exact
      // fake-UTC-vs-real-instant mistake realTimestampFromStored() exists to
      // prevent. A visit booked for 14:00 local is stored as
      // "…T14:00:00.000Z", which parses as 14:00 UTC — one hour LATER than
      // the real moment in BST. The old code wrote that straight to the
      // phone calendar, so every appointment landed an hour off for eight
      // months of the year.
      //
      // This is the only place in the app where a wrong timestamp escapes
      // the app entirely, and it is the one a clinician would read off the
      // patient's phone at an appointment. Every other consumer of a stored
      // datetime (displays, lockout maths, adherence) was already using the
      // correct helper; this one was missed.
      startDate: realTimestampFromStored(visit.date),
      // No real end time is ever recorded for a Clinic Visit — a
      // reasonable 1-hour default, same as most calendar apps use for a
      // bare appointment with no explicit duration. 3600000ms is
      // deliberately not converted to a calendar-day figure: this is a real
      // elapsed duration, not a stored calendar date, so DST does not apply.
      endDate: realTimestampFromStored(visit.date) + 3600000,
    calendarId: calendar.id,
  };
  const existingId = await findSyncedEventId(plugin, calendar.name, visit.id);
  if (existingId) {
    await plugin.modifyEvent({ filter: { notes: markerFor(visit.id), calendarName: calendar.name }, newEvent: eventOptions });
  } else {
    await plugin.createEvent(eventOptions);
  }
}

// The one function callers actually use — reads every real Clinic
// Visit and brings the target calendar in line: booked
// (isFutureAppointment, still in the future) visits get created/
// updated. Cleanup deliberately compares against the REAL calendar's
// own current contents (via findEvents), not just "visits still in
// the list but no longer booked" — a visit that was permanently
// DELETED isn't in the list at all any more, so that comparison alone
// would silently orphan its calendar event forever. Reading what's
// actually in the calendar and checking each one's marker against the
// real current booked-id set catches every case that removes/un-books
// a visit uniformly: edited off isFutureAppointment, archived,
// deleted, or its date moved to the past. Called on Home mount (catch
// up) and right after Clinic Visits' own save/archive/delete/undo —
// see that module's comments.
export async function syncClinicVisitsToCalendar(visits) {
  // Self-gated on the preference so every call site (Home's mount,
  // Clinic Visits' own save) doesn't need to separately remember to
  // check it — one place decides whether this feature is actually on.
  if (!(await AppPreferencesRepository.getPreferences()).calendarSyncEnabled) return { synced: false };
  const { plugin } = await getPlugin();
  if (!plugin) return { synced: false };
  const calendar = await resolveTargetCalendar(plugin);
  // FIXED 27 Sep 2026 — same fake-UTC/real-instant mixing, and this one had a
  // second consequence beyond a shifted time.
  //
  // An earlier draft of this comment claimed the filter "judged an appointment
  // already past" and so deleted it. MEASURED, that is only half the story, and
  // in the wrong direction for a positive offset: `new Date(stored)` is LATER
  // than the real moment whenever the offset is positive, so the naive filter
  // keeps a visit LONGER, not sooner. The real harm depends on the SIGN:
  //
  //   offset > 0 (Europe/London BST, Australia/Sydney AEDT)
  //     naive is LATER -> an appointment that has genuinely finished is still
  //     treated as upcoming, so it stays in `booked` and is NEVER cleaned up.
  //     A stale, past appointment sits in the calendar indefinitely.
  //
  //   offset < 0 (America/New_York EDT, and every western zone)
  //     naive is EARLIER -> an appointment genuinely still ahead of us can be
  //     judged already past. The filter drops it from `booked`, and because the
  //     cleanup pass below deletes any calendar event whose id is not in
  //     `booked`, an event that had ALREADY been created for it is DELETED.
  //     The appointment silently vanishes from the user's calendar.
  //
  // So there are two distinct real bugs here, in opposite directions, and the
  // more serious one (silent deletion) is invisible in the UK - the zone this
  // was built and tested in, and the only one it was reported from. That is
  // why it is now pinned by boundary tests built on realTimestampFromStored's
  // own answer rather than on a hand-picked clock time, and why the fix is a
  // helper call rather than a fudge factor: a fudge would have to know the
  // offset's sign to know which way to apply it.
  const now = Date.now();
  const booked = visits.filter((v) => !v.isArchived && v.isFutureAppointment && v.date && realTimestampFromStored(v.date) > now);
  const bookedIds = new Set(booked.map((v) => v.id));

  for (const visit of booked) await syncOneVisit(plugin, calendar, visit);

  const { events } = await plugin.findEvents({ calendarName: calendar.name });
  for (const event of events) {
    const match = /^\[shos:(.+)\]$/.exec(event.notes || "");
    if (match && !bookedIds.has(match[1])) {
      await plugin.deleteEvent({ id: event.id });
    }
  }
  return { synced: true, count: booked.length };
}

// Real ask's own "never accidentally shared unless deliberately
// selected" — turning the feature back OFF (or switching which
// calendar it targets) should genuinely remove what was shared there,
// not leave stale copies sitting in a real calendar forever. Removes
// only THIS app's own synced events (matched by marker) — an external
// calendar the user picked is never deleted wholesale, only ever the
// events this app itself put there; the private SHOS calendar IS
// app-owned, so that one also gets deleted outright once it's empty,
// rather than lingering as an empty calendar forever.
export async function removeSyncedEventsFrom(calendarName) {
  const { plugin } = await getPlugin();
  if (!plugin) return;
  const { calendars } = await plugin.listCalendars();
  if (!calendars.some((c) => c.name === calendarName)) return;
  const { events } = await plugin.findEvents({ calendarName });
  for (const event of events) {
    if (MARKER_PREFIX && (event.notes || "").startsWith(MARKER_PREFIX)) {
      await plugin.deleteEvent({ id: event.id });
    }
  }
  if (calendarName === SHOS_CALENDAR_NAME) {
    await plugin.deleteCalendar({ name: SHOS_CALENDAR_NAME });
  }
}

// Convenience for the common "turn the whole feature off" case —
// cleans up whichever calendar was actually in use (private or a
// picked external one), not just the private default.
export async function removeAllSyncedEvents() {
  const targetName = (await AppPreferencesRepository.getPreferences()).calendarSyncTargetName || SHOS_CALENDAR_NAME;
  await removeSyncedEventsFrom(targetName);
}
