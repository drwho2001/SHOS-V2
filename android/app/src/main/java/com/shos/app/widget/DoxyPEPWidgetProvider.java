package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class DoxyPEPWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_DOXY_STATUS = "doxy_status";
    private static final String KEY_DOXY_EXPIRY = "doxy_expiry";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String status = prefs.getString(KEY_DOXY_STATUS, "No active window");
        long expiry = prefs.getLong(KEY_DOXY_EXPIRY, 0);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.doxy_pep_widget);

        if (expiry > 0) {
            long remaining = expiry - System.currentTimeMillis();
            if (remaining > 0) {
                long hours = remaining / (1000 * 60 * 60);
                long minutes = (remaining % (1000 * 60 * 60)) / (1000 * 60);
                views.setTextViewText(R.id.widget_doxy_title, "DoxyPEP Window");
                views.setTextViewText(R.id.widget_doxy_status, "Active");
                views.setTextViewText(R.id.widget_doxy_countdown, String.format("%dh %dm remaining", hours, minutes));
            } else {
                views.setTextViewText(R.id.widget_doxy_title, "DoxyPEP Window");
                views.setTextViewText(R.id.widget_doxy_status, "Expired");
                views.setTextViewText(R.id.widget_doxy_countdown, "Take within 72h of exposure");
            }
        } else {
            views.setTextViewText(R.id.widget_doxy_title, "DoxyPEP Window");
            views.setTextViewText(R.id.widget_doxy_status, status);
            views.setTextViewText(R.id.widget_doxy_countdown, "");
        }

        // Click opens Medication tab
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setData(Uri.parse("com.shos.app://medication/dashboard"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateDoxyPEP(Context context, String status, long expiryMs) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_DOXY_STATUS, status)
            .putLong(KEY_DOXY_EXPIRY, expiryMs)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, DoxyPEPWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}