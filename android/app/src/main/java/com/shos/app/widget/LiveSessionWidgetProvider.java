package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import com.shos.app.R;

public class LiveSessionWidgetProvider extends ResizingWidgetProvider {
    private static final String KEY_TITLE = "live_session_title";
    private static final String KEY_STATE = "live_session_state";
    private static final String KEY_REDACTED_TEXT = "live_session_redacted";
    private static final String KEY_ACTIVITY_COUNT = "live_session_activity_count";
    private static final String KEY_PEOPLE = "live_session_people";
    private static final String KEY_KINKS = "live_session_kinks";
    private static final String KEY_LOADS = "live_session_loads";
    private static final String KEY_FISTS = "live_session_fists";


    private static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new android.content.ComponentName(context, LiveSessionWidgetProvider.class));
        for (int id : ids) new LiveSessionWidgetProvider().render(context, manager, id);
    }

    @Override
    protected void render(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        if (prefs == null) {
            appWidgetManager.updateAppWidget(appWidgetId, unavailableViews(context));
            return;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.live_session_widget);
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("com.shos.app://activity"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pending = android.app.PendingIntent.getActivity(context, appWidgetId, intent,
                android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        String state = prefs.getString(KEY_STATE, "inactive");
        String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
        if (!"active".equals(state)) {
            views.setViewVisibility(R.id.live_session_title, View.GONE);
            views.setViewVisibility(R.id.live_session_summary, View.GONE);
            views.setViewVisibility(R.id.live_session_details, View.GONE);
        } else if (!redactedText.isEmpty()) {
            views.setTextViewText(R.id.live_session_title, redactedText);
            views.setViewVisibility(R.id.live_session_title, View.VISIBLE);
            views.setViewVisibility(R.id.live_session_summary, View.GONE);
            views.setViewVisibility(R.id.live_session_details, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        } else {
            views.setTextViewText(R.id.live_session_title, prefs.getString(KEY_TITLE, "Live session"));
            views.setTextViewText(R.id.live_session_summary,
                    prefs.getInt(KEY_ACTIVITY_COUNT, 0) + " activities · "
                            + prefs.getInt(KEY_PEOPLE, 0) + " people · "
                            + prefs.getInt(KEY_KINKS, 0) + " kinks");
            views.setTextViewText(R.id.live_session_details,
                    prefs.getInt(KEY_LOADS, 0) + " loads · " + prefs.getInt(KEY_FISTS, 0) + " fists");
            views.setViewVisibility(R.id.live_session_title, View.VISIBLE);
            views.setViewVisibility(R.id.live_session_summary, View.VISIBLE);
            views.setViewVisibility(R.id.live_session_details, View.VISIBLE);
        }
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static RemoteViews unavailableViews(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_unavailable);
    }

    public static void updateLiveSession(Context context, String title, String category, String state,
            int activityCount, int people, int kinks, int loads, int fists, String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        if (prefs == null) return;
        prefs.edit()
                .putString(KEY_TITLE, title == null ? "" : title)
                .putString(KEY_STATE, state == null ? "inactive" : state)
                .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
                .putInt(KEY_ACTIVITY_COUNT, activityCount)
                .putInt(KEY_PEOPLE, people)
                .putInt(KEY_KINKS, kinks)
                .putInt(KEY_LOADS, loads)
                .putInt(KEY_FISTS, fists)
                .apply();
        updateAll(context);
    }

}
