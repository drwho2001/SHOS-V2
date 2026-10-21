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

/**
 * The Refills card's capacity, in LINES.
 *
 * ADDED 21 Oct 2026. The card is 76.7dp of text width inside its padding,
 * which at 11sp is about thirteen characters a line, and it is 134dp tall
 * inside a two-cell placement. So what the card can show is a number of
 * LINES, and the text has to be built to that number rather than discovered
 * against it.
 *
 * This is a hard coupling with the widget layout's `android:maxLines` on
 * `widget_next_refill`, and `widgetRefillCardBudgetGuard.test.js` asserts the
 * two agree - the layout is the thing that actually clips, so a number that
 * lives only in the JS is a number that can drift.
 */
export const REFILL_CARD_LINES = 6;

/**
 * How many characters fit on one line of the NARROWEST card, measured on the
 * device (76.7dp of text width at 11sp). Used for one thing only: guessing
 * whether a medication's NAME wraps onto a second line, so that the line
 * budget below knows what it is spending.
 */
export const REFILL_CARD_CHARS_PER_LINE = 13;

/**
 * The order the card lists its medications in: soonest refill first.
 *
 * The owner's instruction (21 Oct 2026): "should be listed by next due
 * refill, ie vit d or doxy sooner than prep".
 *
 * The key is the SAME number the card's own wording uses - the days until the
 * medication reaches its refill point, which is what "request in 179d" counts
 * down to - so the order and the words cannot disagree. A medication already
 * at its threshold has days === 0, so the ones that need action today sort
 * first without needing a second rule. A medication with no schedule has no
 * days at all, and it sorts last rather than pretending to be urgent. Two
 * medications due on the same day are alphabetical, so the card's order does
 * not shuffle between pushes.
 *
 * PURE and exported, so the ordering can be tested without a repository: the
 * rule is the thing that was wrong (it was "due first, then whatever order
 * the repository returned"), and a test that pasted a copy of a sort would
 * prove nothing about the sort.
 *
 * @param {{med: {name?: string}, days: number|null}[]} rows
 * @returns {typeof rows} a new array, sorted
 */
export function orderByNextRefill(rows) {
  const daysOf = (row) =>
    row.days === null || !Number.isFinite(row.days) ? Infinity : row.days;
  return [...rows].sort((a, b) => {
    const byDays = daysOf(a) - daysOf(b);
    if (byDays !== 0) return byDays;
    return (a.med?.name || "").localeCompare(b.med?.name || "");
  });
}

/**
 * The card's lines, built from the medications' facts.
 *
 * PURE, and exported for that reason: the card's text is the thing that has
 * been wrong three times in a row - it wrapped mid-phrase, it pushed the
 * second medication off the bottom of the card, and it had no idea how many
 * lines it had. Asserting on a copy of this logic in a test would prove
 * nothing, so the logic lives here and the test calls it.
 *
 * TWO GROUPS, because the owner's colour principle (21 Oct 2026): "colour
 * principle of useful information at first glance and then just muddled
 * remainder isn't great". The medication that needs reordering is BRIGHT and
 * everything else is DIM, and a single TextView is a single colour - so the
 * card has two views, and this returns the text for each.
 *
 * The bright group is ONE medication - the soonest one that needs action -
 * and it has two lines: its name and what has happened with its refill. The
 * dim group is everything else, a blank line between medications so the
 * grouping reads, and a last line saying how many are not shown. A card that
 * quietly drops a medication is worse than one that is a line taller, so
 * nothing is dropped without saying so.
 *
 * The stock count ("14 left") is not on the card any more: the two lines the
 * bright group spends are the name and the state, and the count was the one
 * fact here the owner never asked for. It is in the app.
 *
 * @param {{name: string, timing: string, due: boolean}[]} entries
 * @param {number} capacity lines the card can show
 * @returns {{due: string[], later: string[]}} the lines, in reading order
 */
export function buildRefillCardLines(entries, capacity = REFILL_CARD_LINES) {
  const nameLines = (name) => (name.length > REFILL_CARD_CHARS_PER_LINE ? 2 : 1);
  // The medication that needs action now: the soonest one, because the
  // entries arrive in refill order.
  const dueEntry = entries.find((e) => e.due) || null;
  const others = entries.filter((e) => e !== dueEntry);
  // The dim group's lines: two a medication, a BLANK LINE between them, and
  // a line for "+N more" when something does not fit.
  //
  // The blank line is the owner's "spacing of lines not great", and it is also
  // the gap between the bright medication and the dim ones - so the dim group
  // starts with one when there is a bright group to be separated from.
  const restLines = (shown, withLeadingGap) => {
    const lines = withLeadingGap ? [""] : [];
    others.slice(0, shown).forEach((entry, index) => {
      if (index > 0) lines.push("");
      lines.push(entry.name);
      lines.push(entry.timing);
    });
    return lines;
  };
  // The bright group's lines are fixed: the name and the state.
  const dueLines = dueEntry ? [dueEntry.name, dueEntry.timing] : [];
  // THE LINES A GIVEN SET OF MEDICATIONS COSTS, which is what the capacity is
  // spent against. A name longer than a line takes two (the budget has to
  // know, or the last line of the card is pushed off the bottom).
  const costOf = (shown) => {
    let total = dueLines.length + (dueEntry ? 1 : 0); // the leading blank line
    for (const entry of others.slice(0, shown)) {
      total += nameLines(entry.name) + 1;
    }
    if (shown > 1) total += shown - 1; // the blank lines between medications
    return total;
  };
  // How many of the dim medications fit, given the bright one has taken its
  // two lines?
  let shown = others.length;
  while (
    shown > 0 &&
    costOf(shown) + (others.length - shown > 0 ? 1 : 0) > capacity
  ) {
    shown -= 1;
  }
  const later = restLines(shown, dueEntry !== null);
  if (others.length > shown) later.push(`+${others.length - shown} more`);
  return { due: dueLines, later };
}

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
  const ordered = orderByNextRefill(rows);
  const blocks = ordered.map(({ med, stock, days }) => {
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
          ? `due in ${formatRemaining(days).replace(" remaining", "")}`
          : "no schedule";
    // EACH FACT IS ITS OWN LINE, and that is the change of 21 Oct 2026. The card
    // is 76.7dp of text width, about thirteen characters a line at 11sp, so
    // "Sertraline - 14 left - requested" (thirty characters) used to wrap
    // across three lines, break mid-phrase, and push the SECOND medication off
    // the bottom of the card entirely. Every fact here is short enough to sit
    // on one line of the narrowest card:
    //
    //   "Sertraline"   the name
    //   "14 left"      what is in the container
    //   "requested"    what has happened with the refill
    //
    // "due in 179d" rather than "request in 179d": thirteen characters is what
    // fits, and the card's own title ("Refills due") says what is due when.
    return {
      name: med.name,
      // WHETHER IT NEEDS ACTION NOW, which is what makes it the card's bright
      // line rather than part of the dim remainder.
      due: stock.needsAction,
      timing,
    };
  });
  // The HEADLINE: "Soon" or "None".
  //
  // A medication already AT its threshold has days === 0, so it is covered by
  // the same test as one approaching it - there is no separate "now" case to
  // get wrong, and no third word the owner did not ask for.
  const soon = rows.some(
    ({ days }) => days !== null && Number.isFinite(days) && days <= REFILL_SOON_DAYS,
  );
  // TWO STRINGS, because the card has two views: the medication that needs
  // action now is BRIGHT, and the rest are dim. See buildRefillCardLines.
  const lines = buildRefillCardLines(blocks);
  return {
    count: due.length,
    nextRefillDue: lines.due.join("\n"),
    nextRefill: lines.later.join("\n"),
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
    const { count, nextRefill, nextRefillDue, headline } = await getRefillWidgetSummary();

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
      // `nextRefillDue` is the medication that needs reordering now - the
      // card's BRIGHT line - and `nextRefill` is everything else, dim. Both
      // are Full-tier fields: neither is in ALLOWED_AT_REDACTED, so
      // default-deny drops them at the Redacted tier, where the pre-formatted
      // redacted line carries the meaning instead.
      await sendWidgetUpdate(bridge, "refillDue", "updateRefill", { count, nextRefill, nextRefillDue, headline, category: "Refills" },
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
