package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.os.SystemClock;
import android.view.View;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.shos.app.R;

public class NextDoseWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_NEXT_DOSE_TIME = "next_dose_time";
    private static final String KEY_MED_NAME = "med_name";
    // The countdown TARGET as epoch millis, null when there is no future dose.
    private static final String KEY_COUNTDOWN_AT = "countdown_at";

// CHANGED 5 Oct 2026 (t059 follow-on) - the pre-formatted one-line wording for a
// Redacted widget, decided in JS. Distinct per provider because all seven share
// ONE SharedPreferences file, so a shared key name would overwrite itself.
private static final String KEY_REDACTED_TEXT = "redacted_text_next_dose";

    // ADDED 17 Oct 2026 - the ring's horizon: a nominal dosing day.
    //
    // A ring is a fraction OF SOMETHING, and the widget knows the deadline but not
    // the dosing frequency - the payload carries no interval, and inferring one from
    // the interval between two logged doses would be a guess dressed as a
    // measurement. So the horizon is stated here as an assumption rather than
    // derived, and a full ring reads as "a day until your next dose". A medication
    // taken more often than daily simply pins the ring full until the deadline is
    // within a day, which is true if unremarkable.
    private static final long DOSE_HORIZON_MS = 24L * 60L * 60L * 1000L;

    /**
     * Read a colour through the current configuration, so the values-night/
     * counterpart is the one actually drawn.
     *
     * ADDED 17 Oct 2026 - Context.getColor, not a hardcoded int. The dark widget
     * palette was separately contrast-measured against #1D4E4B rather than being a
     * lightened copy of the light one, so reading the raw resource would draw
     * light-mode ink on a dark background.
     */
    private static int colour(Context context, int res) {
        return context.getColor(res);
    }

    /**
     * The wall-clock time of an instant, as "HH:mm", in the device's own zone.
     *
     * ADDED 20 Oct 2026 - the ring's centre carries the time the next dose is
     * due, and it is formatted from the SAME epoch the countdown runs to, so the
     * two can never describe different instants.
     *
     * "HH:mm" rather than DateFormat.getTimeInstance(SHORT): that one follows
     * the device's 12/24-hour setting and drops the leading zero, so the same
     * dose would read "4:00 AM" on one phone and "04:00" on another. This
     * widget is 24-hour throughout - the medication time it shows elsewhere
     * ("Next at 04:00") is 24-hour too - so the format is fixed here rather
     * than inherited.
     *
     * A new formatter per call, because SimpleDateFormat is not thread-safe and
     * this runs in the launcher process.
     */
    private static String clockOf(long epochMs) {
        try {
            return new java.text.SimpleDateFormat("HH:mm", java.util.Locale.US)
                    .format(new java.util.Date(epochMs));
        } catch (RuntimeException e) {
            // A formatter that cannot be built must not take the widget down -
            // the caller falls back to a short word, which is a smaller lie than
            // a crashed provider.
            return "";
        }
    }

    /**
     * The "no data available" RemoteViews. Contains no user data at all, so
     * pushing it can neither write to the plaintext sink nor disclose anything
     * to the launcher process. See res/layout/widget_unavailable.xml.
     */
    private static RemoteViews unavailableViews(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_unavailable);
    }
    @Override
    protected void render(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) {
            // Fail-closed, but never leave the host with nothing. See
            // R.layout.widget_unavailable: a provider that returns before
            // updateAppWidget() leaves the launcher showing its own
            // "Can't load widget", which is indistinguishable from a broken
            // widget. This pushes a layout containing NO user data, so the
            // privacy decision in WidgetPrefs is unchanged - nothing is written
            // in plaintext and nothing is disclosed to the launcher process.
            appWidgetManager.updateAppWidget(appWidgetId, unavailableViews(context));
            return;
        }
        String nextDoseTime = prefs.getString(KEY_NEXT_DOSE_TIME, "--:--");
        String medName = prefs.getString(KEY_MED_NAME, "Medication");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.next_dose_widget);

            // CHANGED 5 Oct 2026 (t059 follow-on) - honour the Redacted tier.
            //
            // sendWidgetUpdate filters the payload, but filtering protects the PAYLOAD
            // and only the provider decides what is RENDERED. The ids are named rather
            // than discovered because RemoteViews is an IPC serialization stub and
            // cannot iterate a view tree.
            // HOISTED 6 Oct 2026 - the root tap target is attached BEFORE the
        // Redacted branch, not after it. Every data provider attached it
        // below the Redacted early-return, so at a Redacted tier the widget
        // rendered but had NO tap target at all - and the owner had set every
        // widget to Redacted. It depends only on `context` and `appWidgetId`,
        // never on the data, so one copy here is correct for every tier.
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);

        // ACTION_VIEW IS LOAD-BEARING, not decoration. Capacitor's own App

        // plugin drops any intent arriving through onNewIntent that is not an

        // ACTION_VIEW - AppPlugin.java:148 does `if (!Intent.ACTION_VIEW.equals

        // (action) || url == null) return;` - so a bare setData() intent never

        // emits appUrlOpen and the tap silently does nothing on a warm app.

        // Verified at source in node_modules/@capacitor/app, not inferred.

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("com.shos.app://medication/dashboard"));
        // SINGLE_TOP without which CLEAR_TOP destroys the running Activity, so
        // onNewIntent never fires, Capacitor's appUrlOpen never fires, and the
        // tap silently lands on Home. The other nine providers needed the same.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        // Per-instance requestCode: without FLAG_UPDATE_CURRENT Android returns
        // the CACHED PendingIntent and drops this data URI.
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                context,
                appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");

// REMOVED 17 Oct 2026 - the `int wDp = WidgetTextFit.widthDp(...)` line and
        // the long note above it are GONE, deliberately and not as tidying.
        //
        // wDp existed solely to be passed to fit(), and this provider has no fit()
        // calls left: both fields that had one now carry autoSizeTextType in the
        // layout, where the framework - not the fitter - does the shrinking. So the
        // local had no reader, and leaving it would be an unused variable plus a
        // comment describing a hoisting rule for a call that no longer exists.
        //
        // The historical note is kept in docs/HISTORY.md and on t116, because the
        // RULE it recorded is still true and still needed elsewhere: a width
        // argument must be passed by the name `wDp`, hoisted above any early
        // return, so widgetTextFitMaxLinesGuard can read the call site. It stopped
        // applying here only because this provider stopped calling the fitter.
        //
        // Deleting the fitter call is not a loss of coverage. autoSizeTextType
        // engages on the real field width (which is why the views are
        // match_parent, not wrap_content) and shrinks to a declared 12sp floor,
        // which is where this app puts its legibility floor anyway. A fitter call
        // left in place would have been worse than nothing: TextView.setTextSize is
        // guarded by !isAutoSizeEnabled(), so it is a deterministic NO-OP, and the
        // fitter's log line - the thing this repo measures truncation with - would
        // have reported a fit that never happened.

        if (redactedText != null && !redactedText.isEmpty()) {
            views.setTextViewText(R.id.widget_med_name, redactedText);
            views.setViewVisibility(R.id.widget_next_dose, View.GONE);
            // ADDED 17 Oct 2026 - the RING and its countdown are hidden at the
            // Redacted tier, for the same reason DoxyPEPWidgetProvider hides its
            // own: a countdown to a dose time is the user's own schedule, and
            // ALLOWED_AT_REDACTED for nextDose is category+state only. A visible
            // view is disclosed data whether or not any text sits beside it.
            views.setViewVisibility(R.id.widget_ring, View.GONE);
            views.setViewVisibility(R.id.widget_ring_label, View.GONE);
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
            // NO fit() call, and that is the change rather than an omission. This
            // view carries autoSizeTextType, so the Redacted line is shrunk by the
            // framework to the same 12sp floor as the Full-tier medication name.
            //
            // The old comment here claimed the Redacted tier "rendered strictly
            // worse than the unrestricted one" because it passed six arguments and
            // so got maxLines=1 against a layout declaring 2. That defect is real
            // and is fixed - but it is fixed by autosize removing the argument list
            // entirely, not by correcting the sixth argument. Correcting it would
            // have left a dead call in place.
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

// ADDED 17 Oct 2026 - every field is written EXPLICITLY in every branch, not just
        // the ones that change. RemoteViews reuses the inflated view between updates,
        // so a widget that was Redacted and then switched back to Full would keep the
        // Redacted line in this slot until something overwrote it. Overwriting every
        // field is what makes a privacy-tier change actually take effect on screen.
        // ADDED 18 Oct 2026 - the Full branch RESTORES visibility. It did not,
        // and that was a live bug rather than a latent one.
        //
        // RemoteViews recycles the inflated view whenever the layout id matches
        // (RemoteViews.canRecycleView, then reapply) and performApply walks ONLY
        // the actions carried by the new RemoteViews - there is no
        // reset-to-defaults pass. So a view the Redacted branch set GONE stayed
        // GONE here forever, and switching Redacted -> Full left the widget
        // showing its title and nothing else. On screen that reads as a SIZING
        // bug, which is why it survived this long.
        //
        // The rule: setting GONE in any branch obliges you to set VISIBLE in the
        // others. Every branch now pins every view it owns.
        views.setViewVisibility(R.id.widget_next_dose, View.VISIBLE);
        views.setTextViewText(R.id.widget_med_name, medName);

        // The wall-clock time with NO "Next dose: " prefix. That prefix measured as
        // roughly a third of the field's width and is exactly what pushed the whole
        // thing into an ellipsis on device; the eyebrow above now says what the
        // widget is, so the restatement is redundant rather than merely long.
        views.setTextColor(R.id.widget_next_dose, colour(context, R.color.widget_text_muted));
        views.setTextViewText(R.id.widget_next_dose, nextDoseTime);

        // CHANGED 2 Oct 2026, kept and now also driving the ring - render the
        // countdown. Kept as its own block rather than folded into a text line,
        // because it has to be HIDDEN when there is no future dose: a Chronometer
        // counting up from zero looks like a live reading and is worse than showing
        // nothing.
        long target = prefs.getLong(KEY_COUNTDOWN_AT, 0L);
        long remaining = target - System.currentTimeMillis();

        // The DUE-NOW case is checked FIRST, and the order is load-bearing.
        //
        // The JS sends the soonest UPCOMING unlock as the countdown target even
        // when a dose is already due, so a card in that state has both: a
        // "Dose due now" line AND a future target. Checking the target first
        // would render the ring around the UPCOMING dose's time while the card
        // claimed the next dose was due now - two different answers on one card,
        // and the one the owner reads is the wrong one.
        boolean dueNow = nextDoseTime != null && nextDoseTime.toLowerCase().contains("due now");

        if (dueNow) {
            // DUE NOW. The ring is FULL rather than hidden or empty: the dose is
            // now, and a depleted ring would read as "nothing pending" - the
            // opposite of the truth, on the one widget where being wrong matters.
            //
            // The ARC cannot be recoloured from a provider at all: RemoteViews.
            // setProgressTintList is a @hide API missing from the SDK level this
            // project compiles against, and build-apk failed all four call sites
            // with "cannot find symbol". So the arc stays widget_good in every
            // state and the urgency signal is the WORD DUE in its centre, which
            // setTextColor can still recolour. See DoxyPEPWidgetProvider for the
            // same finding on the other widget.
            views.setProgressBar(R.id.widget_ring, 100, 100, false);
            views.setViewVisibility(R.id.widget_ring, View.VISIBLE);
            views.setTextColor(R.id.widget_ring_label, colour(context, R.color.widget_urgent));
            views.setTextViewText(R.id.widget_ring_label, "DUE");
            views.setViewVisibility(R.id.widget_ring_label, View.VISIBLE);
            // No countdown line: a Chronometer counting past zero renders a
            // negative duration, which is the one thing it cannot do. The word is
            // the whole message here.
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
            views.setTextColor(R.id.widget_next_dose, colour(context, R.color.widget_urgent));
            views.setTextViewText(R.id.widget_next_dose, "Due now");
            views.setViewVisibility(R.id.widget_next_dose, View.VISIBLE);
        } else if (target > 0 && remaining > 0) {
            // Ring: how much of a nominal dosing day is left. The horizon is a
            // NAMED CONSTANT rather than a stored interval, because the widget
            // genuinely does not know the medication's dosing frequency and must not
            // guess one from the data - a 12-hourly drug and a weekly one would both
            // be wrong if inferred. A full ring means "a day until your next dose",
            // and it is CLAMPED so a dose further out than that reads as full rather
            // than as progress above max.
            int pct = (int) Math.max(0L, Math.min(100L, (remaining * 100L) / DOSE_HORIZON_MS));
            views.setProgressBar(R.id.widget_ring, 100, pct, false);
            views.setViewVisibility(R.id.widget_ring, View.VISIBLE);

            // base is in the SystemClock.elapsedRealtime() timebase, NOT wall-clock.
            // Passing System.currentTimeMillis() here compiles, runs, and produces a
            // nonsense countdown - which is why this converts rather than subtracting.
            views.setChronometer(R.id.widget_countdown,
                    SystemClock.elapsedRealtime() + remaining, "%s", true);
            views.setChronometerCountDown(R.id.widget_countdown, true);
            views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);

            // The ring's centre carries the WALL-CLOCK DUE TIME, which is what the
            // owner asked for: the number that answers "when do I take it".
            //
            // It is formatted from the same epoch the countdown is running to, so
            // the two can never describe different instants - and it is formatted
            // HERE, in the widget's own process, rather than being sent as a
            // pre-formatted string, so there is one value (the epoch) rather than
            // two that have to agree.
            //
            // "HH:mm" rather than the platform's short time format, because that
            // one drops the leading zero and follows the device's 12/24-hour
            // setting; this widget is 24-hour throughout, and the medication
            // times it shows elsewhere ("Next at 04:00") are 24-hour too.
            String dueClock = clockOf(target);
            views.setTextColor(R.id.widget_ring_label, colour(context, R.color.widget_text_primary));
            views.setTextViewText(R.id.widget_ring_label, dueClock.isEmpty() ? "SOON" : dueClock);
            views.setViewVisibility(R.id.widget_ring_label, View.VISIBLE);

            // The separate time line is HIDDEN, not blank: the ring's centre is
            // carrying the time now, so a second "Next at 04:00" under it would
            // say the same thing twice.
            views.setTextViewText(R.id.widget_next_dose, "");
            views.setViewVisibility(R.id.widget_next_dose, View.GONE);
        } else if (target > 0) {
            // OVERDUE. The ring is FULL rather than hidden or empty: the dose is
            // now past, and a depleted ring would read as "nothing pending" - the
            // opposite of the truth, on the one widget where being wrong matters.
            views.setProgressBar(R.id.widget_ring, 100, 100, false);
            views.setViewVisibility(R.id.widget_ring, View.VISIBLE);
            // A Chronometer counting past zero renders a negative duration, so the
            // centre switches to a word. The format string is a template with one
            // unused argument - String.format ignores extra arguments - which is how
            // a Chronometer renders static text without becoming a different view.
            views.setTextColor(R.id.widget_ring_label, colour(context, R.color.widget_urgent));
            views.setTextViewText(R.id.widget_ring_label, "DUE");
            views.setViewVisibility(R.id.widget_ring_label, View.VISIBLE);
            // No countdown line: a Chronometer counting past zero renders a negative
            // duration, which is the one thing it cannot do. The word is the whole
            // message here.
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
            views.setTextColor(R.id.widget_next_dose, colour(context, R.color.widget_urgent));
            views.setTextViewText(R.id.widget_next_dose, "Overdue");
            views.setViewVisibility(R.id.widget_next_dose, View.VISIBLE);
        } else {
            // No dose scheduled at all: there is no countdown to depict, so both the
            // ring and its centre are hidden. An empty ring beside a medication name
            // would read as a depleted one.
            views.setViewVisibility(R.id.widget_ring, View.GONE);
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
            views.setViewVisibility(R.id.widget_ring_label, View.GONE);
            views.setTextViewText(R.id.widget_next_dose, nextDoseTime);
            views.setViewVisibility(R.id.widget_next_dose, View.VISIBLE);
        }

        // CHANGED 4 Oct 2026 - this provider had NO click intent at all, so the
        // widget rendered and tapping it did nothing whatsoever. Every other one
        // of the ten providers had a tap; this one was simply missed, and the
        // guard written to catch bad tap FLAGS skipped it precisely because it
        // had no intent to inspect (see widgetTapAndFallbackGuard.test.js).
        //
        // Destination is the bare `medication` host, not `medication/inventory`.
        // The route table documents bare `medication` as the dashboard "where the
        // per-medication Log-dose buttons live", which is what someone tapping a
        // countdown to their next dose actually wants; inventory is stock level,
        // which is what the Refill widget is for.

        // ---- TEXT FIT PASS (13 Oct 2026, REMOVED 17 Oct 2026) --------------
        //
        // There are deliberately NO fit() calls left in this provider. Both fields
        // that had one now carry autoSizeTextType in the layout, and
        // TextView.setTextSize is guarded by !isAutoSizeEnabled() - so once autosize
        // is on, a setTextViewTextSize is a deterministic no-op and the fitter would
        // log a decision that never happened. That is worse than no helper: the log
        // is what this repo measures truncation with, so a fitter that silently does
        // nothing would be evidence of a fit that did not occur.
        //
        // The third field, the wall-clock time, is five characters and fits at 12sp
        // in any width this widget can be placed at, so it has nothing to measure.
        // widgetTextFitMaxLinesGuard asserts the site's count, so removing them is a
        // change to that number and not a silent cleanup.

        // -------------------------------------------------------------------

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateNextDose(Context context, String medName, String nextDoseTime, long countdownAt,
                                       String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return; // no instance in scope here; the per-instance
            // updateAppWidget() above is what pushes the fallback
        prefs.edit()
            .putString(KEY_MED_NAME, medName)
            .putString(KEY_NEXT_DOSE_TIME, nextDoseTime)
            // 0 rather than removing the key when there is no future dose: the
            // read side checks the value against now, so a stale key left behind
            // by a previously-set countdown can never resurrect an old deadline.
            .putLong(KEY_COUNTDOWN_AT, countdownAt)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(new android.content.ComponentName(context, NextDoseWidgetProvider.class));
        for (int id : ids) {
            new NextDoseWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
