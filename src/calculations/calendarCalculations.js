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

  tests.filter((t) => !t.isArchived && t.date).forEach((t) => {
    events.push({ date: t.date, moduleKey: "testing", id: t.id, title: t.title || (t.testingFor || []).join("/") || "Test" });
  });

  clinicVisits.filter((v) => !v.isArchived && v.date).forEach((v) => {
    events.push({ date: v.date, moduleKey: "clinicVisits", id: v.id, title: v.title || (v.reasonForVisit || []).join("/") || "Clinic visit" });
  });

  vaccinations.filter((v) => !v.isArchived && v.date).forEach((v) => {
    events.push({ date: v.date, moduleKey: "vaccinations", id: v.id, title: v.title || v.vaccine || "Vaccination" });
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

// Groups a flat event list into a map keyed by "YYYY-MM-DD" (local
// date, not UTC — matches this app's own standing timezone rule, no
// shifting a typed/stored date via a UTC conversion).
export function groupEventsByDay(events) {
  const map = {};
  events.forEach((ev) => {
    const d = new Date(ev.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(ev);
  });
  return map;
}
