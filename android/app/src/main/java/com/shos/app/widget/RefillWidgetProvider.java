package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class RefillWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_REFILL_COUNT = "refill_count";
    private static final String KEY_NEXT_REFILL = "next_refill_med";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int refillCount = prefs.getInt(KEY_REFILL_COUNT, 0);
        String nextRefill = prefs.getString(KEY_NEXT_REFILL, "No refills due");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.refill_widget);
        
        if (refillCount > 0) {
            views.setTextViewText(R.id.widget_refill_title, "Refills Due");
            views.setTextViewText(R.id.widget_refill_count, refillCount + " medication" + (refillCount == 1 ? "" : "s"));
            views.setTextViewText(R.id.widget_next_refill, "Next: " + nextRefill);
        } else {
            views.setTextViewText(R.id.widget_refill_title, "Refills Due");
            views.setTextViewText(R.id.widget_refill_count, "All stocked");
            views.setTextViewText(R.id.widget_next_refill, "");
        }

        // Click opens Medication tab
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setAction("shos://medication");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateRefill(Context context, int count, String nextRefillMed) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putInt(KEY_REFILL_COUNT, count)
            .putString(KEY_NEXT_REFILL, nextRefillMed)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, RefillWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}