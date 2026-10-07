// dataAnomalyScan.js - find records whose own dates contradict each other, and
// encounters that look like the same one logged twice.
//
// WHAT THIS IS. Read-only, and deliberately so. It reports; it never repairs.
// The reasoning is the same restraint the duplicate checker already applies, and
// for the same reason: a wrong auto-repair on sexual-health data is silent, and
// the owner finds out at a clinic appointment rather than in a stack trace.
//
// WHAT IT IS NOT. It is not clinical risk scoring, which CLAUDE.md puts
// permanently out of scope. Nothing here says "you should have been tested for X
// by now" or "this exposure needs attention". Every finding is a claim about the
// app's OWN records contradicting each other or the calendar, which is a fact
// about the data rather than an opinion about the user's health.
//
// WHY A SCAN AND NOT A FIX, EVEN FOR THINGS THAT LOOK OBVIOUS. "The app's
// arithmetic must be wrong here" is exactly the belief that makes an automated
// rewrite dangerous: the wrong arithmetic and the wrong data are
// indistinguishable from the outside. So every finding carries the evidence that
// produced it, in words, and the decision stays with the person.
//
// WHY A FUTURE DATE IS NOT ALWAYS AN ERROR, which is the judgement this file
// most needs to get right. A clinic visit dated in the future is a BOOKED
// APPOINTMENT - that is a normal thing to have on a calendar, and CLAUDE.md
// already records that future appointments must not be treated as stale. An
// encounter logged slightly ahead of time is at least explicable. A TEST,
// VACCINATION, MEASUREMENT, DOSE or SYMPTOM entry dated in the future is none of
// those: you cannot have taken a dose that has not happened. That distinction is
// why the list below is short and specific rather than "everything with a date".
import { EncounterRepository } from "../repositories/encounterRepository.js";
import { TestingRepository } from "../repositories/testingRepository.js";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository.js";
import { SymptomLogRepository } from "../repositories/symptomLogRepository.js";
import { EpisodeRepository } from "../repositories/episodeRepository.js";
import { VaccinationRepository } from "../repositories/vaccinationRepository.js";
import { MeasurementRepository } from "../repositories/measurementRepository.js";
import { LogRepository } from "../repositories/logRepository.js";
import { MenstrualCycleRepository } from "../repositories/menstrualCycleRepository.js";
import { storedDayKey, calendarDaysBetween } from "./dateInputHelpers.js";

// A same-day-ish window. The real case this exists for is "logged at 3am, forgot
// I had, logged it again at 11am" - 8 hours. The window is comfortably wider
// than that and still narrow enough that a genuinely separate second meeting the
// next day is not flagged.
export const DOUBLE_LOG_WINDOW_HOURS = 18;

// A test result dated before its own specimen is impossible. A test dated before
// the clinic visit it is linked to is impossible. Etc. Each of these is a
// contradiction between two stored facts, not a judgement about care.

function flag(results, finding) {
  results.push(finding);
}

const dayKeyOf = (stored) => {
  if (typeof stored !== "string") return null;
  const key = storedDayKey(stored);
  return /^\d{4}-\d{2}-\d{2}$/.test(key || "") ? key : null;
};

/**
 * Days from `a` to `b`, both YYYY-MM-DD, or null when either is unusable.
 *
 * A THIN ALIAS over dateInputHelpers' own `calendarDaysBetween`, deliberately not
 * a private reimplementation. The first draft of this file wrote its own, and
 * mutation testing showed why that was the wrong call: swapping its UTC-midnight
 * parse for a local one stayed GREEN, because `Math.round` of a span absorbs a
 * one-hour DST error completely. CLAUDE.md already records this for `daysSince` -
 * "reverting that line fails nothing, it is not an observable bug" - so no
 * day-count assertion in this file could ever have caught it. Reusing the one
 * existing owner of the rule means there is no second copy to drift, and the
 * shared helper's own tests cover the arithmetic.
 */
function daysBetween(a, b) {
  return calendarDaysBetween(a, b);
}

/**
 * Records that cannot be in the future because they describe something that has
 * already happened.
 *
 * Clinic visits and encounters are deliberately absent, and the omission is the
 * point: a future clinic visit is a booked appointment and a future encounter is
 * at least explicable, so flagging either would put a known-legitimate record in
 * a list of errors and train the owner to ignore the whole thing.
 */
async function findFutureDates(todayKey) {
  const results = [];
  const future = (recordType, recordLabel, recordId, field, stored) => {
    const key = dayKeyOf(stored);
    if (!key) return;
    const days = daysBetween(todayKey, key);
    if (days === null || days <= 0) return;
    flag(results, {
      kind: "futureDate",
      recordType,
      recordLabel: recordLabel || "(untitled)",
      recordId,
      why: `its ${field} is ${key}, which is ${days === 1 ? "tomorrow" : `${days} days`} in the future, and it records something that has already happened`,
      fixableByEditingTheRecord: true,
    });
  };

  for (const t of await TestingRepository.getAll()) {
    future("Test", t.title, t.id, "sample date", t.date);
    future("Test", t.title, t.id, "result date", t.resultDate);
  }
  for (const v of await VaccinationRepository.getAll()) {
    future("Vaccination", v.title || v.vaccine, v.id, "date", v.date);
  }
  for (const m of await MeasurementRepository.getAll()) {
    future("Measurement", `${m.type || "measurement"} · ${m.date || ""}`, m.id, "date", m.date);
  }
  for (const s of await SymptomLogRepository.getAll()) {
    future("Symptom Log entry", s.title, s.id, "start date", s.dateStarted);
  }
  for (const l of await LogRepository.getAll()) {
    future("Medication log entry", `${l.type || "entry"}`, l.id, "date", l.date);
  }
  for (const c of await MenstrualCycleRepository.getAll()) {
    future("Menstrual cycle entry", c.startDate, c.id, "start date", c.startDate);
  }
  for (const ep of await EpisodeRepository.getAll()) {
    future("Episode", ep.title, ep.id, "resolved date", ep.resolvedDate);
  }
  return results;
}

/**
 * Two stored facts that contradict each other.
 *
 * Every rule here is a plain impossibility rather than a "that looks odd":
 * a result before its own specimen, a specimen before the visit it belongs to, a
 * symptom that started before the encounter that caused it, a visit that happened
 * before the test it is the record of, an episode resolved before the encounter
 * that started it.
 *
 * Every comparison is in CALENDAR DAYS, because these are calendar claims and
 * this repo has been bitten by dividing a span by 86400000. A result dated the
 * evening before its specimen is normal (a same-day test reported next morning),
 * so a one-day gap is allowed; anything more than a day is a real contradiction.
 */
async function findContradictions() {
  const results = [];
  const encounters = await EncounterRepository.getAll();
  const encounterById = new Map(encounters.map((e) => [e.id, e]));
  const visits = await ClinicVisitsRepository.getAll();
  const visitById = new Map(visits.map((v) => [v.id, v]));
  const tests = await TestingRepository.getAll();

  // A test's result cannot precede its own specimen.
  for (const t of tests) {
    const sampled = dayKeyOf(t.date);
    const resulted = dayKeyOf(t.resultDate);
    const gap = daysBetween(sampled, resulted);
    if (gap !== null && gap < -1) {
      flag(results, {
        kind: "ordering",
        recordType: "Test",
        recordLabel: t.title || "(untitled)",
        recordId: t.id,
        why: `its result date (${resulted}) is ${Math.abs(gap)} days BEFORE its sample date (${sampled}), which cannot happen`,
        fixableByEditingTheRecord: true,
      });
    }
  }

  // A sample cannot have been taken before the clinic visit it is filed under,
  // and the visit cannot have happened before the test it records.
  for (const t of tests) {
    const sampled = dayKeyOf(t.date);
    if (!sampled) continue;
    for (const vid of t.clinicVisitIds || []) {
      const v = visitById.get(vid);
      const visitDay = dayKeyOf(v?.date);
      const gap = daysBetween(visitDay, sampled);
      if (gap === null) continue;
      if (gap > 1) {
        flag(results, {
          kind: "ordering",
          recordType: "Test",
          recordLabel: t.title || "(untitled)",
          recordId: t.id,
          why: `its sample date (${sampled}) is ${gap} days AFTER the clinic visit it is linked to (${visitDay})`,
          fixableByEditingTheRecord: true,
        });
      } else if (gap < -1) {
        const v2 = await ClinicVisitsRepository.getById(vid);
        const linked = (v2?.linkedTestIds || []).includes(t.id);
        if (!linked) continue;
        flag(results, {
          kind: "ordering",
          recordType: "Clinic Visit",
          recordLabel: v2?.title || "(untitled)",
          recordId: v2?.id,
          why: `its date (${visitDay}) is ${Math.abs(gap)} days BEFORE the test it records (${sampled})`,
          fixableByEditingTheRecord: true,
        });
      }
    }
  }

  // A symptom cannot have started before the encounter it is linked to. Signed
  // the other way round this reads as "started 9 days after", which is entirely
  // ordinary, so the direction is stated here rather than left to the arithmetic:
  // `gap` is days from the ENCOUNTER to the SYMPTOM, so NEGATIVE is the
  // impossible case and is the one flagged.
  for (const s of await SymptomLogRepository.getAll()) {
    const started = dayKeyOf(s.dateStarted);
    if (!started) continue;
    for (const eid of s.relatedEncounterIds || []) {
      const e = encounterById.get(eid);
      const encDay = dayKeyOf(e?.date);
      const gap = daysBetween(encDay, started);
      if (gap === null || gap >= 0) continue;
      flag(results, {
        kind: "ordering",
        recordType: "Symptom Log entry",
        recordLabel: s.title || "(untitled)",
        recordId: s.id,
        why: `its start date (${started}) is ${Math.abs(gap)} days BEFORE the encounter it is linked to (${encDay}), so it is linked to something that had not happened yet`,
        fixableByEditingTheRecord: true,
      });
    }
  }

  // An episode cannot have been resolved before the encounter that started it.
  for (const ep of await EpisodeRepository.getAll()) {
    const resolved = dayKeyOf(ep.resolvedDate);
    const start = dayKeyOf(encounterById.get(ep.startEncounterId)?.date);
    const gap = daysBetween(start, resolved);
    if (gap === null || gap >= 0) continue;
    flag(results, {
      kind: "ordering",
      recordType: "Episode",
      recordLabel: ep.title || "(untitled)",
      recordId: ep.id,
      why: `its resolved date (${resolved}) is ${Math.abs(gap)} days BEFORE the encounter that started it (${start})`,
      fixableByEditingTheRecord: true,
    });
  }

  return results;
}

/**
 * Encounters that look like the same one logged twice.
 *
 * DELIBERATELY STRICT, because a false positive here is worse than a miss. Three
 * conditions must ALL hold: the same set of contacts, the same location, and both
 * within the window. Requiring the same attendees is what does the work - a
 * shared location alone means two different people used the same sauna, which is
 * the app's entire subject matter and not a duplicate at all. An empty attendee
 * set is not flagged either, because "two records with no contacts at the same
 * place" is not evidence of anything.
 *
 * The window is measured in ELAPSED TIME, not calendar days, and that is the one
 * place in this file where a duration is what is wanted: "8 hours apart" is a
 * claim about an instant, not about two dates, so calendar arithmetic would
 * discard the very detail that makes the finding legible. The day-based rules
 * above do the opposite because they ARE date claims. Both are right, which is
 * why neither can be applied by habit.
 */
async function findPossibleDoubleLogs(now = new Date()) {
  const results = [];
  const encounters = await EncounterRepository.getAll();

  const keyOf = (e) => [...(e.attendeeIds || [])].sort().join("|");

  for (let i = 0; i < encounters.length; i++) {
    const a = encounters[i];
    const aKey = keyOf(a);
    if (!a.attendeeIds || a.attendeeIds.length === 0) continue;
    const aMs = new Date(a.date).getTime();
    if (Number.isNaN(aMs)) continue;

    for (let j = i + 1; j < encounters.length; j++) {
      const b = encounters[j];
      if (keyOf(b) !== aKey) continue;
      const bMs = new Date(b.date).getTime();
      if (Number.isNaN(bMs)) continue;

      const hours = Math.abs(bMs - aMs) / 3600000;
      if (hours > DOUBLE_LOG_WINDOW_HOURS) continue;
      // Both must name the same place, and it must actually be named. Two
      // records that both have no location carry no evidence at all.
      const locA = a.locationId || "";
      const locB = b.locationId || "";
      if (!locA || !locB || locA !== locB) continue;

      const samePlace = locA === locB;
      const who = a.attendeeIds.length;
      flag(results, {
        kind: "doubleLogged",
        recordType: "Encounter",
        recordLabel: a.title || a.encounterType || "(untitled)",
        recordId: a.id,
        pairedWithId: b.id,
        pairedWithLabel: b.title || b.encounterType || "(untitled)",
        why: `same ${who} ${who === 1 ? "contact" : "contacts"}, same location, ${hours < 1 ? "under an hour" : `${Math.round(hours)} hours`} apart - which is what logging the same meet-up twice a few hours apart looks like`,
        // Stated rather than hidden: a same-venue same-attendee pair is
        // EVIDENCE, not proof. Two separate meetings in one evening are a real
        // thing, and this must never read as a verdict.
        confidence: samePlace ? "worth a look" : "possible",
        fixableByEditingTheRecord: false,
      });
    }
  }
  return results;
}

/**
 * Every anomaly this scan can find, as one flat list.
 *
 * `todayKey` is injectable so the future-date rule can be tested at a pinned
 * date rather than only ever running against whatever today happens to be.
 */
export async function findDataAnomalies({ todayKey } = {}) {
  const today = todayKey || storedDayKey(new Date().toISOString());
  const results = [
    ...(await findFutureDates(today)),
    ...(await findContradictions()),
    ...(await findPossibleDoubleLogs()),
  ];
  return {
    todayKey: today,
    findings: results,
    byKind: {
      futureDate: results.filter((r) => r.kind === "futureDate").length,
      ordering: results.filter((r) => r.kind === "ordering").length,
      doubleLogged: results.filter((r) => r.kind === "doubleLogged").length,
    },
    total: results.length,
  };
}

export const ANOMALY_KIND_LABELS = {
  futureDate: "Dated in the future",
  ordering: "Dates contradict each other",
  doubleLogged: "Possibly logged twice",
};

