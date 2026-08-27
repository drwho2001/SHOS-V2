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
  doseRemindersEnabled: false,
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
};

export function isSkippedToday(prefs, medicationId) {
  const skippedUntil = prefs.skippedUntil?.[medicationId];
  if (!skippedUntil) return false;
  return new Date() < new Date(skippedUntil);
}

export const MedicationPreferencesRepository = {
  getPreferences() {
    return { ...DEFAULT_MEDICATION_PREFERENCES, ...storage.load(STORAGE_KEY, {}) };
  },
  updatePreferences(changes) {
    const updated = { ...this.getPreferences(), ...changes };
    storage.save(STORAGE_KEY, updated);
    return updated;
  },
  // ADDED 26 Aug 2026 — real "Skip until tomorrow" action: suppresses
  // re-notifying for this medication until local midnight tonight.
  skipUntilTomorrow(medicationId) {
    const prefs = this.getPreferences();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return this.updatePreferences({ skippedUntil: { ...prefs.skippedUntil, [medicationId]: tomorrow.toISOString() } });
  },
};
