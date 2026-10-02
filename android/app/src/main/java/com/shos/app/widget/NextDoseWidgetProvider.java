package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import com.shos.app.R;

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

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return;
        String nextDoseTime = prefs.getString(KEY_NEXT_DOSE_TIME, "--:--");
        String medName = prefs.getString(KEY_MED_NAME, "Medication");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.next_dose_widget);
        views.setTextViewText(R.id.widget_med_name, medName);
        views.setTextViewText(R.id.widget_next_dose, "Next dose: " + nextDoseTime);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateNextDose(Context context, String medName, String nextDoseTime) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return;
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