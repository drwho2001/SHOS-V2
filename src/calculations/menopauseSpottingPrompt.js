// menopauseSpottingPrompt.js
//
// F3 (18 Nov) — a NEUTRAL informational prompt when a bleeding/spotting
// symptom is logged and the user has recorded Post-menopause. Approved copy
// lives in docs/reviews/2026-11-17/F3-MENOPAUSE-COPY-DRAFT.md.
//
// Hard boundaries (from the owner's decisions + repo rules):
//  - user-entered status only, never inferred from age or a gap in periods;
//  - no diagnosis, triage, risk score, "2-week wait", "urgent", "cancer" or
//    referral instruction — only "consider mentioning to a clinician";
//  - the 12-month definition and the HRT qualifier are included verbatim;
//  - if gender-affirming hormone therapy is recorded, suppress the guideline
//    framing and show a plain clinician-only note (NG23 excludes GAHT).
import { calendarDaysBetween } from "./dateInputHelpers.js";

const BLEEDING = /bleed|spot/i;

function isBleedingSymptom(symptom, symptomNameById) {
  const ids = symptom.symptomIds || [];
  const names = ids.map((id) => symptomNameById.get(id) || "").join(" ");
  return BLEEDING.test(`${symptom.title || ""} ${names}`);
}

/** Every stored day with bleeding/spotting, oldest first, de-duplicated. */
export function bleedingDatesFrom(symptomLogs = [], cycles = [], symptomNameById = new Map()) {
  const days = new Set();
  for (const s of symptomLogs) {
    if (isBleedingSymptom(s, symptomNameById) && s.dateStarted) {
      const key = String(s.dateStarted).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days.add(key);
    }
  }
  for (const c of cycles) {
    if (c.spotting) {
      const key = String(c.spottingDate || c.startDate || "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) days.add(key);
    }
  }
  return [...days].sort();
}

/**
 * FIGO-aligned episode key (18 Nov, owner decision): a bleeding/spotting
 * episode is consecutive days of bleeding; a bleeding-free day ends it.
 * The key is the FIRST day of the current run, so acknowledging one episode
 * cannot silence a later, separate one. Uses the canonical day primitive so
 * the stored-date arithmetic guard stays satisfied.
 */
export function bleedingEpisodeKey(symptomLogs, cycles, symptomNameById) {
  const days = bleedingDatesFrom(symptomLogs, cycles, symptomNameById);
  if (!days.length) return null;
  let start = days[days.length - 1];
  for (let i = days.length - 1; i > 0; i--) {
    if (calendarDaysBetween(days[i - 1], days[i]) !== 1) break;
    start = days[i - 1];
  }
  return start;
}

/**
 * @returns {null|{text:string, hrtText:string|null, clinicianOnly:boolean}}
 */
export function menopauseSpottingPrompt({
  menopauseStatus,
  menopauseConfirmedAt,
  gender,
  symptomLogs = [],
  cycles = [],
  symptomNameById = new Map(),
  activeHrt = false,
} = {}) {
  if (menopauseStatus !== "Post-menopause") return null;

  const since = menopauseConfirmedAt || null;
  const onOrAfter = (date) => !since || !date || date >= since;

  const foundLog = symptomLogs.some((s) => onOrAfter(s.dateStarted) && isBleedingSymptom(s, symptomNameById));
  const foundCycle = cycles.some((c) => c.spotting && onOrAfter(c.spottingDate || c.startDate));
  if (!foundLog && !foundCycle) return null;

  // NG23 explicitly excludes people on gender-affirming hormone therapy.
  // The HRT medication category covers both, so use the recorded gender as a
  // conservative signal and drop all guideline-specific framing if present.
  const gahtRecorded = /trans/i.test(gender || "");
  if (gahtRecorded) {
    return {
      text: "You've recorded bleeding or spotting. Because hormone therapy can affect bleeding, this is best discussed with the clinician who manages your care — bring the dates you've logged here.",
      hrtText: null,
      clinicianOnly: true,
    };
  }

  return {
    text: "You've recorded bleeding or spotting after menopause. Bleeding more than 12 months after your periods stopped — and when you are not using hormonal contraception — is usually checked by a clinician, even if it is light. If this is new for you, consider mentioning it to a doctor or nurse and bring the dates you've logged here.",
    hrtText: activeHrt
      ? "If you are taking HRT, some bleeding can be expected — commonly within the first 6 months of starting, or within 3 months of changing your dose or preparation. If bleeding is new, heavy, or continues beyond that, discuss it with your prescriber."
      : null,
    clinicianOnly: false,
  };
}
