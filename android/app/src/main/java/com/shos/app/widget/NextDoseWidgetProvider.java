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

public class NextDoseWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_NEXT_DOSE_TIME = "next_dose_time";
    private static final String KEY_MED_NAME = "med_name";
    // The countdown TARGET as epoch millis, null when there is no future dose.
    private static final String KEY_COUNTDOWN_AT = "countdown_at";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
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
    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
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
        views.setTextViewText(R.id.widget_med_name, medName);
        views.setTextViewText(R.id.widget_next_dose, "Next dose: " + nextDoseTime);

        // CHANGED 2 Oct 2026 - render the countdown. Kept as its own block
        // rather than folded into the text line, because it has to be HIDDEN
        // when there is no future dose: a Chronometer counting up from zero
        // looks like a live reading and is worse than showing nothing.
        if (prefs.contains(KEY_COUNTDOWN_AT)) {
            long target = prefs.getLong(KEY_COUNTDOWN_AT, 0L);
            long remaining = target - System.currentTimeMillis();
            if (remaining > 0) {
                // CHANGED 2 Oct 2026, after getting both signatures wrong and
                // checking the docs rather than trusting memory (L-046):
                //
                //   setChronometer(int viewId, long base, String format, boolean started)
                //   setChronometerCountDown(int viewId, boolean isCountDown)
                //
                // The second takes a BOOLEAN, not a timestamp - it only sets
                // which way to count. The deadline goes in through setChronometer
                // as `base`.
                //
                // And base is in the SystemClock.elapsedRealtime() timebase, NOT
                // wall-clock. Passing System.currentTimeMillis() here compiles,
                // runs, and produces a nonsense countdown - which is why this
                // converts rather than subtracting.
                long base = SystemClock.elapsedRealtime() + remaining;
                // format null keeps the platform default (H:MM:SS). "%s" is
                // substituted with the timer value, so "in %s" reads "in 4:12:30".
                views.setChronometer(R.id.widget_countdown, base, "in %s", true);
                views.setChronometerCountDown(R.id.widget_countdown, true);
                views.setViewVisibility(R.id.widget_countdown, View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_countdown, View.GONE);
            }
        } else {
            views.setViewVisibility(R.id.widget_countdown, View.GONE);
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

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateNextDose(Context context, String medName, String nextDoseTime, long countdownAt) {
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
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(new android.content.ComponentName(context, NextDoseWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}