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

let Calendar = null;
let pluginLoadAttempted = false;

async function getPlugin() {
  if (pluginLoadAttempted) return Calendar;
  pluginLoadAttempted = true;
  try {
    const mod = await import("@capacitor/calendar");
    Calendar = mod.Calendar;
  } catch {
    console.warn("[calendarSyncService] @capacitor/calendar not available — calendar sync will not run in this environment.");
  }
  return Calendar;
}

export const SHOS_CALENDAR_NAME = "SHOS (private)";
const MARKER_PREFIX = "[shos:";

function markerFor(visitId) {
  return `${MARKER_PREFIX}${visitId}]`;
}

// Real device/permission check happens here at toggle-on time — never
// just flips a stored flag and hopes. Returns { available, reason }.
export async function checkCalendarAvailable() {
  const plugin = await getPlugin();
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
  const plugin = await getPlugin();
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
  const targetName = AppPreferencesRepository.getPreferences().calendarSyncTargetName;
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
  const eventOptions = {
    title: visit.title || "Clinic appointment",
    location: visit.location || "",
    notes: markerFor(visit.id),
    startDate: new Date(visit.date).getTime(),
    // No real end time is ever recorded for a Clinic Visit — a
    // reasonable 1-hour default, same as most calendar apps use for a
    // bare appointment with no explicit duration.
    endDate: new Date(visit.date).getTime() + 3600000,
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
  if (!AppPreferencesRepository.getPreferences().calendarSyncEnabled) return { synced: false };
  const plugin = await getPlugin();
  if (!plugin) return { synced: false };
  const calendar = await resolveTargetCalendar(plugin);
  const now = new Date();
  const booked = visits.filter((v) => !v.isArchived && v.isFutureAppointment && v.date && new Date(v.date) > now);
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
  const plugin = await getPlugin();
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
  const targetName = AppPreferencesRepository.getPreferences().calendarSyncTargetName || SHOS_CALENDAR_NAME;
  await removeSyncedEventsFrom(targetName);
}
