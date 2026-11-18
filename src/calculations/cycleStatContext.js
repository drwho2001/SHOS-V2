// cycleStatContext.js
//
// F4 (18 Nov 2026) — plain, non-alarmist context for the cycle-length stats.
// No clinical advice, no diagnosis, no directive to test or refer. The app
// stores facts and derives descriptive context only.
//
// Two rules from the owner's approved review:
//  1. NEVER label a short history "irregular" — two cycles cannot establish
//     irregularity, so no variability advisory before at least 3 cycles
//     (i.e. 2 gaps between starts).
//  2. Hormonal contraception commonly changes bleeding in the first months;
//     soften the alarm there rather than hiding the dates. Keep the numbers
//     visible and explain the context instead.
export const MIN_CYCLES_FOR_VARIABILITY = 3; // 3 cycles = 2 gaps

/**
 * @param {{min:number,max:number,count:number}|null} regularity from getCycleRegularity()
 * @param {{methodName:string|null, settlingIn:boolean}} hormonal context
 * @returns {{show:boolean, tone:"neutral"|"context", text:string}}
 */
export function cycleVariabilityAdvisory(regularity, hormonal = {}) {
  const fallback = { show: false, tone: "neutral", text: "" };
  if (!regularity || typeof regularity.count !== "number") return fallback;
  const gaps = regularity.count;
  const cycles = gaps + 1;
  if (cycles < MIN_CYCLES_FOR_VARIABILITY) return fallback;
  const spread = (regularity.max || 0) - (regularity.min || 0);
  if (spread <= 14) return fallback;

  if (hormonal.settlingIn) {
    const name = hormonal.methodName ? ` with ${hormonal.methodName}` : "";
    return {
      show: true,
      tone: "context",
      text: `Bleeding changes can be expected${name} in the first 3 months. Your cycle lengths are still shown above — mention bleeding that stays changed or persistent to a clinician.`,
    };
  }
  return {
    show: true,
    tone: "neutral",
    text: `Your recorded cycles have ranged from ${regularity.min} to ${regularity.max} days. Cycle length can vary for many reasons — a change in your usual pattern is worth mentioning to a clinician.`,
  };
}

/** A neutral, always-visible note when a hormonal method is active. */
export function hormonalContextNote(hormonal = {}) {
  if (!hormonal.active) return "";
  const name = hormonal.methodName ? ` (${hormonal.methodName})` : "";
  return `If you're using hormonal contraception${name}, changes in bleeding can be expected, especially in the first 3 months. Persistent or changed bleeding is worth mentioning to a clinician.`;
}
