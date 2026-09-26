// Pure derivation for the Clinic Visit "medications to take home" quantity.
//
// ADDED 26 Sep 2026. Lives in calculations/ rather than inline in the JSX
// because it is pure business logic with no I/O, per this project's
// repository/calculation/sync split - and because the interesting cases are
// exactly the ones worth unit-testing, which a component file makes awkward.
//
// The owner's own example for wanting a unit switch: "if doxy course is less
// than full containers worth of pills." A 28-tablet pack is one container; a
// 14-day course is half of one, and no whole-container count expresses that.
// So the answer is derived per-unit rather than one fixed unit, and half a
// container is a real answer where 1 would be wrong.
//
// DELIBERATELY NOT a second dose-consumption formula. The first version of
// this branched on usagePattern itself (daily / custom / prn) to work out
// consumption per day. That is exactly the calculation
// medicationCalculations.js already owns, in effectiveDoseIntervalHours() -
// the same one computeStock() consumes - and reimplementing it was a real
// instance of this project's "one canonical owner per fact" rule being
// broken, with a second subtly-different copy that could drift. It now calls
// the existing function, so a future change to how dosing patterns map to
// intervals flows through here for free instead of needing this file
// remembered.

import { effectiveDoseIntervalHours } from "./medicationCalculations";

const TAKE_HOME_COVER_DAYS = 30;

export const round2 = (n) => Math.round(n * 100) / 100;

/**
 * How much of `med` covers `coverDays` of the user's own current dosing,
 * expressed in `unit` ("containers" or "units").
 *
 * Precedence, deliberately:
 *   1. `defaultRefillQuantity`, when the user has already told us how much
 *      they normally reorder. Only applied to a container answer, because a
 *      stated reorder quantity IS a pack count - applying it to a tablet
 *      answer would be a category error.
 *   2. Otherwise the window derived from the medication's own dosing
 *      interval and units per dose.
 *
 * Returns null when neither is knowable, and the field is left blank on
 * purpose. A blank "unknown" is honest; a fabricated 1 is not, and 1
 * container is exactly the kind of plausible-looking default that ends up
 * being trusted and then being wrong.
 */
export function suggestedQuantity(med, unit = "containers", coverDays = TAKE_HOME_COVER_DAYS) {
  if (!med) return null;
  const perContainer = Number(med.unitsPerContainer);
  const perDose = Number(med.unitsPerDose);
  const wantsContainers = unit === "containers";

  if (wantsContainers && Number(med.defaultRefillQuantity) > 0) {
    return Math.max(1, Math.round(Number(med.defaultRefillQuantity)));
  }
  if (!(perDose > 0)) return null;

  // The single existing source of truth for "how often is this taken".
  // Returns null for PRN and anything unrecognised, which is precisely the
  // "nothing honest to suggest" case, so that needs no branch of its own.
  const intervalHours = effectiveDoseIntervalHours(med);
  if (!intervalHours) return null;

  // Same expression computeStock() uses for daily consumption, so the
  // take-home window and the "days remaining" figure cannot disagree.
  const dailyConsumption = (perDose * 24) / intervalHours;
  const unitsNeeded = dailyConsumption * coverDays;

  if (wantsContainers) {
    if (!(perContainer > 0)) return null;
    // No minimum floor here, deliberately. An earlier version clamped to a
    // half-container minimum, which quietly overrode the derivation for
    // exactly the case this unit switch exists for: a short course that is
    // genuinely a fraction of a pack. 0.27 containers is a real answer.
    return round2(unitsNeeded / perContainer);
  }
  return Math.max(1, Math.round(unitsNeeded));
}
