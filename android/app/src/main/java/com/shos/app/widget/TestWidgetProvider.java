package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class TestWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_LAST_TEST = "last_test";
    private static final String KEY_RETEST_DUE = "retest_due";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String lastTest = prefs.getString(KEY_LAST_TEST, "No tests logged");
        String retestDue = prefs.getString(KEY_RETEST_DUE, "-");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.test_widget);

        views.setTextViewText(R.id.widget_test_title, "Last Test");
        views.setTextViewText(R.id.widget_last_test, lastTest);
        views.setTextViewText(R.id.widget_retest_due, "Retest due: " + retestDue);

        // Click opens Healthcare > Testing tab
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setData(Uri.parse("com.shos.app://healthcare?subTab=testing"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateTest(Context context, String lastTest, String retestDue) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_LAST_TEST, lastTest)
            .putString(KEY_RETEST_DUE, retestDue)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, TestWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}