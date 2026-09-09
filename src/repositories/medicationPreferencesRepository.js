// medicationPreferencesRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask, 26 Aug 2026: real settings content for Medication's own
// settings screen (dose reminder notifications), which is what
// finally justifies giving Medication a working settings gear again —
// it was deliberately reverted to a visual-only stub earlier this
// session specifically because nothing real existed behind it yet.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_medication_preferences";

export const DEFAULT_MEDICATION_PREFERENCES = {
  // CHANGED 3 Sep 2026 — real ask: "still not showing notifications."
  // Root cause: this defaulted to OFF, so nothing was ever scheduled
  // for a daily medication until someone found Settings > Notifications
  // and manually turned it on — the rest of the notification pipeline
  // (permission banner, action buttons, exact-alarm handling) was
  // already real and working, this single default was silently
  // suppressing all of it. Daily dose reminders are the notification
  // type explicitly asked for most, so this now defaults to ON — still
  // fully OS-permission-gated (see NotificationPermissionBanner), so it
  // can never fire without the user having actually granted Android
  // permission first.
  doseRemindersEnabled: true,
  // ADDED 26 Aug 2026 — real ask: customizable settings, not just an
  // on/off toggle. 30 min matches TakeYourPills/Medisafe's own
  // default snooze length (confirmed via their store listings).
  snoozeMinutes: 30,
  // "Skip until tomorrow" needs to be a real, persisted fact (which
  // medication, until when) so the reminder actually stays suppressed
  // — not just a transient in-app dismiss that would re-fire the
  // moment the app reopens. Keyed by medicationId → ISO date string
  // for "don't remind again until after this date".
  skippedUntil: {},
  // ADDED — real bug found live: "Snooze 30 min" on the due-meds/
  // refill banners only ever rescheduled the NATIVE notification —
  // nothing here persisted a "snoozed until" fact the way skippedUntil
  // above already does for Skip, so the in-app banner's own due-check
  // (medicationReminderSync.js's getDailyMedsState()) found the exact
  // same medication still due a moment later and never actually
  // dismissed. Same shape as skippedUntil, just a shorter horizon and
  // two separate maps — snoozing a dose reminder and snoozing a refill
  // reminder for the SAME medication are different facts, so they get
  // their own keys rather than sharing one.
  snoozedDoseUntil: {},
  snoozedRefillUntil: {},
};

export function isSkippedToday(prefs, medicationId) {
  const skippedUntil = prefs.skippedUntil?.[medicationId];
  if (!skippedUntil) return false;
  return new Date() < new Date(skippedUntil);
}

export function isDoseSnoozed(prefs, medicationId) {
  const until = prefs.snoozedDoseUntil?.[medicationId];
  if (!until) return false;
  return new Date() < new Date(until);
}

export function isRefillSnoozed(prefs, medicationId) {
  const until = prefs.snoozedRefillUntil?.[medicationId];
  if (!until) return false;
  return new Date() < new Date(until);
}

// CHANGED — real groundwork for encryption at rest (see CLAUDE.md's
// Known Issues / the Notion Development log for the full plan): every
// method below is now `async`, `await`ing storage.load()/save() even
// though storageAdapter itself is still 100% synchronous today — a
// no-op behaviorally, same real end-to-end proof as this session's
// other repository conversions. This one's real callers reach into
// live native-notification scheduling and the in-app Take/Snooze/Skip
// due-meds banner (medicationReminderSync.js/refillReminderSync.js,
// via App.jsx) — isSkippedToday()/isDoseSnoozed()/isRefillSnoozed()
// above were already pure (take `prefs` as a parameter), which is
// exactly what kept those two calculations files' own real
// architecture violation (calling this repository internally) from
// being worse than it already was.
export const MedicationPreferencesRepository = {
  async getPreferences() {
    return { ...DEFAULT_MEDICATION_PREFERENCES, ...(await storage.load(STORAGE_KEY, {})) };
  },
  async updatePreferences(changes) {
    const updated = { ...(await this.getPreferences()), ...changes };
    await storage.save(STORAGE_KEY, updated);
    return updated;
  },
  // ADDED 26 Aug 2026 — real "Skip until tomorrow" action: suppresses
  // re-notifying for this medication until local midnight tonight.
  async skipUntilTomorrow(medicationId) {
    const prefs = await this.getPreferences();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return this.updatePreferences({ skippedUntil: { ...prefs.skippedUntil, [medicationId]: tomorrow.toISOString() } });
  },

  // ADDED — the real "Snooze 30 min" action: suppresses the in-app
  // due-meds banner for this medication for `minutes`, same pattern as
  // skipUntilTomorrow above.
  async snoozeDose(medicationId, minutes) {
    const prefs = await this.getPreferences();
    const until = new Date(Date.now() + minutes * 60000);
    return this.updatePreferences({ snoozedDoseUntil: { ...prefs.snoozedDoseUntil, [medicationId]: until.toISOString() } });
  },

  async snoozeRefill(medicationId, minutes) {
    const prefs = await this.getPreferences();
    const until = new Date(Date.now() + minutes * 60000);
    return this.updatePreferences({ snoozedRefillUntil: { ...prefs.snoozedRefillUntil, [medicationId]: until.toISOString() } });
  },
};
