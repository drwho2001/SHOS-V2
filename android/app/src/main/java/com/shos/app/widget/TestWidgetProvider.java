package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class TestWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_LAST_TEST = "last_test";
    private static final String KEY_RETEST_DUE = "retest_due";
    // ADDED 21 Oct 2026 - whether the next test is the ROUTINE one.
    //
    // The date on this card says WHEN; it did not say WHAT KIND of test it
    // is, and the owner was right that it should: a routine retest and an
    // extra test for treatment are not the same thing to act on, and the date
    // reads the same either way.
    //
    // It is a BOOLEAN, not a string, because the app knows the answer and the
    // card only needs to say it. A boolean also survives the Redacted tier
    // being what it says: it is not in ALLOWED_AT_REDACTED, so default-deny
    // drops it, and the row is simply absent rather than claiming something
    // the tier is not allowed to say.
    private static final String KEY_ROUTINE = "retest_routine";

// CHANGED 5 Oct 2026 (t059 follow-on) - the pre-formatted one-line wording for a
// Redacted widget, decided in JS. Distinct per provider because all seven share
// ONE SharedPreferences file, so a shared key name would overwrite itself.
    private static final String KEY_REDACTED_TEXT = "redacted_text_test";




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
        String lastTest = prefs.getString(KEY_LAST_TEST, "No tests logged");
        String retestDue = prefs.getString(KEY_RETEST_DUE, "-");
        boolean routine = prefs.getBoolean(KEY_ROUTINE, false);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.test_widget);

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
        intent.setData(Uri.parse("com.shos.app://healthcare?subTab=testing"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
            int wDp = WidgetTextFit.widthDp(context, appWidgetManager, appWidgetId);
            if (redactedText != null && !redactedText.isEmpty()) {
                views.setTextViewText(R.id.widget_test_title, redactedText);
            views.setViewVisibility(R.id.widget_last_test, android.view.View.GONE);
views.setViewVisibility(R.id.widget_retest_due, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_routine, android.view.View.GONE);
                WidgetTextFit.fit(views, context, R.id.widget_test_title, redactedText, wDp, 16f);
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }

        views.setTextViewText(R.id.widget_test_title, "Last test");
            // ADDED 18 Oct 2026 - the Full branch RESTORES visibility. It did not,
            // and that was a live bug rather than a latent one.
            //
            // RemoteViews recycles the inflated view whenever the layout id
            // matches (RemoteViews.canRecycleView, then reapply) and performApply
            // walks ONLY the actions in the new RemoteViews - there is no
            // reset-to-defaults pass. So a view the Redacted branch set GONE at
            // line 99 stayed GONE here forever, and switching Redacted -> Full left
            // the widget showing a title and nothing else. It reads as a sizing
            // bug, which is why it survived: nothing about it looks like a privacy
            // bug on screen, it looks like the layout lost its content.
            //
            // Every branch therefore now pins the visibility of every view it owns,
            // rather than only the ones it happens to hide. That is the rule this
            // comment exists to state: setViewVisibility in the GONE branch
            // obliges you to set it in the VISIBLE branch.
            views.setViewVisibility(R.id.widget_last_test, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_retest_due, android.view.View.VISIBLE);
            views.setTextViewText(R.id.widget_last_test, lastTest);
            views.setTextViewText(R.id.widget_retest_due, "Retest due: " + retestDue);
            // ADDED 21 Oct 2026 - the ROUTINE row. The owner pointed out that
            // the card said WHEN the next test is due but not WHAT KIND it is:
            // "Retest due: 23 Dec" reads the same whether the 23 Dec is the
            // routine interval or an extra test for treatment, and the two are
            // not the same thing to act on.
            //
            // The app already knows: the date came from its own routine-retest
            // suggestion, and the JS says so in one field. So the row is filled
            // ONLY when that is true - it can never claim "routine" for a date
            // that came from somewhere else - and it is hidden otherwise.
            if (routine) {
                views.setTextViewText(R.id.widget_routine, "Routine retest");
                views.setViewVisibility(R.id.widget_routine, android.view.View.VISIBLE);
            } else {
                views.setTextViewText(R.id.widget_routine, "");
                views.setViewVisibility(R.id.widget_routine, android.view.View.GONE);
            }
            // CHANGED 20 Oct 2026 - there is NO provider-side row move here any
            // more, and there used to be one.
            //
            // The owner placed a second Last Test widget at the smallest size
            // the launcher offers (one launcher row, 75dp tall), and it showed
            // its title and nothing else: the rows sat at 42dp and 82dp, and a
            // one-row card has 43dp of content, so both fell off the bottom.
            //
            // The first attempt moved the date row at RENDER TIME, with
            // views.setFloat(id, "setTranslationY", ...). It was measured
            // working on the Clinic Card - the location moved from 106dp to
            // about 87dp - and it did NOTHING here: the render ran to
            // completion, the text was set, there was no exception, and the
            // date stayed at 42dp and stayed invisible. A mechanism whose
            // failure mode is "silently does nothing" is not one to ship on a
            // card the owner asked to see working, so the date row moved in
            // the LAYOUT instead (test_widget.xml), where it cannot fail.
            //
            // The Clinic Card keeps its runtime move, because that one is
            // measured working.
            // Measured on the device, which showed "Retest due: ..." and a
            // last-test date broken across two lines mid-value.
            // t119 (17 Oct 2026): maxSp was 18f while test_widget.xml declares 14sp,
            // so the fitter was licensed to render this field a third larger than
            // the design allows - and the device log duly reported
            // "chose 18.0sp (max 18.0sp)" for "23 Sept 2026". Only the
            // autoSizeTextType ceiling on that view was stopping the oversize from
            // shipping, which is exactly why the mismatch survived every green
            // build: nothing asserted maxSp, only maxLines.
            WidgetTextFit.fit(views, context, R.id.widget_last_test, lastTest, wDp, 24f, 1);
            WidgetTextFit.fit(views, context, R.id.widget_retest_due, "Retest due: " + retestDue, wDp, 12f, 2);

        // Click opens Healthcare > Testing tab

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    public static void updateTest(Context context, String lastTest, String retestDue,
                                   boolean routine, String redactedText) {
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
            .putString(KEY_LAST_TEST, lastTest)
            .putString(KEY_RETEST_DUE, retestDue)
            .putBoolean(KEY_ROUTINE, routine)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, TestWidgetProvider.class));
        for (int id : ids) {
            new TestWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
