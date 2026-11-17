// updateNotice.js
//
// PLAIN-LANGUAGE PURPOSE
// ----------------------
// The "a new version is ready" banner has several independent triggers (a
// service-worker controllerchange, a version.json buildSha mismatch, a GitHub
// release compare) but must be dismissible ONCE, consistently, no matter which
// trigger fired. That used to be broken: the dismiss button wrote
// sessionStorage["shos-sw-update-dismissed"]="1", while every guard read
// localStorage["shos-sw-update-dismissed"] as an epoch-ms timestamp. The
// storage area and the value format both differed, so the flag could never
// satisfy a guard and the banner always came back — including on web, where
// it should not offer an APK at all.
//
// One key, one format (epoch ms in localStorage), one 24h cooldown. Pure
// functions so the decision is testable without a DOM.

export const UPDATE_DISMISS_KEY = "shos-sw-update-dismissed";
export const UPDATE_DISMISS_MS = 24 * 60 * 60 * 1000;

/** True if the banner was dismissed recently enough to stay hidden. */
export function isUpdateNoticeDismissed(now, rawDismissed) {
  if (!rawDismissed) return false;
  const ts = parseInt(rawDismissed, 10);
  if (!Number.isFinite(ts)) return false;
  return now - ts < UPDATE_DISMISS_MS;
}

/** The value to store on dismiss: an epoch-ms timestamp string. */
export function updateDismissValue(now) {
  return String(now);
}
