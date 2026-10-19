package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class AppointmentWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_APPT_COUNT = "appt_count";
    private static final String KEY_NEXT_APPT = "next_appt";
    // ADDED 10 Oct 2026 (t088) - the time of day and the location of the
    // appointment on the line above. Empty at a tier that dropped them: both
    // are identifying, and nextAppointment's Redacted allowlist is
    // ["category", "count"], so they never arrive. Empty is the right default
    // rather than the field's absence, so a stale Full-tier value cannot
    // survive into a later Redacted push.
    private static final String KEY_APPT_TIME = "appt_time";
    private static final String KEY_APPT_LOCATION = "appt_location";
    // ADDED 13 Oct 2026 (t060) - the id of the appointment on display, and the
    // number of booked visits BEYOND the 14-day "upcoming" window.
    //
    // nextApptId is what makes the tap specific. It is NOT an allowlisted field
    // at the Redacted tier, so it arrives empty for a user who chose Redacted and
    // the widget falls back to the bare clinic-visits link - see the privacy note
    // in clinicVisitReminderSync.js for why that is the correct outcome rather
    // than a gap.
    private static final String KEY_APPT_ID = "appt_id";
    private static final String KEY_APPT_FUTURE_COUNT = "appt_future_count";

    // t060 - the deep link this widget opens. Kept as one constant so the URI is
    // built in exactly one place; the widget tap and anything else that needs to
    // reproduce it must not hand-assemble a second, drifting copy.
    //
    // The id travels as a QUERY PARAMETER, which is what makes it work with the
    // existing resolver: in `com.shos.app://clinic-visits?id=x` the URL parser
    // reads "clinic-visits" as the hostname (exactly as the bare link already
    // does) and "id" as a search param, so deepLinkRoutes.js needs no new
    // host-branch and no URL shape it cannot already parse.
    private static final String CLINIC_VISITS_URI = "com.shos.app://clinic-visits";

// CHANGED 5 Oct 2026 (t059 follow-on) - the pre-formatted one-line wording for a
// Redacted widget, decided in JS. Distinct per provider because all seven share
// ONE SharedPreferences file, so a shared key name would overwrite itself.
    // ADDED 18 Oct 2026 - the narrow-widget width threshold, shared in intent with
    // DoxyPEPWidgetProvider's copy of it. Declared per provider rather than shared
    // because these classes deliberately share no base class: the ten providers are
    // independent so a fault in one cannot cascade, and a shared constant would be
    // the first thing to reintroduce that coupling. If this is ever changed, change
    // both - widgetRingGuard does not cover it, and nothing else would notice.
    private static final int NARROW_WIDGET_DP = 130;

private static final String KEY_REDACTED_TEXT = "redacted_text_appt";

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
        int apptCount = prefs.getInt(KEY_APPT_COUNT, 0);
        // t060 - appointments BEYOND the 14-day window. Distinct from apptCount on
        // purpose: "upcoming" means within two weeks, and anything further out is
        // still shown but counted separately so a glance can tell them apart.
        int futureCount = prefs.getInt(KEY_APPT_FUTURE_COUNT, 0);
        // "Does this widget have anything to show at all" is NOT apptCount > 0 any
        // more. Since t060 apptCount is the 14-DAY count, so a user whose only
        // appointment is six weeks out has apptCount == 0 while clearly not having
        // "none booked" - branching on apptCount alone would render "None booked"
        // over a real, future, scheduled appointment. That is a false statement
        // about the user's own health on their home screen.
        int totalCount = apptCount + futureCount;
        String nextAppt = prefs.getString(KEY_NEXT_APPT, "No appointments");
        String apptTime = prefs.getString(KEY_APPT_TIME, "");
        String apptLocation = prefs.getString(KEY_APPT_LOCATION, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.appointment_widget);

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
        // t060 - the SPECIFIC appointment, when this widget is allowed to name
        // one. Empty id (a Redacted tier, or a push from an older build) falls
        // back to the bare clinic-visits link, which is the behaviour that
        // existed before this task and the safe direction to degrade to.
        //
        // Uri.encode on the id is belt-and-braces: ids in this app are generated
        // locally and never contain reserved characters, but the location intent
        // below already establishes the house rule that anything interpolated
        // into a URI here gets encoded, and a URI that can be malformed by a
        // field is a URI a later edit can forget to escape.
        String apptId = prefs.getString(KEY_APPT_ID, "");
        String deepLink = (apptId != null && !apptId.isEmpty())
                ? CLINIC_VISITS_URI + "?id=" + Uri.encode(apptId)
                : CLINIC_VISITS_URI;
        intent.setData(Uri.parse(deepLink));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
            int wDp = WidgetTextFit.widthDp(context, appWidgetManager, appWidgetId);

        // ADDED 18 Oct 2026 - below this width the widget is the narrow 2-cell
        // case. Same threshold and same reasoning as DoxyPEPWidgetProvider's: 130dp
        // sits between the measured 109dp (2 cells) and 171dp (3 cells), so it does
        // not depend on landing on an exact cell boundary. A -1 width (launcher did
        // not say) KEEPS the location - showing more on an unknown width is safer
        // than hiding a field the Full tier is allowed to render.
        boolean narrow = wDp > 0 && wDp < NARROW_WIDGET_DP;
            if (redactedText != null && !redactedText.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_title, redactedText);
            views.setViewVisibility(R.id.widget_appt_count, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_next_appt, android.view.View.GONE);
                // ADDED 10 Oct 2026 (t088) - time and location are identifying,
                // so they are hidden here as well. Declared rather than relying on
                // an empty string: an empty TextView still occupies layout, so a
                // blank line would read as a rendering fault.
views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
                WidgetTextFit.fit(views, context, R.id.widget_appt_title, redactedText, wDp, 12f, 2);
                appWidgetManager.updateAppWidget(appWidgetId, views);
                return;
            }

        if (totalCount > 0) {
            // ADDED 18 Oct 2026 - restores visibility for the fields the Redacted
        // branch above set GONE. RemoteViews recycles the view when the layout id
        // matches and applies only the new RemoteViews' actions, so a view hidden
        // there stays hidden for every later update that does not mention it - and
        // a privacy-tier change then reads on screen as a SIZING bug, which is why
        // this went unfixed for so long.
        views.setViewVisibility(R.id.widget_appt_count, android.view.View.VISIBLE);
        views.setViewVisibility(R.id.widget_next_appt, android.view.View.VISIBLE);
        views.setTextViewText(R.id.widget_appt_title, "Appointments");
            // t060 - the headline is the 14-day count, with anything further out
            // appended rather than folded in, so "upcoming" keeps meaning
            // "within two weeks". The suffix is omitted entirely at zero, so the
            // common case renders exactly as it did before this task rather than
            // gaining a permanent "+0 later".
            views.setTextViewText(R.id.widget_appt_count,
                    apptCount + " upcoming" + (futureCount > 0 ? " + " + futureCount + " later" : ""));
            // REMOVED 18 Oct 2026 - this used to render "Next: " + title + date and
            // fitted the whole string INCLUDING the prefix, because the prefix was a
            // third of the field's width. The prefix is gone rather than shrunk: the
            // eyebrow above already says the card is Appointments, so "Next:"
            // restated it at a cost of a line's width, and that was the difference
            // between fitting and truncating on the device.
            //
            // The fit() call itself is KEPT and now measures the string the widget
            // actually renders. Fitting the prefixed string while rendering the
            // unprefixed one would have been worse than either: it would have shrunk
            // text to fit a width the widget no longer needed.
            views.setTextViewText(R.id.widget_next_appt, nextAppt);
            WidgetTextFit.fit(views, context, R.id.widget_appt_count,
                    apptCount + " upcoming" + (futureCount > 0 ? " + " + futureCount + " later" : ""), wDp, 18f, 2);
            WidgetTextFit.fit(views, context, R.id.widget_next_appt, nextAppt, wDp, 12f, 2);

            // ADDED 10 Oct 2026 (t088) - time and location on their own lines.
            // Each is GONE rather than blank when absent, because an empty
            // TextView still occupies layout and reads as a broken widget.
            if (apptTime != null && !apptTime.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_time, apptTime);
                views.setViewVisibility(R.id.widget_appt_time, android.view.View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
            }

            // Location click opens Maps - the SAME pattern as
            // ClinicCardWidgetProvider, rather than a second invention: a
            // geo: intent on the location view itself, with a request code
            // offset by appWidgetId so it cannot collide with the root intent
            // above. Uri.encode is what keeps a location containing an
            // apostrophe or a comma from producing a malformed URI.
            if (apptLocation != null && !apptLocation.isEmpty()) {
                views.setTextViewText(R.id.widget_appt_location, apptLocation);
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.VISIBLE);
                WidgetTextFit.fit(views, context, R.id.widget_appt_location, apptLocation, wDp, 12f);
            // A clinic address is the LONGEST string on this card and the least
            // load-bearing at a glance; the app is one tap away. Dropped rather
            // than shrunk, because a truncated address ("Dean Street, Hull...") is
            // less useful than none, and the audit measured this layout overflowing
            // its 2-cell box by 33dp with every field present.
            if (narrow) {
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
            }
                Intent mapIntent = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("geo:0,0?q=" + Uri.encode(apptLocation)));
                android.app.PendingIntent mapPendingIntent = android.app.PendingIntent.getActivity(
                        context,
                        appWidgetId * 10 + 1,
                        mapIntent,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
                views.setOnClickPendingIntent(R.id.widget_appt_location, mapPendingIntent);
            } else {
                views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
            }
        } else {
            views.setTextViewText(R.id.widget_appt_title, "Appointments");
            views.setTextViewText(R.id.widget_appt_count, "None booked");
            views.setTextViewText(R.id.widget_next_appt, "");
            // ADDED 10 Oct 2026 (t088) - hidden here as well as on the Full-tier
            // path. Without this, a user who deletes their last appointment keeps
            // seeing its time and location on the widget, which is the stale-data
            // shape this whole file's unconditional-push rule exists to prevent.
            views.setViewVisibility(R.id.widget_appt_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_appt_location, android.view.View.GONE);
        }

        // Click opens Clinic Visits tab

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

// FIXED 13 Oct 2026 (t060) - THE PARAMETER ORDER HERE WAS WRONG, and it had
    // been wrong since t088 shipped this signature on 10 Oct 2026.
    //
    // The declaration read (nextAppt, redactedText, apptTime, apptLocation) while
    // WidgetBridgePlugin has always passed (nextAppt, nextApptTime,
    // nextApptLocation, redactedText). Every parameter is a String, so the Java
    // compiler could not see it and the build stayed green.
    //
    // What it actually did on a device:
    //   - the widget's TIME line rendered the clinic LOCATION
    //   - the LOCATION line rendered the redacted line
    //   - the redaction check read `redactedText`, which held the appointment
    //     TIME - so a Full-tier user with a timed appointment saw the widget
    //     collapse to the redacted line, and a user who had chosen the REDACTED
    //     tier was NOT redacted whenever the appointment had no time, because
    //     that slot was empty and the check skipped.
    //
    // That last one is the reason this is not filed as cosmetic: the Redacted
    // tier is the control a user reaches for precisely so a clinic visit does not
    // show up on a home screen, and it was not being honoured.
    //
    // The fix is to match the DECLARATION to the call site rather than the other
    // way round, because the call site is the order WidgetBridgePlugin's own
    // comments describe and the order widgetRedactedRender.test.js asserts
    // (redactedText LAST). Changing the call site instead would have meant
    // moving redactedText off the last position and failing that guard.
    //
    // widgetArgumentOrderGuard.test.js now compares these two orders directly, so
    // this cannot come back silently - that guard is the actual lesson here, not
    // the reorder.
    public static void updateAppointment(Context context, int count, String nextAppt,
                                         String apptTime, String apptLocation,
                                         String nextApptId, int futureCount,
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
            .putInt(KEY_APPT_COUNT, count)
            .putString(KEY_NEXT_APPT, nextAppt)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            // ADDED 10 Oct 2026 (t088) - the two new fields, defaulted to ""
            // rather than to the field's absence, for the reason above.
            .putString(KEY_APPT_TIME, apptTime == null ? "" : apptTime)
            .putString(KEY_APPT_LOCATION, apptLocation == null ? "" : apptLocation)
            // ADDED 13 Oct 2026 (t060) - the id of the appointment this widget is
            // showing, so the tap can open THAT one rather than the bare list.
            // Empty rather than absent for the same reason as the two above: at a
            // Redacted tier the bridge never sends the id (it is not in
            // ALLOWED_AT_REDACTED, and deliberately so - see the privacy note in
            // clinicVisitReminderSync.js), so writing "" is what stops a Full-tier
            // id surviving into a later Redacted push and re-enabling the deep link.
            .putString(KEY_APPT_ID, nextApptId == null ? "" : nextApptId)
            // t060 - how many booked visits fall BEYOND the 14-day window. Zero in
            // the common case, and the provider renders nothing extra for it, so
            // this is inert for anyone whose appointments are all soon.
            .putInt(KEY_APPT_FUTURE_COUNT, futureCount)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, AppointmentWidgetProvider.class));
        for (int id : ids) {
            new AppointmentWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
