/**
 * The dose-timing advisory's dismissal (t106).
 *
 * WHY THIS EXISTS. The advisory is computed from the medication's dosing
 * interval and the time of the last logged dose, and it is shown on the
 * medication card for a window either side of the halfway point of that
 * interval. For a once-daily medication that is a quarter of the day; for a
 * four-times-daily one it is TWO THIRDS of the day, because the window is
 * two hours wide and the floor sits halfway through the interval however
 * short the interval is.
 *
 * The calculation is right, and it is not this file's to change: the
 * two-hour figure is the NHS-sourced one, and
 * medicationCalculations.js's own comment says so. The fix is PRESENTATION -
 * a dismissible advisory - and not a smaller magic number, which is why this
 * file exists at all and the calculation is untouched.
 *
 * WHAT A DISMISSAL IS HERE. Per OCCURRENCE: the user dismisses the advice
 * for the dose it is about, and it comes back when the next dose is logged.
 * The key is therefore the medication, the dose it is about, and which side
 * of the floor the advisory is on - so a newly logged dose is a new
 * occurrence and the advice returns for it.
 *
 * WHY IT IS IN-MEMORY AND NEVER PERSISTED. This mirrors the app's existing
 * session-dismissal semantics for the due banners (App.jsx's
 * sessionDismissed): a dismissal survives leaving the tab and coming back,
 * and is gone on a real app close. The advice itself is time-dependent - it
 * comes back as the clock moves - so a permanent "never show this again"
 * would be the wrong promise, and a per-dose dismissal the user never has to
 * think about is the useful middle.
 *
 * WHY A MODULE-LEVEL STORE AND NOT REACT STATE. The medication tab is
 * re-mounted every time the user switches away and back (App.jsx keys the
 * active module on the tab plus a nav-reset counter), so state held in the
 * card or in the module is lost on every tab switch - and a dismissal that
 * vanishes the moment the user looks at another tab is not a dismissal at
 * all. This store lives in the module graph, which is not torn down. There
 * is precedent for module state in a calculations file: darkModePreference.js
 * keeps its current value and its listeners the same way.
 *
 * A card still keeps a local copy of what it dismissed, because mutating a
 * module-level Set does not re-render anything on its own - the local state
 * is what makes the banner disappear on the tap, and this store is what
 * makes it stay gone.
 */

const dismissed = new Set();

/**
 * The identity of one advisory occurrence.
 *
 * Returns null when there is nothing to key, so a caller can pass the
 * result straight into isAdvisoryDismissed without a guard of its own.
 */
export function advisoryDismissalKey(med, lastDose, advisory) {
  if (!med || !lastDose || !advisory) return null;
  // The dose's own stored date, not the advisory's message: the message's
  // hour figure changes as the clock moves ("1h before" becomes "2h before"),
  // so keying on the message would make the dismissal expire on its own.
  return `${med.id}|${lastDose.date}|${advisory.kind}`;
}

export function isAdvisoryDismissed(key) {
  return Boolean(key) && dismissed.has(key);
}

export function dismissAdvisory(key) {
  if (!key) return false;
  dismissed.add(key);
  return true;
}

/** For tests, and for anything that needs a clean slate. */
export function clearAdvisoryDismissals() {
  dismissed.clear();
}
