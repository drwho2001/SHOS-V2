package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class NextDoseWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_NEXT_DOSE_TIME = "next_dose_time";
    private static final String KEY_MED_NAME = "med_name";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String nextDoseTime = prefs.getString(KEY_NEXT_DOSE_TIME, "--:--");
        String medName = prefs.getString(KEY_MED_NAME, "Medication");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.next_dose_widget);
        views.setTextViewText(R.id.widget_med_name, medName);
        views.setTextViewText(R.id.widget_next_dose, "Next dose: " + nextDoseTime);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateNextDose(Context context, String medName, String nextDoseTime) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_MED_NAME, medName)
            .putString(KEY_NEXT_DOSE_TIME, nextDoseTime)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(new android.content.ComponentName(context, NextDoseWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}