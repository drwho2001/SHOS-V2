// refillReminderSync.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: unified notifications, "when refill due". Same three-layer
// split as doxyPepSync.js/medicationReminderSync.js — computeStock()
// in medicationCalculations.js stays the pure "is this low" answer,
// this file is the one place that reads real data and decides what to
// actually schedule.
//
// WHY THIS FIRES IMMEDIATELY RATHER THAN AT A FUTURE TIME: unlike a
// dose interval or a booked appointment, "stock is low" has no future
// timestamp to schedule ahead for — it's already true or not, the
// moment this runs (which is exactly when a dose/refill/waste entry
// was just logged, or the app was just opened). So this schedules a
// few seconds out, same "already due" pattern medicationReminderSync's
// own due-now case already uses, rather than pretending there's a
// real future due-date to count down to.
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { computeStock, effectiveDoseIntervalHours, formatRemaining } from "./medicationCalculations";
import { scheduleNotification, cancelNotification, NOTIFICATION_IDS, moduleSmallIconName, REFILL_ACTION_TYPE_ID } from "../storage/notificationService";
import { NotificationPreferencesRepository } from "../repositories/notificationPreferencesRepository";
import { MedicationPreferencesRepository, isRefillSnoozed } from "../repositories/medicationPreferencesRepository";
import { ACCENTS } from "./designTokens";
import { AppPreferencesRepository } from "../repositories/appPreferencesRepository";
// Pure module, no imports of its own, so this cannot cycle - and a static
// import matches this file's style rather than medicationReminderSync's
// dynamic one.
import { buildRefillSignature, shouldSuppressDeviceNotification, normaliseAcknowledgements } from "./reminderSuppression";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import { getWidgetBridge } from "./widgetBridge";
import { redactedWidgetLine } from "./widgetPrivacy";


// Pure "what currently needs a refill" read, shared by syncRefillReminder
// (decides whether to schedule) and App.jsx's in-app due-state banner
// (same live check, no separate concept to drift out of sync).
export async function getRefillDueMedications() {
  const prefs = await MedicationPreferencesRepository.getPreferences();
  const meds = await Promise.all(
    (await MedicationRepository.getAll())
      .filter((m) => !m.isArchived && m.inventoryTracked)
      .map(async (m) => ({ ...m, logs: await LogRepository.getForMedication(m.id) }))
  );
  // Already flagged "requested" — the user's already acted on it (see
  // Medication's own markRequested()), a repeat notification for the
  // same low stock would just be noise until it's actually refilled.
  // FIXED — real bug: "Snooze 30 min" only ever rescheduled the native
  // notification, never persisted anything this read checked, so the
  // in-app banner never actually dismissed — see
  // medicationPreferencesRepository.js's own isRefillSnoozed() comment.
  // ADDED 16 Sep 2026 — refillCancelledAt is the same kind of
  // suppression as refillRequestedAt (cleared by the next real logged
  // refill), just without implying an order was actually placed — see
  // the banner's own "Cancel" action in App.jsx.
  return meds.filter((m) => computeStock(m).needsAction && !m.refillRequestedAt && !m.refillCancelledAt && !isRefillSnoozed(prefs, m.id));
}

/**
 * How many days ahead of a refill point count as "SOON" for the Refills Due
 * widget's headline.
 *
 * ADDED 20 Oct 2026, on the owner's own instruction: the widget's headline used
 * to read "All stocked" whenever no medication was AT its threshold, which is a
 * non-answer - and on this device it was literally false, because the only
 * tracked medication was one day from its reorder point.
 *
 * THREE DAYS, which is the owner's number (20 Oct 2026: "soon is 3 days") -
 * a refill three days out is the soonest thing that is still a plan rather
 * than a problem, and anything further out is not yet a decision.
 *
 * What it is NOT: a claim about how long a pharmacy takes. Nothing here knows
 * that, and guessing it is the mistake this file already documents in
 * getRefillWidgetSummary - a hardcoded lead time is a guess dressed as a
 * measurement. The number is about the USER's own reorder point, which is the
 * app's own `refillThreshold` and therefore the user's own buffer.
 */
const REFILL_SOON_DAYS = 3;

export async function getRefillWidgetSummary() {
  const meds = await Promise.all(
    (await MedicationRepository.getAll())
      .filter((m) => !m.isArchived && m.inventoryTracked)
      .map(async (m) => ({ ...m, logs: await LogRepository.getForMedication(m.id) })),
  );
  // The days until each medication reaches its refill point, computed ONCE per
  // medication and then used twice: for the line under the headline, and for the
  // headline itself. They have to come from the same number, or the card can
  // say "Soon" above a line that says "request in 30d" - which is the defect
  // this whole change exists to remove.
  const rows = meds.map((med) => {
    const stock = computeStock(med);
    const intervalHours = effectiveDoseIntervalHours(med);
    const dailyConsumption = intervalHours ? (med.unitsPerDose * 24) / intervalHours : 0;
    const days = dailyConsumption && stock.currentStock != null
      ? Math.max(0, (stock.currentStock - med.refillThreshold) / dailyConsumption)
      : null;
    return { med, stock, days };
  });
  const due = rows.filter(({ stock }) => stock.needsAction);
  const ordered = [...due, ...rows.filter(({ stock }) => !stock.needsAction)];
  const lines = ordered.map(({ med, stock, days }) => {
    // ADDED 21 Oct 2026 - the line says what has HAPPENED, not what the reader
    // should do.
    //
    // The owner had already marked the refill as requested in the app, and the
    // card was still telling them to request it: "request now" reads as an
    // instruction, and it is the wrong instruction for something already done.
    // The app knows - refillRequestedAt is the fact, and it is not a second
    // stored flag (the repo's own rule: store facts, derive state) - so the line
    // says "requested" when it has been requested and asks for it when it has
    // not.
    //
    // A cancelled request is not a request: the user took it back, so the card
    // asks again.
    const timing = med.refillRequestedAt && !med.refillCancelledAt
      ? "requested"
      : stock.needsAction
        ? "request now"
        : days !== null && Number.isFinite(days)
          ? `request in ${formatRemaining(days).replace(" remaining", "")}`
          : "no schedule";
    return `${med.name} · ${Math.max(0, stock.currentStock)} left · ${timing}`;
  });
  // The HEADLINE: "Soon" or "None".
  //
  // A medication already AT its threshold has days === 0, so it is covered by
  // the same test as one approaching it - there is no separate "now" case to
  // get wrong, and no third word the owner did not ask for.
  const soon = rows.some(
    ({ days }) => days !== null && Number.isFinite(days) && days <= REFILL_SOON_DAYS,
  );
  return {
    count: due.length,
    nextRefill: lines.length ? lines.slice(0, 4).join("\n") : "No medications tracked",
    headline: soon ? "Soon" : "None",
  };
}

// ADDED 29 Sep 2026 (Phase 3, t013) - the SECOND stage. Marking a refill
// "requested" currently makes the item disappear completely: getRefillDueMedications
// above filters it out, so the in-app banner stops, the notification stops, and
// the only trace is one line on the medication card. If the pharmacy is out of
// stock, or you simply forget, nothing ever brings it back - which is the same
// silent-loss shape this feature was built to fix, one stage later.
//
// This is DERIVED, not a second stored flag. `refillRequestedAt` is the fact
// ("you asked for this"); whether it is still outstanding is calculated from
// live stock, so logging the refill retires it automatically with no second
// write and no way for the two to disagree. That is the repo's own "store
// facts, derive state" rule, and the reason there is no `refillCollectedAt`.
//
// DELIBERATELY NO TIMER. It is tempting to bring this back after N days, and
// there is no sourced number for N - which is exactly the trap the medication
// lockout's 0.8 and 0.2 factors fell into before the NHS figures were found.
// So the second stage does not nag: it is a passive count, and the item clears
// itself the moment a refill is logged. A reminder that re-appears forever is
// the behaviour this whole feature was built to remove.
//
// `needsAction` is re-checked rather than assumed: if stock recovered on its own
// (say a correction), there is nothing left to collect.
export async function getRefillAwaitingCollection() {
  const meds = await Promise.all(
    (await MedicationRepository.getAll())
      .filter((m) => !m.isArchived && m.inventoryTracked)
      .map(async (m) => ({ ...m, logs: await LogRepository.getForMedication(m.id) }))
  );
  return meds.filter(
    (m) => !!m.refillRequestedAt && !m.refillCancelledAt && computeStock(m).needsAction
  );
}

// ADDED 29 Sep 2026 (t013) - the way back. Marking a refill "requested" hides
// the action that marked it, so a mis-tap on a small button had NO route out
// except logging a refill that never happened. That is the same defect as a
// persisted silence with no escape, which this repo has recorded as a rule
// rather than a preference: one wrong tap must not mean a medication is
// invisible until the user works out why.
//
// It clears BOTH suppression timestamps, not just `refillRequestedAt`, because
// "I didn't order this" and "I cancelled this" are the same statement about the
// same item, and leaving one behind would make it vanish again for a reason the
// user cannot see.
export async function handleUndoRefillRequest(ids = null) {
  const meds = (await getRefillAwaitingCollection()).filter((m) => !ids || ids.includes(m.id));
  const names = meds.map((m) => m.name);
  for (const m of meds) {
    await MedicationRepository.update(m.id, { refillRequestedAt: null, refillCancelledAt: null });
  }
  return { medications: names };
}

export async function syncRefillReminder() {
  if (!(await NotificationPreferencesRepository.getPreferences()).refillReminderEnabled) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    return { scheduled: false };
  }

  const needsRefill = await getRefillDueMedications();

  if (needsRefill.length === 0) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    await updateRefillWidget();
    return { scheduled: false };
  }

  const names = needsRefill.map((m) => m.name).join(", ");

  // ADDED 29 Sep 2026 (Phase 3 / A3) - device-silence, which was wired ONLY for
  // medications, so "also stop my phone notifying me" silently did nothing on
  // this banner.
  //
  // This is the kind where the bug is real rather than theoretical, and it is
  // worth being precise about why. The schedule below uses `at: now + 3s`, and
  // this function runs on the 60-second poll, on mount, and on data change -
  // so while a refill is outstanding the phone was re-armed three seconds out
  // over and over. The banner said "stop reminding me" and the device kept
  // buzzing. Signature-based, so it lasts only while this exact set of
  // medications is outstanding: reorder, and a genuinely new reminder is free
  // to speak up again.
  const appPrefs = await AppPreferencesRepository.getPreferences();
  const acknowledged = normaliseAcknowledgements(
    (await AppPreferencesRepository.getPreferences()).acknowledgedReminders
  );
  if (shouldSuppressDeviceNotification(buildRefillSignature(needsRefill), acknowledged, appPrefs.reminderSuppressionEnabled !== false)) {
    await cancelNotification(NOTIFICATION_IDS.refillReminder);
    await updateRefillWidget();
    return { scheduled: false, acknowledged: true };
  }

  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: `${names} — running low, time to reorder`,
    at: new Date(Date.now() + 3000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    kind: "Refill reminder",
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  await updateRefillWidget();
  return { scheduled: true, needsRefill };
}

export async function updateRefillWidget() {
  try {
    const { count, nextRefill, headline } = await getRefillWidgetSummary();

    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateRefill) {
      // CHANGED 2 Oct 2026 - routed through sendWidgetUpdate. NOTE this
      // function's twin in medicationReminderSync.js sends the same payload to
      // the same bridge method; both are wired to the shared helper so neither
      // can drift from the tier rule, but the duplication itself is still worth
      // collapsing. Left as-is rather than refactored mid-change.
      //
      // `headline` is the card's one-word answer - "Soon" or "None" - computed
      // from the same stock projection the lines below it are built from. It is
      // a Full-tier field: it is not in ALLOWED_AT_REDACTED, so default-deny
      // drops it at the Redacted tier, where the pre-formatted redacted line
      // carries the meaning instead.
      await sendWidgetUpdate(bridge, "refillDue", "updateRefill", { count, nextRefill, headline, category: "Refills" },
        refillRedactedLine(count));
    }
  } catch (e) {
    // Widget bridge not available (web) — ignore
    console.debug("Widget update skipped:", e);
  }
}

// ADDED — real ask: parity with Medication/DoxyPEP's own notification
// action buttons. Mirrors Medication Dashboard's existing one-tap
// markRequested() exactly (same field, same real-UTC timestamp
// convention — refillRequestedAt is only ever shown at day granularity
// via daysFromNow(), never an exact time, so real-UTC here matches
// existing precedent rather than needing the fake-UTC helper). Marking
// every currently-due medication as requested naturally clears them
// from getRefillDueMedications() on the next sync, so re-syncing here
// is what actually cancels the notification/banner — same "acting
// clears the reminder" pattern Take-all uses for medication doses.
// `ids`, when given, scopes the action to that subset of currently-due
// medications instead of all of them — used by App.jsx's own banner to
// keep the fuller Requested/Snooze-2h/Snooze-1-day/Cancel action set
// (real ask, 16 Sep 2026) scoped to repeating (daily/custom) medications
// only, never touching a PRN medication that happens to be due at the
// same time.
export async function handleMarkRefillRequested(ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name);
  for (const m of needsRefill) await MedicationRepository.update(m.id, { refillRequestedAt: new Date().toISOString() });
  return { medications: names };
}

// ADDED 16 Sep 2026 — real ask: a "Cancel" action distinct from
// Requested — "I'm not refilling this cycle" rather than "I've ordered
// it" — see medicationRepository.js's own refillCancelledAt comment
// for why this is a temporary suppression (cleared by the next real
// logged refill), not a permanent dismissal.
export async function handleCancelRefill(ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name);
  for (const m of needsRefill) await MedicationRepository.update(m.id, { refillCancelledAt: new Date().toISOString() });
  return { medications: names };
}

// CHANGED 16 Sep 2026 — real ask: "Snooze 30 min" replaced with
// Snooze 2h/Snooze 1 day for repeating medications (a 30-minute
// refill-reminder snooze rarely gives enough real time to actually
// place an order) — minutes is now a real parameter instead of a
// hardcoded 30, kept as the default for any caller that doesn't
// specify one (e.g. a native notification action).
export async function handleSnoozeRefill(minutes = 30, ids = null) {
  const needsRefill = (await getRefillDueMedications()).filter((m) => !ids || ids.includes(m.id));
  const names = needsRefill.map((m) => m.name).join(", ");
  // FIXED — real bug: this used to only reschedule the native
  // notification — see medicationPreferencesRepository.js's own
  // isRefillSnoozed() comment for why that never actually dismissed
  // the in-app banner.
  for (const m of needsRefill) await MedicationPreferencesRepository.snoozeRefill(m.id, minutes);
  await scheduleNotification({
    id: NOTIFICATION_IDS.refillReminder,
    title: "Refill needed",
    body: names ? `${names} — running low, time to reorder` : "Reminder snoozed",
    at: new Date(Date.now() + minutes * 60000),
    actionTypeId: REFILL_ACTION_TYPE_ID,
    kind: "Refill reminder",
    smallIcon: moduleSmallIconName("medication"),
    iconColor: ACCENTS.medication,
  });
  return { minutes };
}

/**
 * ADDED 5 Oct 2026 (t059 follow-on) - the Redacted line for the Refills widget.
 *
 * BOTH this file and medicationReminderSync.js push refillDue, so the builder
 * exists in both rather than being imported across a pusher boundary that exists
 * only because syncAllWidgets lists them as one entry. Deliberate duplication,
 * recorded here rather than collapsed mid-change.
 *
 * ALLOWED_AT_REDACTED permits category + count, so the line carries how many
 * medications are low and drops the medication NAME - the field that discloses,
 * since a named medication on a home screen states what the user takes.
 */
export function refillRedactedLine(count) {
  const n = Number(count);
  return redactedWidgetLine("Refills", Number.isFinite(n) && n > 0 ? `${n} due` : "all stocked");
}
