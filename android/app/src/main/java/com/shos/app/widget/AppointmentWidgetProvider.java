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

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int apptCount = prefs.getInt(KEY_APPT_COUNT, 0);
        String nextAppt = prefs.getString(KEY_NEXT_APPT, "No appointments");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.appointment_widget);

        if (apptCount > 0) {
            views.setTextViewText(R.id.widget_appt_title, "Appointments");
            views.setTextViewText(R.id.widget_appt_count, apptCount + " upcoming");
            views.setTextViewText(R.id.widget_next_appt, "Next: " + nextAppt);
        } else {
            views.setTextViewText(R.id.widget_appt_title, "Appointments");
            views.setTextViewText(R.id.widget_appt_count, "None booked");
            views.setTextViewText(R.id.widget_next_appt, "");
        }

        // Click opens Clinic Visits tab
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setData(Uri.parse("com.shos.app://clinic-visits"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateAppointment(Context context, int count, String nextAppt) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putInt(KEY_APPT_COUNT, count)
            .putString(KEY_NEXT_APPT, nextAppt)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, AppointmentWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}