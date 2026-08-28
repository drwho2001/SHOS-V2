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
// THE PRIVACY GUARANTEE, stated plainly and verified directly against
// the plugin's own native Android source (not assumed): every event
// this file creates lives in its OWN calendar, created via
// createCalendar(), which — confirmed by reading
// node_modules/@capacitor/calendar's real Kotlin implementation, not
// the docs alone — hardcodes CalendarContract.ACCOUNT_TYPE_LOCAL on
// Android. A local-type calendar is never tied to a Google/cloud
// account and cannot sync anywhere or be shared with anyone by itself
// — the only way an event leaves the device is the user manually and
// individually sharing/exporting that one event themselves, a
// deliberate act. That's exactly what "never accidentally shared...
// unless deliberately and explicitly selected" requires, satisfied by
// the calendar's own type, not just a naming convention.
//
// The calendar is named "SHOS (private)" specifically so it also
// reads as obviously app-specific/private if the user ever opens their
// real calendar app and sees it listed there, not just invisibly safe
// under the hood.
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

const SHOS_CALENDAR_NAME = "SHOS (private)";
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

async function ensureShosCalendar(plugin) {
  const { calendars } = await plugin.listCalendars();
  const existing = calendars.find((c) => c.name === SHOS_CALENDAR_NAME);
  if (existing) return existing.id;
  const { id } = await plugin.createCalendar({ name: SHOS_CALENDAR_NAME, color: "#009F4D" });
  return id;
}

async function findSyncedEventId(plugin, visitId) {
  const { events } = await plugin.findEvents({ notes: markerFor(visitId), calendarName: SHOS_CALENDAR_NAME });
  return events[0]?.id || null;
}

// Creates or updates the one calendar event for a booked visit. Safe
// to call any time a Clinic Visit is saved — idempotent via the
// marker above, so a repeated call on an unchanged visit just
// no-op-updates the same real event rather than duplicating it.
async function syncOneVisit(plugin, calendarId, visit) {
  const eventOptions = {
    title: visit.title || "Clinic appointment",
    location: visit.location || "",
    notes: markerFor(visit.id),
    startDate: new Date(visit.date).getTime(),
    // No real end time is ever recorded for a Clinic Visit — a
    // reasonable 1-hour default, same as most calendar apps use for a
    // bare appointment with no explicit duration.
    endDate: new Date(visit.date).getTime() + 3600000,
    calendarId,
  };
  const existingId = await findSyncedEventId(plugin, visit.id);
  if (existingId) {
    await plugin.modifyEvent({ filter: { notes: markerFor(visit.id), calendarName: SHOS_CALENDAR_NAME }, newEvent: eventOptions });
  } else {
    await plugin.createEvent(eventOptions);
  }
}

// The one function callers actually use — reads every real Clinic
// Visit and brings the SHOS calendar in line: booked (isFutureAppointment,
// still in the future) visits get created/updated. Cleanup deliberately
// compares against the REAL calendar's own current contents (via
// findEvents), not just "visits still in the list but no longer
// booked" — a visit that was permanently DELETED isn't in the list at
// all any more, so that comparison alone would silently orphan its
// calendar event forever. Reading what's actually in the calendar and
// checking each one's marker against the real current booked-id set
// catches every case that removes/un-books a visit uniformly: edited
// off isFutureAppointment, archived, deleted, or its date moved to the
// past. Called on Home mount (catch up) and right after Clinic
// Visits' own save/archive/delete/undo — see that module's comments.
export async function syncClinicVisitsToCalendar(visits) {
  // Self-gated on the preference so every call site (Home's mount,
  // Clinic Visits' own save) doesn't need to separately remember to
  // check it — one place decides whether this feature is actually on.
  if (!AppPreferencesRepository.getPreferences().calendarSyncEnabled) return { synced: false };
  const plugin = await getPlugin();
  if (!plugin) return { synced: false };
  const calendarId = await ensureShosCalendar(plugin);
  const now = new Date();
  const booked = visits.filter((v) => !v.isArchived && v.isFutureAppointment && v.date && new Date(v.date) > now);
  const bookedIds = new Set(booked.map((v) => v.id));

  for (const visit of booked) await syncOneVisit(plugin, calendarId, visit);

  const { events } = await plugin.findEvents({ calendarName: SHOS_CALENDAR_NAME });
  for (const event of events) {
    const match = /^\[shos:(.+)\]$/.exec(event.notes || "");
    if (match && !bookedIds.has(match[1])) {
      await plugin.deleteEvent({ id: event.id });
    }
  }
  return { synced: true, count: booked.length };
}

// Real ask's own "never accidentally shared unless deliberately
// selected" — turning the feature back OFF should genuinely remove
// what was shared, not leave stale copies sitting in the user's real
// calendar app forever. Deleting the calendar itself (rather than
// hunting down each event) also removes every event in it in one
// native call — the same clean slate as never having turned it on.
export async function removeShosCalendar() {
  const plugin = await getPlugin();
  if (!plugin) return;
  const { calendars } = await plugin.listCalendars();
  if (calendars.some((c) => c.name === SHOS_CALENDAR_NAME)) {
    await plugin.deleteCalendar({ name: SHOS_CALENDAR_NAME });
  }
}
