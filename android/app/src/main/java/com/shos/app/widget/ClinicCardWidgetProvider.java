package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.shos.app.R;

public class ClinicCardWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_APPT_TITLE = "clinic_appt_title";
    private static final String KEY_APPT_DATE = "clinic_appt_date";
    private static final String KEY_APPT_LOCATION = "clinic_appt_location";
    private static final String KEY_APPT_TESTS = "clinic_appt_tests";
    private static final String KEY_APPT_DOCTYPE = "clinic_appt_doctype";
    private static final String KEY_APPT_CLINIC_NUM = "clinic_appt_clinic_num";
    // ---------------------------------------------------------------------
    // UNREACHABLE SINCE THIS FILE WAS WRITTEN. Nothing calls this method:
    // the JS side reaches for a "WidgetBridge" Capacitor plugin, and no such
    // plugin is registered in this app — the only @CapacitorPlugin here is
    // ScreenSecurityPlugin. So the guard in clinicVisitReminderSync.js
    // (`if (bridge && bridge.updateClinicCard)`) never passes and none of the
    // values below are ever written. Verified 29 Sep 2026.
    //
    // DO NOT WIRE THIS UP WITHOUT DECIDING THE ENCRYPTION QUESTION FIRST.
    // SharedPreferences is a PLAINTEXT XML file on disk. Every other write in
    // this app goes through storageAdapter, which encrypts, and this app's
    // entire privacy promise is "encrypted at rest, on your own device".
    // Writing an NHS number here would be the single place that promise is
    // broken, and it would be broken in the most obvious file for a future
    // reader to open.
    //
    // Two further problems with the design below, both latent:
    //   1. KEY_APPT_REVEALED lives in the same plaintext prefs, so tapping to
    //      reveal is a PERMANENT flip, not a per-render mask. A lock-screen
    //      widget that masks a value is security theatre if one tap in a
    //      shoulder-surfing moment turns it off forever.
    //   2. An NHS number on a home-screen widget is low value when the Clinic
    //      Card itself is one tap away. Deleting these fields outright is a
    //      product decision for the owner, not a bug fix, which is why it has
    //      not been done unilaterally.
    //
    // Guarded by src/storage/widgetPlaintextSink.test.js, which fails on the
    // change that would make this reachable rather than on the dead code.
    // ---------------------------------------------------------------------
    private static final String KEY_APPT_NHS_NUM = "clinic_appt_nhs_num";

    private static final String KEY_APPT_REVEALED = "clinic_appt_revealed";
    private static final String KEY_REDACTED_TEXT = "redacted_text_clinic_card";ppWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return;
        String title = prefs.getString(KEY_APPT_TITLE, "No upcoming appointment");
        String date = prefs.getString(KEY_APPT_DATE, "");
        String location = prefs.getString(KEY_APPT_LOCATION, "");
        String tests = prefs.getString(KEY_APPT_TESTS, "");
        String docType = prefs.getString(KEY_APPT_DOCTYPE, "");
        String clinicNum = prefs.getString(KEY_APPT_CLINIC_NUM, "");
        // The NHS number is never stored, so it is never read either. The
        // sensitive row renders masked unless revealed, and the revealed branch
        // hides the NHS line outright - see the branch below.
        boolean revealed = prefs.getBoolean(KEY_APPT_REVEALED, false);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.clinic_card_widget);


        // CHANGED 2 Oct 2026 - honour a Redacted tier. The line is built in JS by the

        // caller, which is the only place that knows what this widget means; this

        // provider never learns what a tier is. Returns immediately, because the

        // full rendering below would otherwise overwrite what was just set.

        if (WidgetRedacted.apply(views, R.id.widget_clinic_title, prefs.getString(KEY_REDACTED_TEXT, ""),

                R.id.widget_clinic_date, R.id.widget_clinic_location, R.id.widget_clinic_tests, R.id.widget_clinic_doctype, R.id.widget_clinic_clinic_num, R.id.widget_clinic_nhs_num, R.id.widget_clinic_sensitive_row)) {

            appWidgetManager.updateAppWidget(appWidgetId, views);

            return;

        }

        if (!title.isEmpty() && !title.equals("No upcoming appointment")) {
            views.setTextViewText(R.id.widget_clinic_title, title);
            views.setTextViewText(R.id.widget_clinic_date, date);
            views.setTextViewText(R.id.widget_clinic_location, location);
            views.setTextViewText(R.id.widget_clinic_tests, "Tests: " + tests);

            if (revealed) {
                views.setTextViewText(R.id.widget_clinic_doctype, docType);
                views.setTextViewText(R.id.widget_clinic_clinic_num, clinicNum);
                // The NHS number is NEVER stored any more - WidgetBridgePlugin
                // ignores the field and the provider has no parameter for it.
                // The row is hidden rather than left blank, because an empty
                // line next to a revealed doc type reads as a bug rather than a
                // deliberate omission.
                views.setViewVisibility(R.id.widget_clinic_nhs_num, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_clinic_sensitive_row, android.view.View.VISIBLE);
            } else {
                views.setTextViewText(R.id.widget_clinic_doctype, "••••• tap to reveal");
                views.setTextViewText(R.id.widget_clinic_clinic_num, "••••• tap to reveal");
                views.setTextViewText(R.id.widget_clinic_nhs_num, "••••• tap to reveal");
                views.setViewVisibility(R.id.widget_clinic_sensitive_row, android.view.View.VISIBLE);
            }
        } else {
            views.setTextViewText(R.id.widget_clinic_title, "Clinic Card");
            views.setTextViewText(R.id.widget_clinic_date, "No upcoming appointment");
            views.setTextViewText(R.id.widget_clinic_location, "");
            views.setTextViewText(R.id.widget_clinic_tests, "");
            views.setViewVisibility(R.id.widget_clinic_sensitive_row, android.view.View.GONE);
        }

        // Main click opens full Clinic Card
        Intent mainIntent = new Intent(context, com.shos.app.MainActivity.class);
        mainIntent.setData(Uri.parse("com.shos.app://clinic-card"));
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent mainPendingIntent = android.app.PendingIntent.getActivity(
            context, 0, mainIntent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, mainPendingIntent);

        // Location click opens Maps
        if (!location.isEmpty()) {
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(location)));
            mapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            android.app.PendingIntent mapPendingIntent = android.app.PendingIntent.getActivity(
                context, 1, mapIntent, android.app.PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_clinic_location, mapPendingIntent);
        }

        // Reveal click
        Intent revealIntent = new Intent(context, com.shos.app.MainActivity.class);
        revealIntent.setData(Uri.parse("com.shos.app://widget/reveal-clinic"));
        revealIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        android.app.PendingIntent revealPendingIntent = android.app.PendingIntent.getActivity(
            context, 2, revealIntent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_clinic_reveal, revealPendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // The nhsNum PARAMETER AND ITS KEY ARE GONE, not merely left unwritten.
    // The bridge used to pass a real NHS number here and this method stored it
    // in SharedPreferences - the one place this app's "encrypted at rest"
    // promise would have broken. The Clinic Card is one tap away and already
    // holds the value, so the widget has no reason to keep a copy of a
    // national identifier. Removing the parameter rather than passing "" makes
    // it impossible to reintroduce by accident, and
    // src/storage/widgetPlaintextSink.test.js asserts the write is absent.
    public static void updateClinicCard(Context context, String title, String date, String location,
                                        String tests, String docType, String clinicNum) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return;
        prefs.edit()
            .putString(KEY_APPT_TITLE, title)
            .putString(KEY_APPT_DATE, date)
            .putString(KEY_APPT_LOCATION, location)
            .putString(KEY_APPT_TESTS, tests)
            .putString(KEY_APPT_DOCTYPE, docType)
            .putString(KEY_APPT_CLINIC_NUM, clinicNum)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .putBoolean(KEY_APPT_REVEALED, false)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, ClinicCardWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}