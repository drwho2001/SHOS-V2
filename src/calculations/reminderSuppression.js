// reminderSuppression.js — pure logic for Phase 3 "banner suppression".
//
// THE PROBLEM THIS SOLVES: every due-reminder banner's close button used to do
// `setX([])`, and the 60-second poll then recomputed and set it straight back.
// So a reminder the user had looked at and consciously dismissed came back
// every minute, all session, which is the surest possible way to train
// someone to ignore a reminder - and in a medication app, the reminders that
// get trained away are the ones that matter.
//
// THE TWO DISMISSALS ARE DIFFERENT THINGS, and conflating them is the design
// mistake worth avoiding:
//
//   1. "Not now"  - session-scoped. Hides the banner for the rest of THIS app
//      run, and it comes back after a hard close and reopen. Deliberately NOT
//      time-based: a 30-minute dismissal was the previous behaviour and it is
//      barely different from none. Deliberately NOT wiped by backgrounding
//      either - on Android, sending the app to the background does not tear
//      down the WebView, so plain in-memory state gives exactly the requested
//      line for free: survives a trip to the launcher, dies on a real close.
//
//   2. "Don't remind me about this" - persisted. Silences this specific
//      outstanding item until its content actually changes.
//
// WHY EVERYTHING IS KEYED BY A SIGNATURE RATHER THAN A FLAG: a flag per banner
// type means acknowledging "PrEP is due" also hides "Testosterone is now due
// too", two hours later. That is how a real reminder gets missed. A signature
// is a fingerprint of exactly what was due when the user acted. While the
// due set is unchanged the silence holds; the moment it genuinely changes -
// a new item, or a new dose of the same medication - the signature differs and
// the reminder is free to return. That is the whole design, and it is what
// makes the device-side behaviour safe too.

// The kinds of reminder that can be suppressed. Kept as a fixed set so a typo
// can't invent a new channel of silence.
export const REMINDER_KIND = {
  MEDS: "meds",
  REFILL: "refill",
  TESTING: "testing",
  CLINIC_VISIT: "clinicVisit",
  VACCINATION: "vaccination",
};

export const REMINDER_KINDS = Object.values(REMINDER_KIND);

/**
 * How far an acknowledgement reaches.
 *
 * "device" is coarser than it sounds, and the copy in the UI says so. This app
 * schedules ONE notification per reminder type under a fixed id
 * (NOTIFICATION_IDS.medicationReminder and friends), so there is no per-item
 * notification to cancel. What "device" actually means here is "stop
 * re-scheduling this type's notification while its due content is unchanged" -
 * which is correct and safe, because a genuinely new dose has a different
 * signature and schedules normally. It is worth being precise about, because a
 * dose that is already due is scheduled three seconds out, so cancelling it is
 * close to a no-op, and a user expecting "my phone will never mention this
 * again" would be wrong.
 */
export const ACK_SCOPE = {
  /** Banner only. The OS notification still fires - the safe default. */
  IN_APP: "in-app",
  /** Banner suppressed and the type's pending notification not rescheduled. */
  BOTH: "both",
};

export const ACK_SCOPES = Object.values(ACK_SCOPE);

/**
 * Build a fingerprint of a medication's due set.
 *
 * Includes the last-dose timestamp, not just the medication id, and that is
 * the whole point: without it, a once-daily medication acknowledged as due
 * this morning would still match the identical signature tomorrow morning and
 * never remind the user again. With it, every dose is a distinct instance.
 *
 * A medication that has never been dosed has no timestamp, so its signature is
 * the id alone and stays suppressed until it changes. That is the right
 * behaviour - someone with a medication that has never been taken has been
 * told about it repeatedly already, and the passive indicator stays.
 *
 * @param {Array<{id: string, _dueSince?: string|null}>} due
 * @returns {string} a stable signature
 */
export function buildMedsSignature(due) {
  return (due || [])
    .map((m) => `${m.id}@${m._dueSince || "never"}`)
    .sort()
    .join("|");
}

/**
 * Fingerprint for the other four kinds, which already carry their own natural
 * identity in the due state itself: a visit id, a vaccination's next-due date,
 * a testing due date. None of them are "repeating every N hours", so the id
 * alone is a genuinely distinct instance rather than a per-occurrence one.
 *
 * @param {string} kind one of REMINDER_KIND
 * @param {Array<{id: string}>|null|undefined} items
 * @returns {string}
 */
export function buildSimpleSignature(kind, items) {
  const ids = (items || []).map((i) => i?.id).filter(Boolean).sort().join("|");
  return ids ? `${kind}:${ids}` : "";
}

/**
 * Decide whether a banner should be on screen.
 *
 * Order matters here and it is the substance of the feature: an
 * acknowledgement outranks a session dismissal, because it is the stronger
 * statement. Neither can produce a banner when there is genuinely nothing due
 * - `due` is checked first so a dismissal can never invent a reminder.
 *
 * @param {object} state
 * @param {string|null} state.dueCount how many items are actually due. 0 means
 *   nothing to remind about, whatever any suppression record says.
 * @param {string} state.signature the current due-content fingerprint.
 * @param {string[]} state.sessionDismissed signatures dismissed this app run.
 * @param {string[]} state.acknowledged signatures acknowledged outright.
 * @returns {boolean}
 */
export function isBannerVisible(state) {
  const { dueCount, signature, sessionDismissed = [], acknowledged = [] } = state;
  if (!dueCount) return false;
  if (!signature) return false;
  if (acknowledged.includes(signature)) return false;
  if (sessionDismissed.includes(signature)) return false;
  return true;
}

/**
 * Whether anything is still outstanding behind a suppressed banner.
 *
 * This is the "subtle passive warning" the acknowledge action leaves behind, and
 * it has to be derived rather than remembered: a remembered flag would outlive
 * the thing it was about. Recomputing from the live due state means the dot
 * disappears the moment the dose is actually taken - the only thing that should
 * ever clear it - and cannot survive as a stale mark on a tab.
 *
 * @param {object} state same shape as isBannerVisible, plus:
 * @param {string} state.kind the reminder kind, so in-app and device
 *   acknowledgements can be told apart.
 * @param {Array<{signature: string, scope: string}>} state.acknowledgements
 * @returns {boolean} true when something is due but acknowledged
 */
export function hasOutstandingAcknowledged(state) {
  const { dueCount, signature, kind, acknowledgements = [] } = state;
  if (!dueCount) return false;
  if (!signature) return false;
  return acknowledgements.some((a) => a?.signature === signature && a?.kind === kind);
}

/**
 * Decide whether the sync layer should suppress a device notification.
 *
 * Only an acknowledgement scoped to the device counts. A session "not now"
 * deliberately does NOT, which is what makes snoozing work: snoozing writes a
 * real timestamped fact that the due-state check already honours, so the
 * reminder reappears on its own when the snooze expires, within this same app
 * run, exactly as asked. Suppressing on dismissal would have quietly killed
 * that.
 *
 * @param {string} signature the current due-content fingerprint
 * @param {Array<{signature: string, scope: string}>} acknowledgements
 * @returns {boolean}
 */
export function shouldSuppressDeviceNotification(signature, acknowledgements) {
  if (!signature) return false;
  return (acknowledgements || []).some(
    (a) => a?.signature === signature && a?.scope === ACK_SCOPE.BOTH
  );
}

/**
 * Append to a capped list of signatures.
 *
 * Both the session and the persisted lists need a bound. They only ever grow
 * by a user action, so they cannot grow quickly - but "cannot grow quickly" is
 * not "cannot grow", and this is stored preference data in an app whose whole
 * privacy claim is that everything stays on the device. A cap costs three
 * lines and removes the question.
 *
 * @param {string[]} list
 * @param {string} signature
 * @param {number} [limit]
 * @returns {string[]} a new array; the input is never mutated
 */
export function appendSignature(list, signature, limit = 50) {
  const current = Array.isArray(list) ? list : [];
  if (!signature) return current;
  const next = [signature, ...current.filter((s) => s !== signature)];
  return next.length > limit ? next.slice(0, limit) : next;
}

/**
 * Add or replace an acknowledgement record for a given signature.
 *
 * Replaces rather than appends on a repeat, so re-acknowledging the same
 * instance with a wider scope upgrades it instead of leaving a stale
 * in-app-only record behind it.
 */
export function upsertAcknowledgement(acknowledgements, record, limit = 50) {
  const current = Array.isArray(acknowledgements) ? acknowledgements : [];
  if (!record?.signature) return current;
  const next = [record, ...current.filter((a) => a?.signature !== record.signature)];
  return next.length > limit ? next.slice(0, limit) : next;
}

/**
 * Drop acknowledgements that have been spent.
 *
 * "Spent" means the thing that was acknowledged is no longer outstanding. That
 * is the rule the owner asked for, stated once: *stop reminding me about this
 * lasts until the refill is dealt with.*
 *
 * It reads as one rule and does all the work:
 *   - Refill: acknowledge it, then tap Requested, or Cancel, or log the refill
 *     you collected. Any of those takes it out of the outstanding set, so the
 *     acknowledgement is spent, and next time you are genuinely low it speaks
 *     up. Nothing extra to store and no migration - the resolution actions
 *     already existed.
 *   - Vaccination / testing: the due date moves on, which is a different
 *     signature, so the old acknowledgement no longer matches and is spent.
 *   - Dose: acknowledged while still due, so the silence holds. Take it and it
 *     leaves the outstanding set, so the note is spent. Tomorrow's dose has its
 *     own signature and its own reminder, which is correct - a new dose is a
 *     new thing and must not be silenced by yesterday's decision.
 *
 * It also bounds stored preferences for free, which is why the cap in
 * appendSignature is a secondary guard rather than the primary one.
 *
 * @param {Array<{signature: string}>} acknowledgements
 * @param {string[]} outstandingSignatures signatures of things due RIGHT NOW
 * @returns {Array} a new array; the input is never mutated
 */
export function pruneSpentAcknowledgements(acknowledgements, outstandingSignatures) {
  const list = Array.isArray(acknowledgements) ? acknowledgements : [];
  const live = new Set(Array.isArray(outstandingSignatures) ? outstandingSignatures : []);
  return list.filter((a) => a?.signature && live.has(a.signature));
}

/**
 * Normalise a stored acknowledgement, dropping anything malformed.
 *
 * Stored preferences can be restored from a backup written by an older build,
 * so every persisted shape is treated as untrusted input rather than assumed
 * to match today's code. A record with no signature, an unknown scope or a
 * non-string kind is dropped rather than rendered, because the one thing an
 * acknowledgement must never do is suppress a reminder it cannot be identified
 * against.
 *
 * @param {unknown} value
 * @returns {{kind: string, signature: string, scope: string, at: string}|null}
 */
export function normaliseAcknowledgement(value) {
  if (!value || typeof value !== "object") return null;
  const { kind, signature, scope, at } = value;
  if (typeof kind !== "string" || !REMINDER_KINDS.includes(kind)) return null;
  if (typeof signature !== "string" || !signature.length) return null;
  if (!ACK_SCOPES.includes(scope)) return null;
  return {
    kind,
    signature,
    scope,
    at: typeof at === "string" ? at : new Date().toISOString(),
  };
}

/**
 * Keep only well-formed acknowledgements from stored preferences.
 *
 * @param {unknown} list
 * @returns {Array<{kind: string, signature: string, scope: string, at: string}>}
 */
export function normaliseAcknowledgements(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normaliseAcknowledgement).filter(Boolean).slice(0, 50);
}
