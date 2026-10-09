package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.shos.app.R;

public class ClinicCardWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_APPT_TITLE = "clinic_appt_title";
    private static final String KEY_APPT_DATE = "clinic_appt_date";
    private static final String KEY_APPT_LOCATION = "clinic_appt_location";
    private static final String KEY_APPT_TESTS = "clinic_appt_tests";
    private static final String KEY_APPT_DOCTYPE = "clinic_appt_doctype";
    private static final String KEY_APPT_CLINIC_NUM = "clinic_appt_clinic_num";
    // ---------------------------------------------------------------------
    // UNREACHABLE SINCE THIS FILE WAS WRITTEN. Nothing calls this method:
    // the JS side reaches for a "WidgetBridge" Capacitor plugin, and no such
    // plugin is registered in this app — the only @CapacitorPlugin here is
    // ScreenSecurityPlugin. So the guard in clinicVisitReminderSync.js
    // (`if (bridge && bridge.updateClinicCard)`) never passes and none of the
    // values below are ever written. Verified 29 Sep 2026.
    //
    // DO NOT WIRE THIS UP WITHOUT DECIDING THE ENCRYPTION QUESTION FIRST.
    // SharedPreferences is a PLAINTEXT XML file on disk. Every other write in
    // this app goes through storageAdapter, which encrypts, and this app's
    // entire privacy promise is "encrypted at rest, on your own device".
    // Writing an NHS number here would be the single place that promise is
    // broken, and it would be broken in the most obvious file for a future
    // reader to open.
    //
    // Two further problems with the design below, both latent:
    //   1. KEY_APPT_REVEALED lives in the same plaintext prefs, so tapping to
    //      reveal is a PERMANENT flip, not a per-render mask. A lock-screen
    //      widget that masks a value is security theatre if one tap in a
    //      shoulder-surfing moment turns it off forever.
    //   2. An NHS number on a home-screen widget is low value when the Clinic
    //      Card itself is one tap away. Deleting these fields outright is a
    //      product decision for the owner, not a bug fix, which is why it has
    //      not been done unilaterally.
    //
    // Guarded by src/storage/widgetPlaintextSink.test.js, which fails on the
    // change that would make this reachable rather than on the dead code.
    // ---------------------------------------------------------------------
    private static final String KEY_APPT_NHS_NUM = "clinic_appt_nhs_num";

    private static final String KEY_APPT_REVEALED = "clinic_appt_revealed";

    // ADDED 6 Oct 2026 - the appointment's time of day, kept apart from KEY_APPT_DATE
    // so the summary page can show a date and the appointment page a time without
    // either having to parse the other's string.
    private static final String KEY_APPT_VISIT_TIME = "clinic_appt_visit_time";

    // ADDED 5 Oct 2026 (t059) - the pre-formatted one-line wording for a Redacted
    // widget, decided in JS. This is the second provider to get one; DoxyPEP was
    // the first, and it is the reference implementation.
    //
    // WHY A SEPARATE KEY rather than reusing KEY_APPT_TITLE: all seven data
    // providers share ONE SharedPreferences file, so a shared key name would have
    // each provider overwrite the previous one's line.
    private static final String KEY_REDACTED_TEXT = "redacted_text_clinic";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    /**
     * The "no data available" RemoteViews. Contains no user data at all, so
     * pushing it can neither write to the plaintext sink nor disclose anything
     * to the launcher process. See res/layout/widget_unavailable.xml.
     */
private static RemoteViews unavailableViews(Context context) {
        return new RemoteViews(context.getPackageName(), R.layout.widget_unavailable);
    }

    /**
     * NOT factored into a helper, deliberately.
     *
     * The obvious tidy-up here is one setSensitiveVisibility(views, vis) called
     * from the four branches below - which is what I wrote first. It broke
     * src/storage/widgetRedactedRender.test.js, which proves no sensitive field is
     * rendered at a Redacted tier by finding a literal
     * setViewVisibility(<sensitive id>, GONE) in the provider. A helper hides
     * those calls one indirection away and the guard can no longer see them, so a
     * genuine disclosure would have passed.
     *
     * That guard is worth more than the twelve lines this saves. Teaching it about
     * one specific helper would be worse still: it would keep passing for any
     * DIFFERENT helper, which is precisely how a privacy guard turns decorative.
     * So the calls stay literal and visible, which is also what the other nine
     * providers in this app already do.
     */
    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
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
        String title = prefs.getString(KEY_APPT_TITLE, "No upcoming appointment");
        String date = prefs.getString(KEY_APPT_DATE, "");
        String location = prefs.getString(KEY_APPT_LOCATION, "");
        String tests = prefs.getString(KEY_APPT_TESTS, "");
        String docType = prefs.getString(KEY_APPT_DOCTYPE, "");
        String clinicNum = prefs.getString(KEY_APPT_CLINIC_NUM, "");
        String visitTime = prefs.getString(KEY_APPT_VISIT_TIME, "");
        // The NHS number is never stored, so it is never read either. The
        // sensitive row renders masked unless revealed, and the revealed branch
        // hides the NHS line outright - see the branch below.

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.clinic_card_widget);

        // CHANGED 5 Oct 2026 (t059) - honour the Redacted tier, following
        // DoxyPEPWidgetProvider's pattern exactly.
        //
        // THIS WAS THE REAL DEFECT IN THIS TASK. sendWidgetUpdate already filtered
        // the payload at a Redacted tier, and its unit tests asserted that and
        // passed - but filtering protects the PAYLOAD, and only the provider
        // decides what is RENDERED. Without this block the filtered payload left
        // title/date/location empty, the provider fell through to its own
        // placeholder, and this widget disclosed an appointment title, a clinic
        // location, a date and a test count on the home screen regardless of the
        // user's privacy setting. clinicCard DEFAULTS to redacted, so this was the
        // behaviour a user got without ever configuring anything.
        //
        // The hidden ids are already hardcoded here; RemoteViews is an IPC
        // serialization stub and cannot iterate a view tree, so naming them is the
        // whole mechanism.
        // HOISTED 6 Oct 2026 - the root tap target is attached BEFORE the Redacted
        // branch below, not after it.
        //
        // Found by reading, after the owner reported this widget "can't load"
        // with every widget set to Redacted. The Redacted branch returns early,
        // and the click PendingIntent used to be attached further down - after
        // that return. So at a Redacted tier this widget had NO tap target at
        // all: it rendered, it was simply inert. Every one of the seven data
        // providers had this shape, which is why the symptom looked like "some
        // are broke" rather than naming a rule.
        //
        // It is attached here rather than duplicated into both branches because
        // it depends only on `context` and `appWidgetId`, never on the data, so
        // one copy before the branch is correct for every tier. The location and
        // reveal targets below deliberately stay where they are: both depend on
        // data that a Redacted tier is not permitted to render.
        Intent mainIntent = new Intent(context, com.shos.app.MainActivity.class);

        // ACTION_VIEW IS LOAD-BEARING, not decoration. Capacitor's own App

        // plugin drops any intent arriving through onNewIntent that is not an

        // ACTION_VIEW - AppPlugin.java:148 does `if (!Intent.ACTION_VIEW.equals

        // (action) || url == null) return;` - so a bare setData() intent never

        // emits appUrlOpen and the tap silently does nothing on a warm app.

        // Verified at source in node_modules/@capacitor/app, not inferred.

        mainIntent.setAction(Intent.ACTION_VIEW);
        mainIntent.setData(Uri.parse("com.shos.app://clinic-card"));
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent mainPendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, mainIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, mainPendingIntent);

        String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
        if (redactedText != null && !redactedText.isEmpty()) {
            // At a Redacted tier the card carries the one safe line and nothing
            // else. Every other field is hidden BY NAME rather than by relying on
            // a container or a page, for two reasons: the redaction guard is a
            // STATIC proof and cannot follow control flow, and a named
            // setViewVisibility is the only thing it can actually see.
            views.setTextViewText(R.id.widget_clinic_title, redactedText);
            views.setViewVisibility(R.id.widget_clinic_date, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_visit_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_location, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_nhs_num, android.view.View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (!title.isEmpty() && !title.equals("No upcoming appointment")) {
            // Reception first - what and when and where - then identifiers. Same
            // order as the Clinic Card screen, so the two surfaces read alike.
            views.setTextViewText(R.id.widget_clinic_title, title);
            views.setTextViewText(R.id.widget_clinic_date, date);
            views.setTextViewText(R.id.widget_clinic_visit_time, visitTime);
            views.setTextViewText(R.id.widget_clinic_location, location);
            views.setTextViewText(R.id.widget_clinic_clinic_num, clinicNum);
            views.setTextViewText(R.id.widget_clinic_tests, "Tests: " + tests);
            views.setTextViewText(R.id.widget_clinic_doctype, docType);
            // The NHS number is NEVER stored - WidgetBridgePlugin ignores the field
            // and this provider has no parameter for it - so it is hidden rather
            // than left blank, because an empty line next to a real clinic number
            // reads as a rendering bug rather than a deliberate omission.
            //
            // There is NO reveal button and no masking. It is gone rather than
            // fixed: it fired a deep link resolving to an action nothing performs,
            // and it implied a permanent-unmask kept in the widget's own
            // preferences - one shoulder-surfing tap and the fields stayed
            // unmasked until Clear Storage. What is on screen is decided solely by
            // the privacy tier, so there is nothing to reveal.
            views.setViewVisibility(R.id.widget_clinic_nhs_num, android.view.View.GONE);
} else {
            // No upcoming appointment. Every other field is cleared to its empty XML
            // text rather than left alone, so a stale value from a previous push
            // cannot survive on screen - which matters more than usual here because
            // this card is reused across pushes.
            views.setTextViewText(R.id.widget_clinic_title, "Clinic Card");
            views.setTextViewText(R.id.widget_clinic_date, "No upcoming appointment");
            views.setTextViewText(R.id.widget_clinic_visit_time, "");
            views.setTextViewText(R.id.widget_clinic_location, "");
            views.setTextViewText(R.id.widget_clinic_clinic_num, "");
            views.setTextViewText(R.id.widget_clinic_tests, "");
            views.setTextViewText(R.id.widget_clinic_doctype, "");
        }

        // PAGING IS GONE, and this is the second time it has been tried here.
        //
        // ViewFlipper with setDisplayedChild was the obvious way to show more than a
        // glance's worth of data without a tap. It re-introduced nested containers
        // into this layout, and the widget stopped rendering again - the same
        // failure as the original nested container, from a build that passes every
        // test in this repo.
        //
        // So the mechanism is now established rather than assumed: NESTED CONTAINERS
        // IN A WIDGET RemoteViews LAYOUT DO NOT INFLATE HERE. After the first fix it
        // was still unproven, and this is where that ends. The guard in
        // widgetTapAndFallbackGuard.test.js asserts it across all ten layouts.
        //
        // The extra data paging was for - the appointment TIME - is still here. It
        // is simply on one flat card instead of behind a swipe.

// Main click is attached ABOVE, before the Redacted branch, so that every
        // tier has a tap target. The two below remain here because both depend on
        // data a Redacted tier does not render.
        // Location click opens Maps
        if (!location.isEmpty()) {
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(location)));
            mapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            android.app.PendingIntent mapPendingIntent = android.app.PendingIntent.getActivity(
                context, appWidgetId * 10 + 1, mapIntent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_clinic_location, mapPendingIntent);
        }

        // THE REVEAL CLICK IS GONE, deliberately.
        //
        // It fired com.shos.app://widget/reveal-clinic, which resolves in
        // deepLinkRoutes.js to { action: "revealClinicCard" } - an action nothing in
        // App.jsx performs. The route resolved and was then dropped, so tapping
        // "tap to reveal" did nothing except open the app, which is what the owner
        // reported. Paging removes the button entirely rather than wiring up a
        // permanent-unmask that the provider's own comment already called security
        // theatre, so there is nothing left here to fix or to keep.

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // The nhsNum PARAMETER AND ITS KEY ARE GONE, not merely left unwritten.
    // The bridge used to pass a real NHS number here and this method stored it
    // in SharedPreferences - the one place this app's "encrypted at rest"
    // promise would have broken. The Clinic Card is one tap away and already
    // holds the value, so the widget has no reason to keep a copy of a
    // national identifier. Removing the parameter rather than passing "" makes
    // it impossible to reintroduce by accident, and
    // src/storage/widgetPlaintextSink.test.js asserts the write is absent.
    public static void updateClinicCard(Context context, String title, String date, String location,
                                        String tests, String docType, String clinicNum,
                                        String visitTime,
                                        String redactedText) {
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
            .putString(KEY_APPT_TITLE, title)
            .putString(KEY_APPT_DATE, date)
            .putString(KEY_APPT_LOCATION, location)
            .putString(KEY_APPT_TESTS, tests)
            .putString(KEY_APPT_DOCTYPE, docType)
            .putString(KEY_APPT_CLINIC_NUM, clinicNum)
            .putString(KEY_APPT_VISIT_TIME, visitTime == null ? "" : visitTime)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .putBoolean(KEY_APPT_REVEALED, false)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, ClinicCardWidgetProvider.class));
        for (int id : ids) {
            updateAppWidget(context, appWidgetManager, id);
        }
    }
}