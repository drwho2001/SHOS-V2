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
    private static final String KEY_APPT_NHS_NUM = "clinic_appt_nhs_num";
    private static final String KEY_APPT_REVEALED = "clinic_appt_revealed";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String title = prefs.getString(KEY_APPT_TITLE, "No upcoming appointment");
        String date = prefs.getString(KEY_APPT_DATE, "");
        String location = prefs.getString(KEY_APPT_LOCATION, "");
        String tests = prefs.getString(KEY_APPT_TESTS, "");
        String docType = prefs.getString(KEY_APPT_DOCTYPE, "");
        String clinicNum = prefs.getString(KEY_APPT_CLINIC_NUM, "");
        String nhsNum = prefs.getString(KEY_APPT_NHS_NUM, "");
        boolean revealed = prefs.getBoolean(KEY_APPT_REVEALED, false);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.clinic_card_widget);

        if (!title.isEmpty() && !title.equals("No upcoming appointment")) {
            views.setTextViewText(R.id.widget_clinic_title, title);
            views.setTextViewText(R.id.widget_clinic_date, date);
            views.setTextViewText(R.id.widget_clinic_location, location);
            views.setTextViewText(R.id.widget_clinic_tests, "Tests: " + tests);

            if (revealed) {
                views.setTextViewText(R.id.widget_clinic_doctype, docType);
                views.setTextViewText(R.id.widget_clinic_clinic_num, clinicNum);
                views.setTextViewText(R.id.widget_clinic_nhs_num, nhsNum);
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

    public static void updateClinicCard(Context context, String title, String date, String location,
                                        String tests, String docType, String clinicNum, String nhsNum) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_APPT_TITLE, title)
            .putString(KEY_APPT_DATE, date)
            .putString(KEY_APPT_LOCATION, location)
            .putString(KEY_APPT_TESTS, tests)
            .putString(KEY_APPT_DOCTYPE, docType)
            .putString(KEY_APPT_CLINIC_NUM, clinicNum)
            .putString(KEY_APPT_NHS_NUM, nhsNum)
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