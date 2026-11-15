package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.shos.app.R;

public class VaccinationWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_NEXT_DUE = "vacc_next_due";
    private static final String KEY_VACCINE_NAME = "vacc_vaccine_name";
    private static final String KEY_DOSE_COUNT = "vacc_dose_count";
    private static final String KEY_REDACTED_TEXT = "redacted_text_vaccination";

    private static int colour(Context context, int res) {
        return context.getColor(res);
    }

    private static RemoteViews unavailableViews(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_unavailable);
    }

    @Override
    protected void render(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        try {
            SharedPreferences prefs = WidgetPrefs.get(context);
            if (prefs == null) {
                appWidgetManager.updateAppWidget(appWidgetId, unavailableViews(context));
                return;
            }
            String nextDue = prefs.getString(KEY_NEXT_DUE, "--");
            String vaccineName = prefs.getString(KEY_VACCINE_NAME, "Vaccination");
            int doseCount = prefs.getInt(KEY_DOSE_COUNT, 0);
            String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.vaccination_widget);

            Intent intent = new Intent(context, com.shos.app.MainActivity.class);
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("com.shos.app://healthcare?subTab=vaccinations"));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
                    context,
                    appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            if (redactedText != null && !redactedText.isEmpty()) {
                views.setTextViewText(R.id.widget_vaccine_name, redactedText);
                views.setViewVisibility(R.id.widget_next_due, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_dose_count, android.view.View.GONE);
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }

            views.setViewVisibility(R.id.widget_next_due, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_vaccine_name, vaccineName);
            views.setTextColor(R.id.widget_next_due, colour(context, R.color.widget_text_muted));
            views.setTextViewText(R.id.widget_next_due, nextDue);
            views.setViewVisibility(R.id.widget_dose_count, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_dose_count, doseCount + " dose" + (doseCount != 1 ? "s" : ""));

            appWidgetManager.updateAppWidget(appWidgetId, views);
        } catch (Exception e) {
            android.util.Log.w("VaccinationWidget", "render failed", e);
            try { appWidgetManager.updateAppWidget(appWidgetId, unavailableViews(context)); } catch (Exception ignored) { }
        }
    }

    public static void updateVaccination(Context context, String vaccineName, String nextDueRelative,
                                          int doseCount, String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        if (prefs == null) return;
        prefs.edit()
            .putString(KEY_VACCINE_NAME, vaccineName)
            .putString(KEY_NEXT_DUE, nextDueRelative)
            .putInt(KEY_DOSE_COUNT, doseCount)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, VaccinationWidgetProvider.class));
        for (int id : ids) {
            new VaccinationWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
