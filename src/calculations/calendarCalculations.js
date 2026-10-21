import { getVaccinationDoseEntries } from "./vaccinationCalculations";
import { isPlannedTest } from "./testingCalculations";
// calendarCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: calendar view pulling real events from every
// module, Google-Calendar-style. Pure function — callers pass in
// already-loaded repository data, same separation as
// doxyPepCalculations.js/statsCalculations.js.
//
// SCOPE DECISION: Medication's daily dose logs are deliberately NOT
// included as individual calendar events — logging a dose every day
// isn't really a "calendar event" in the traditional sense (it's a
// habit-tracker fact, not a discrete thing that happened once), and
// including it would flood every single day with a dot, making the
// calendar useless for seeing anything else. What IS included from
// Medication: when a medication was started, and real dose-history
// changes (see the dose-update feature built earlier this session) —
// both genuinely discrete, meaningful events worth seeing on a
// calendar.
export function getCalendarEvents({ encounters, tests, clinicVisits, vaccinations, symptomEntries, medications }) {
  const events = [];

  encounters.filter((e) => !e.isArchived && e.date).forEach((e) => {
    events.push({ date: e.date, moduleKey: "encounters", id: e.id, title: e.title || e.encounterType || "Encounter" });
  });

  // CHANGED 20 Oct 2026 (t127): a PLANNED test - dated in the future - is
  // shown, and LABELLED, because a scheduled retest is exactly the kind of
  // thing a calendar should show. It is labelled rather than dropped
  // because the same record shape is also what the Testing list shows with
  // its "Scheduled" badge, and the calendar must not quietly disagree with
  // it. Its title is not the "what" the user reads, though - the label
  // carries that.
  tests.filter((t) => !t.isArchived && t.date).forEach((t) => {
    const title = t.title || (t.testingFor || []).join("/") || "Test";
    events.push({
      date: t.date,
      moduleKey: "testing",
      id: t.id,
      title: isPlannedTest(t) ? `${title} (scheduled)` : title,
      planned: isPlannedTest(t),
    });
  });

  clinicVisits.filter((v) => !v.isArchived && v.date).forEach((v) => {
    events.push({ date: v.date, moduleKey: "clinicVisits", id: v.id, title: v.title || (v.reasonForVisit || []).join("/") || "Clinic visit" });
  });

  // FIXED 30 Sep 2026 (t034) - read through the derivation, not `v.date`.
  //
  // This was the worst of the five stale readers, because it is the only one
  // that LEAVES the device. A vaccination created since the dose series landed
  // has no top-level `v.date` at all, so `&& v.date` was false and the record
  // was dropped here - a vaccination the user had genuinely recorded was simply
  // absent from their phone calendar, with nothing on screen to explain it. And
  // an edited record kept its pre-series date, so the event written to the
  // calendar was wrong rather than missing.
  //
  // Mapped first so the derivation is called once per record rather than once in
  // the filter and again in the body, which is the shape that lets the two drift
  // apart again.
  //
  // CHANGED 20 Oct 2026 (t130) - ONE EVENT PER DOSE, so this screen and
  // the phone's real calendar show the SAME things. A vaccine course is a
  // series: a four-week schedule is four real dates, and two different
  // vaccines on one day are two different things that happened. When this
  // screen showed one event per RECORD while the phone showed one per DOSE,
  // the two calendars disagreed about the user's own history - which is the
  // exact class of thing t034 was closed for.
  //
  // The record id is still the event's `id`, because that is what the
  // calendar screen navigates to; the per-dose `key` is what makes the event
  // itself unique.
  vaccinations
    .filter((v) => !v.isArchived)
    .forEach((v) => {
      for (const entry of getVaccinationDoseEntries(v)) {
        if (!entry.date) continue;
        events.push({
          date: entry.date,
          moduleKey: "vaccinations",
          id: v.id,
          key: `${v.id}:${entry.key}`,
          title: v.title || v.vaccine || "Vaccination",
        });
      }
    });

  symptomEntries.filter((e) => !e.isArchived && e.dateStarted).forEach((e) => {
    events.push({ date: e.dateStarted, moduleKey: "symptomLog", id: e.id, title: e.title || "Symptom entry" });
  });

  medications.filter((m) => !m.isArchived).forEach((m) => {
    if (m.createdAt) events.push({ date: m.createdAt, moduleKey: "medications", id: m.id, title: `${m.name} started` });
    (m.doseHistory || []).forEach((h, i) => {
      events.push({ date: h.supersededAt, moduleKey: "medications", id: m.id, title: `${m.name} dose changed${h.note ? ` — ${h.note}` : ""}` });
    });
  });

  return events;
}

// Groups a flat event list into a map keyed by "YYYY-MM-DD".
//
// THE FRAME, and it is the app's standing rule rather than a choice: a
// stored datetime's digits are LITERAL LOCAL WALL-CLOCK TIME with a
// deliberate "Z" lie on the end, so the day is read with the UTC getters
// (which undo the lie) and not with the local ones.
//
// CHANGED 20 Oct 2026 (t130): this read the day with the LOCAL getters,
// which re-applied the device's UTC offset - so a dose with no recorded
// time (a local midnight) was filed under the PREVIOUS DAY in every
// negative-offset zone, while the phone's calendar filed it correctly. Two
// calendars disagreeing about the same day is the exact bug this whole
// feature was for, so the read is now in the stored frame.
export function groupEventsByDay(events) {
  const map = {};
  events.forEach((ev) => {
    const d = new Date(ev.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  });
  return map;
}
