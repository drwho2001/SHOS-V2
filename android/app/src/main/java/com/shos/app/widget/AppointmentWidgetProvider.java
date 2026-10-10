package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class AppointmentWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_APPT_COUNT = "appt_count";
    private static final String KEY_NEXT_APPT = "next_appt";
    // ADDED 10 Oct 2026 (t088) - the time of day and the location of the
    // appointment on the line above. Empty at a tier that dropped them: both
    // are identifying, and nextAppointment's Redacted allowlist is
    // ["category", "count"], so they never arrive. Empty is the right default
    // rather than the field's absence, so a stale Full-tier value cannot
    // survive into a later Redacted push.
    private static final String KEY_APPT_TIME = "appt_time";
    private static final String KEY_APPT_LOCATION = "appt_location";

// CHANGED 5 Oct 2026 (t059 follow-on) - the pre-formatted one-line wording for a
// Redacted widget, decided in JS. Distinct per provider because all seven share
// ONE SharedPreferences file, so a shared key name would overwrite itself.
private static final String KEY_REDACTED_TEXT = "redacted_text_appt";

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
        int apptCount = prefs.getInt(KEY_APPT_COUNT, 0);
        String nextAppt = prefs.getString(KEY_NEXT_APPT, "No appointments");
        String apptTime = prefs.getString(KEY_APPT_TIME, "");
        String apptLocation = prefs.getString(KEY_APPT_LOCATION, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.appointment_widget);

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
        intent.setData(Uri.parse("com.shos.app://clinic-visits"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
            if (redactedText != null && !redactedText.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_title, redactedText);
            views.setViewVisibility(R.id.widget_appt_count, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_next_appt, android.view.View.GONE);
                // ADDED 10 Oct 2026 (t088) - time and location are identifying,
                // so they are hidden here as well. Declared rather than relying on
                // an empty string: an empty TextView still occupies layout, so a
                // blank line would read as a rendering fault.
                views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }

        if (apptCount > 0) {
            views.setTextViewText(R.id.widget_appt_title, "Appointments");
            views.setTextViewText(R.id.widget_appt_count, apptCount + " upcoming");
            views.setTextViewText(R.id.widget_next_appt, "Next: " + nextAppt);

            // ADDED 10 Oct 2026 (t088) - time and location on their own lines.
            // Each is GONE rather than blank when absent, because an empty
            // TextView still occupies layout and reads as a broken widget.
            if (apptTime != null && !apptTime.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_time, apptTime);
                views.setViewVisibility(R.id.widget_appt_time, android.view.View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
            }

            // Location click opens Maps - the SAME pattern as
            // ClinicCardWidgetProvider, rather than a second invention: a
            // geo: intent on the location view itself, with a request code
            // offset by appWidgetId so it cannot collide with the root intent
            // above. Uri.encode is what keeps a location containing an
            // apostrophe or a comma from producing a malformed URI.
            if (apptLocation != null && !apptLocation.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_location, apptLocation);
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.VISIBLE);
                Intent mapIntent = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("geo:0,0?q=" + Uri.encode(apptLocation)));
                android.app.PendingIntent mapPendingIntent = android.app.PendingIntent.getActivity(
                        context,
                        appWidgetId * 10 + 1,
                        mapIntent,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                views.setOnClickPendingIntent(R.id.widget_appt_location, mapPendingIntent);
            } else {
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
            }
        } else {
            views.setTextViewText(R.id.widget_appt_title, "Appointments");
            views.setTextViewText(R.id.widget_appt_count, "None booked");
            views.setTextViewText(R.id.widget_next_appt, "");
            // ADDED 10 Oct 2026 (t088) - hidden here as well as on the Full-tier
            // path. Without this, a user who deletes their last appointment keeps
            // seeing its time and location on the widget, which is the stale-data
            // shape this whole file's unconditional-push rule exists to prevent.
            views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
        }

        // Click opens Clinic Visits tab

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAppointment(Context context, int count, String nextAppt,
                                         String redactedText,
                                         String apptTime, String apptLocation) {
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
            .putInt(KEY_APPT_COUNT, count)
            .putString(KEY_NEXT_APPT, nextAppt)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            // ADDED 10 Oct 2026 (t088) - the two new fields, defaulted to ""
            // rather than to the field's absence, for the reason above.
            .putString(KEY_APPT_TIME, apptTime == null ? "" : apptTime)
            .putString(KEY_APPT_LOCATION, apptLocation == null ? "" : apptLocation)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, AppointmentWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}