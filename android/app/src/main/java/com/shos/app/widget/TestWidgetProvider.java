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
    private static final String KEY_REDACTED_TEXT = "redacted_text_test";idgetManager appWidgetManager, int[] appWidgetIds) {
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
        String lastTest = prefs.getString(KEY_LAST_TEST, "No tests logged");
        String retestDue = prefs.getString(KEY_RETEST_DUE, "-");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.test_widget);


        // CHANGED 2 Oct 2026 - honour a Redacted tier. The line is built in JS by the

        // caller, which is the only place that knows what this widget means; this

        // provider never learns what a tier is. Returns immediately, because the

        // full rendering below would otherwise overwrite what was just set.

        if (WidgetRedacted.apply(views, R.id.widget_test_title, prefs.getString(KEY_REDACTED_TEXT, ""),

                R.id.widget_last_test, R.id.widget_retest_due)) {

            appWidgetManager.updateAppWidget(appWidgetId, views);

            return;

        }

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

    public static void updateTest(Context context, String lastTest, String retestDue, String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return;
        prefs.edit()
            .putString(KEY_LAST_TEST, lastTest)
            .putString(KEY_RETEST_DUE, retestDue)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, TestWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}