package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class RefillWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_REFILL_COUNT = "refill_count";
    private static final String KEY_NEXT_REFILL = "next_refill_med";
    // ADDED 20 Oct 2026 - the card's one-word headline, "Soon" or "None".
    //
    // Distinct from KEY_REFILL_COUNT, which is the number of medications AT
    // their refill threshold. The headline answers a different question - "is
    // anything due in the coming week?" - and on this device the two disagreed:
    // a medication one day from its reorder point is not yet AT the threshold,
    // so the count was 0 and the card said "All stocked" while the line under
    // it said "request in 1d". The owner's correction, 20 Oct: the headline
    // says None/Soon, as per the current stock levels.
    private static final String KEY_REFILL_HEADLINE = "refill_headline";

// CHANGED 5 Oct 2026 (t059 follow-on) - the pre-formatted one-line wording for a
// Redacted widget, decided in JS. Distinct per provider because all seven share
// ONE SharedPreferences file, so a shared key name would overwrite itself.
private static final String KEY_REDACTED_TEXT = "redacted_text_refill";



    /**
     * The "no data available" RemoteViews. Contains no user data at all, so
     * pushing it can neither write to the plaintext sink nor disclose anything
     * to the launcher process. See res/layout/widget_unavailable.xml.
     */
    private static RemoteViews unavailableViews(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_unavailable);
    }
    @Override
    protected void render(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) {
            // Fail-closed, but never leave the host with nothing. See
            // R.layout.widget_unavailable: a provider that returns before
            // updateAppWidget() leaves the launcher showing its own
            // "Can't load widget", which is indistinguishable from a broken
            // widget. This pushes a layout containing NO user data, so the
            // privacy decision in WidgetPrefs is unchanged - nothing is written
            // in plaintext and nothing is disclosed to the launcher process.
            appWidgetManager.updateAppWidget(appWidgetId, unavailableViews(context));
            return;
        }
        int refillCount = prefs.getInt(KEY_REFILL_COUNT, 0);
        String nextRefill = prefs.getString(KEY_NEXT_REFILL, "No refills due");
        // The headline. Empty only if a push predates this field, in which case
        // the count still gives an honest fallback - see below.
        String storedHeadline = prefs.getString(KEY_REFILL_HEADLINE, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.refill_widget);

            // CHANGED 5 Oct 2026 (t059 follow-on) - honour the Redacted tier.
            //
            // sendWidgetUpdate filters the payload, but filtering protects the PAYLOAD
            // and only the provider decides what is RENDERED. The ids are named rather
            // than discovered because RemoteViews is an IPC serialization stub and
            // cannot iterate a view tree.
            // HOISTED 6 Oct 2026 - the root tap target is attached BEFORE the
        // Redacted branch, not after it. Every data provider attached it
        // below the Redacted early-return, so at a Redacted tier the widget
        // rendered but had NO tap target at all - and the owner had set every
        // widget to Redacted. It depends only on `context` and `appWidgetId`,
        // never on the data, so one copy here is correct for every tier.
        Intent intent = new Intent(context, com.shos.app.MainActivity.class);

        // ACTION_VIEW IS LOAD-BEARING, not decoration. Capacitor's own App

        // plugin drops any intent arriving through onNewIntent that is not an

        // ACTION_VIEW - AppPlugin.java:148 does `if (!Intent.ACTION_VIEW.equals

        // (action) || url == null) return;` - so a bare setData() intent never

        // emits appUrlOpen and the tap silently does nothing on a warm app.

        // Verified at source in node_modules/@capacitor/app, not inferred.

        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("com.shos.app://medication/inventory"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
            int wDp = WidgetTextFit.widthDp(context, appWidgetManager, appWidgetId);
            if (redactedText != null && !redactedText.isEmpty()) {
                views.setTextViewText(R.id.widget_refill_title, redactedText);
            views.setViewVisibility(R.id.widget_refill_count, android.view.View.GONE);
views.setViewVisibility(R.id.widget_next_refill, android.view.View.GONE);
                WidgetTextFit.fit(views, context, R.id.widget_refill_title, redactedText, wDp, 16f);
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }
        
        // CHANGED 20 Oct 2026 - the headline is "Soon" or "None", not
        // "All stocked" and not "N need restock".
        //
        // The owner's words: the card should say None/Soon, as per the current
        // stock levels. "All stocked" was a non-answer - and on the device it
        // was actively wrong, because the only tracked medication was one day
        // from its reorder point while the headline claimed everything was
        // stocked. A headline has to answer "do I need to do anything?", and
        // "All stocked" answers "is everything fine?", which is the question
        // nobody opens a widget to ask.
        //
        // "Soon" is amber and "None" is green, so the state is carried by the
        // word AND by its colour - never by colour alone, which is the
        // accessibility rule this app applies everywhere else.
        //
        // The fallback for an empty stored headline is derived from the count,
        // which is the number of medications AT their refill threshold. That is
        // COARSER than the JS's own seven-day horizon, so between an upgrade
        // and the next push it can read "None" for a medication that is
        // approaching its reorder point rather than at it. It cannot read
        // "Soon" for a medication that is not, so the fallback errs towards
        // the quieter word - and the next push replaces it with the real one.
        String headline = (storedHeadline == null || storedHeadline.isEmpty())
                ? (refillCount > 0 ? "Soon" : "None")
                : storedHeadline;
        views.setViewVisibility(R.id.widget_refill_count, android.view.View.VISIBLE);
        views.setViewVisibility(R.id.widget_next_refill, android.view.View.VISIBLE);
        views.setTextViewText(R.id.widget_refill_title, "Refills due");
        views.setTextViewText(R.id.widget_refill_count, headline);
        views.setTextColor(R.id.widget_refill_count, context.getColor(
                "Soon".equals(headline) ? R.color.widget_warn : R.color.widget_good));
        views.setTextViewText(R.id.widget_next_refill, nextRefill);
        // Fitted in BOTH states, which is why the two fit() calls live here
        // rather than inside a branch: the headline is a different string in each
        // state ("Soon" and "None") and both have to be measured against the
        // real field width. 24f / maxLines 1 matches what the layout declares
        // for this view - widgetTextFitMaxLinesGuard checks BOTH axes, so a
        // stale number here fails the build instead of silently rendering larger
        // than the design allows.
        WidgetTextFit.fit(views, context, R.id.widget_refill_count, headline, wDp, 24f, 1);
        WidgetTextFit.fit(views, context, R.id.widget_next_refill, nextRefill, wDp, 12f, 4);

        // CHANGED 1 Oct 2026 (t061) - opens INVENTORY, not the dashboard.
        // Owner's explicit correction: a widget called "Refills Due" that lands
        // on the registry sends the user to the one screen with no stock, no
        // running total and nothing about what is running out.
        //
        // /inventory rather than /dashboard, and /dashboard is untouched, because
        // the DoxyPEP status widget also targets it and that one genuinely belongs
        // there - it shows an adherence figure that only the dashboard renders.

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateRefill(Context context, int count, String nextRefillMed,
                                     String headline, String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return; // no instance in scope here; the per-instance
            // updateAppWidget() above is what pushes the fallback
        prefs.edit()
            .putInt(KEY_REFILL_COUNT, count)
            .putString(KEY_NEXT_REFILL, nextRefillMed)
            .putString(KEY_REFILL_HEADLINE, headline == null ? "" : headline)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, RefillWidgetProvider.class));
        for (int id : ids) {
            new RefillWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
