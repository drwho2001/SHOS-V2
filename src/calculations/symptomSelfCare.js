// symptomSelfCare.js
//
// One keyed, LOCAL bank of plain-language explanations and holistic self-care
// options for menstrual symptoms. Owner decision (18 Nov): no per-condition
// repositories; one code-owned module; Resources keeps the links.
//
// Boundaries (clinician-approved direction):
//  - patient-friendly labels only — no PMB/IMB/PCB/dyspareunia/menorrhagia/
//    dysmenorrhoea in patient-facing text;
//  - no diagnosis, triage, urgency word, referral instruction or risk score;
//  - no prescription-only treatments (no TXA, no mefenamic acid);
//  - self-care is supportive and optional, never presented as treatment;
//  - `SOONER_LINE` is the owner-approved neutral wording — a time reference
//    without an alarm word — reused by every flag rather than re-typed.
//
// Keys are the EXACT names in symptomsRegistry.js so the info dot can look a
// symptom up by the id-resolved name with no second mapping table. "Urethral
// discharge" has no entry on purpose: it is not a menstrual symptom, and the
// note component returns null for unknown keys rather than inventing copy.
//
// `source.url` values were each opened and checked live on 18 Nov 2026 (the
// two earlier candidate URLs for missed/no periods 404'd and were discarded).
// Where several symptoms share a page it is because that NHS page genuinely
// covers them; nothing here is a guessed link.

/** The single owner of the approved "sooner" wording. */
export const SOONER_LINE = "it's worth mentioning to a clinician sooner";

const NHS_PERIODS = { label: "NHS — Periods", url: "https://www.nhs.uk/conditions/periods/", checkedOn: "2026-11-18" };
const NHS_HEAVY = { label: "NHS — Heavy periods", url: "https://www.nhs.uk/conditions/heavy-periods/", checkedOn: "2026-11-18" };
const NHS_PAIN = { label: "NHS — Period pain", url: "https://www.nhs.uk/conditions/period-pain/", checkedOn: "2026-11-18" };
const NHS_IRREGULAR = { label: "NHS — Irregular periods", url: "https://www.nhs.uk/conditions/irregular-periods/", checkedOn: "2026-11-18" };
const NHS_PMS = { label: "NHS — PMS (premenstrual syndrome)", url: "https://www.nhs.uk/conditions/premenstrual-syndrome/", checkedOn: "2026-11-18" };

export const SYMPTOM_SELF_CARE = {
  "Spotting between periods": {
    label: "Spotting between periods",
    explanation: "A little bleeding between periods is common and can have many harmless causes. Noting when it happens makes it easier to talk about if it continues.",
    selfCare: ["Note the day and how heavy it was", "Keep the dates together with your period log", "There is nothing you need to do unless it keeps happening"],
    sooner: true,
    source: NHS_PERIODS,
  },
  "Heavy menstrual bleeding": {
    label: "Very heavy periods",
    explanation: "Periods can be heavier for lots of reasons. A heat pad, rest and planning around the heaviest days can help you get through them.",
    selfCare: ["A heat pad or warm bath for cramping", "Rest when you need it and stay hydrated", "Gentle movement if it feels good", "Keep a simple note of heavy days"],
    sooner: true,
    source: NHS_HEAVY,
  },
  "Light menstrual bleeding": {
    label: "Light periods",
    explanation: "Light periods are common and often simply how your body is. Noting them over time is usually all that is needed.",
    selfCare: ["Track it alongside your other periods", "No treatment is needed for a lighter pattern on its own"],
    sooner: false,
    source: NHS_PERIODS,
  },
  "Menstrual cramps (dysmenorrhea)": {
    label: "Period pain or cramps",
    explanation: "Cramping is a normal part of periods for many people. Warmth, gentle movement and simple pain relief applied to the skin can help.",
    selfCare: ["A heat pad or hot water bottle on the lower tummy", "A warm bath", "Gentle stretching or a short walk", "Ibuprofen gel rubbed into the painful area, if it suits you", "Rest and fluids"],
    sooner: false,
    source: NHS_PAIN,
  },
  "Irregular periods": {
    label: "Irregular periods",
    explanation: "Cycles naturally vary, especially around stress, illness, changes in weight or new contraception. A pattern is easier to see once a few cycles are logged.",
    selfCare: ["Keep logging the start of each period", "Note big life changes alongside the dates", "Give it a few cycles before worrying about one late or early period"],
    sooner: false,
    source: NHS_IRREGULAR,
  },
  "Absent periods (amenorrhea)": {
    label: "No periods",
    explanation: "Periods can stop for many reasons. If there is a chance you could be pregnant, or periods have stopped for several months, it is worth a conversation.",
    selfCare: ["Keep a note of the last period you had", "Note any other changes you have noticed", "Consider a home pregnancy test if relevant"],
    sooner: true,
    source: NHS_PERIODS,
  },
  "Premenstrual syndrome (PMS)": {
    label: "Premenstrual symptoms (PMS)",
    explanation: "Changes in mood, energy and appetite before a period are common. Tracking them against your cycle often makes the pattern clearer.",
    selfCare: ["Regular sleep and meals", "Gentle movement", "Note which symptoms come before your period", "Take time for something you find calming"],
    sooner: false,
    source: NHS_PMS,
  },
  "Premenstrual dysphoric disorder (PMDD)": {
    label: "Strong premenstrual mood changes",
    explanation: "Mood changes before a period can be intense. Recording the days they happen on can help when you talk to someone about them.",
    selfCare: ["Keep a day-by-day note through the cycle", "Prioritise sleep and regular food", "Reach out to someone you trust if days are very hard"],
    sooner: true,
    source: NHS_PMS,
  },
  "Period clots": {
    label: "Clots in your period",
    explanation: "Small clots are common in heavier periods. Noting their size and the day they happened is useful information to keep.",
    selfCare: ["Note when you saw them", "A heat pad for any cramping", "Keep track of how heavy the day was"],
    sooner: true,
    source: NHS_HEAVY,
  },
  "Bloating": {
    label: "Bloating",
    explanation: "Bloating around a period is common and usually settles on its own.",
    selfCare: ["Warmth on the tummy", "Gentle movement", "Regular meals and fluids"],
    sooner: false,
    source: NHS_PMS,
  },
  "Breast tenderness": {
    label: "Tender breasts",
    explanation: "Breast tenderness before a period is common. A supportive bra and warmth often help.",
    selfCare: ["A supportive bra", "A warm compress", "Note it alongside your cycle dates"],
    sooner: false,
    source: NHS_PMS,
  },
  "Mood changes": {
    label: "Mood changes",
    explanation: "Mood can shift across the cycle. Logging the days helps you see whether there is a pattern.",
    selfCare: ["Note the day and the mood", "Sleep, food and movement where you can", "Talk to someone you trust if it is difficult"],
    sooner: false,
    source: NHS_PMS,
  },
  "Fatigue": {
    label: "Tiredness",
    explanation: "Feeling more tired around a period is common, particularly with heavier bleeding.",
    selfCare: ["Rest without guilt", "Regular fluids and food", "Gentle movement if you want it"],
    sooner: false,
    source: NHS_PMS,
  },
  "Headache": {
    label: "Headaches",
    explanation: "Headaches can happen around a period. Keeping the dates beside your cycle can show a link.",
    selfCare: ["Rest and fluids", "A quiet, dark room if it helps", "Note the day and how long it lasted"],
    sooner: false,
    source: NHS_PMS,
  },
  "Nausea": {
    label: "Feeling sick",
    explanation: "Feeling queasy around a period is common and usually short-lived.",
    selfCare: ["Small, frequent snacks", "Fluids in small sips", "Note which days it happens"],
    sooner: false,
    source: null,
  },
  "Lower back pain": {
    label: "Lower back ache",
    explanation: "Back ache often comes with period cramps and usually eases as the period does.",
    selfCare: ["A heat pad on the lower back", "Gentle stretching", "Rest when you need it"],
    sooner: false,
    source: NHS_PAIN,
  },
  "Pelvic pain": {
    label: "Pelvic pain",
    explanation: "Some cramping with a period is common, but pain that feels different, is worsening or comes with other changes is worth discussing.",
    selfCare: ["A heat pad for comfort", "Note where the pain is and what else was happening", "Rest, but keep a note of anything that changes"],
    sooner: true,
    source: NHS_PAIN,
  },
};

export function symptomSelfCare(key) {
  return SYMPTOM_SELF_CARE[key] || null;
}

/** Patient-friendly label, falling back to the stored symptom name. */
export function patientSymptomLabel(key) {
  return SYMPTOM_SELF_CARE[key]?.label || key;
}

/** Keys whose wording carries the neutral "sooner" nudge. */
export function symptomNeedsSooner(key) {
  return !!SYMPTOM_SELF_CARE[key]?.sooner;
}

/** Verified source object for a symptom, or null when none was verified. */
export function symptomSource(key) {
  return SYMPTOM_SELF_CARE[key]?.source || null;
}
