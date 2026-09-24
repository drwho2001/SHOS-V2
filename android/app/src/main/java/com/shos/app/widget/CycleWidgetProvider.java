package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import com.shos.app.R;

public class CycleWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_CYCLE_DAY = "cycle_day";
    private static final String KEY_CYCLE_PHASE = "cycle_phase";
    private static final String KEY_NEXT_PERIOD = "next_period";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int cycleDay = prefs.getInt(KEY_CYCLE_DAY, 0);
        String phase = prefs.getString(KEY_CYCLE_PHASE, "No cycle data");
        String nextPeriod = prefs.getString(KEY_NEXT_PERIOD, "—");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.cycle_widget);

        if (cycleDay > 0) {
            views.setTextViewText(R.id.widget_cycle_title, "Cycle Day " + cycleDay);
            views.setTextViewText(R.id.widget_cycle_phase, phase);
            views.setTextViewText(R.id.widget_next_period, "Next period: " + nextPeriod);
        } else {
            views.setTextViewText(R.id.widget_cycle_title, "Menstrual Cycle");
            views.setTextViewText(R.id.widget_cycle_phase, "Tracking off or no data");
            views.setTextViewText(R.id.widget_next_period, "");
        }

        // Click opens Healthcare > Menstrual tab
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setAction("shos://healthcare?subTab=menstrual");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateCycle(Context context, int day, String phase, String nextPeriod) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putInt(KEY_CYCLE_DAY, day)
            .putString(KEY_CYCLE_PHASE, phase)
            .putString(KEY_NEXT_PERIOD, nextPeriod)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, CycleWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}