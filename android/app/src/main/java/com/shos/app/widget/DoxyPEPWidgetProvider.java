package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.view.View;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.widget.RemoteViews;
import android.net.Uri;
import com.shos.app.R;

public class DoxyPEPWidgetProvider extends ResizingWidgetProvider {

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_DOXY_STATUS = "doxy_status";
    private static final String KEY_DOXY_EXPIRY = "doxy_expiry";
    // ADDED 9 Oct 2026 (t093) - the evidence line: the stored date of the
    // encounter that opened the window. Empty at the Redacted tier (never sent).
    private static final String KEY_DOXY_EVIDENCE = "doxy_evidence";
    // The pre-formatted one-line wording for a Redacted widget, decided in JS.
    private static final String KEY_REDACTED_TEXT = "redacted_text";

    // ADDED 17 Oct 2026 - the PEP window length in milliseconds. The SAME figure
    // the notification copy already states ("Take within 72h of exposure"), named
    // rather than inlined because the ring needs it as a named constant.
    //
    // It exists because a ring is a FRACTION OF A WINDOW and this app stores only
    // the deadline. Deriving the start as (deadline - 72h) avoids adding a field
    // across the plugin bridge purely to carry a value the arithmetic already
    // determines exactly - and on a widget, adding a field is a privacy decision,
    // not just a display change.
    private static final long WINDOW_MS = 72L * 60L * 60L * 1000L;

    // ADDED 17 Oct 2026 - below this width (dp) a widget is the narrow 2-cell case
    // and sheds its optional detail. 130 sits between the measured 109dp (2 cells,
    // 77dp of content) and 171dp (3 cells), so it does not depend on a widget landing
    // on an exact cell boundary. See CLAUDE.md on OPTION_APPWIDGET_SIZES.
    private static final int NARROW_WIDGET_DP = 130;

    /**
     * Read a colour through the current configuration, so the values-night/
     * counterpart is the one actually drawn.
     *
     * ADDED 17 Oct 2026 - Context.getColor, not a hardcoded int. The ring's entire
     * urgency signal is colour, and every ring colour has a DIFFERENT value in
     * values-night/: the dark palette was separately contrast-measured against
     * #1D4E4B rather than being a lightened copy. Reading the raw resource would
     * draw light-mode ink on a dark background.
     */
    private static int colour(Context context, int res) {
        return context.getColor(res);
    }

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
        String status = prefs.getString(KEY_DOXY_STATUS, "No active window");
        long expiry = prefs.getLong(KEY_DOXY_EXPIRY, 0);
        // ADDED 9 Oct 2026 (t093) - the evidence line. Empty when the tier
        // dropped it (Redacted/Off), which is why the render below treats "" as
        // "no evidence" rather than rendering a blank gap.
        String evidence = prefs.getString(KEY_DOXY_EVIDENCE, "");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.doxy_pep_widget);

        // CHANGED 2 Oct 2026 - honour the Redacted tier.
        //
        // Without this the filtered payload left status empty, the provider fell
        // back to its own placeholder, and a widget could say "No active window"
        // while a window was active: safe, but a false statement about the user's
        // own health on a home screen.
        //
        // The wording is built in JS, not here, so this provider never has to
        // understand what a tier is. It hides only the two views it already
        // names a few lines below - RemoteViews cannot iterate a view tree, but
        // it does not need to, because these ids are already hardcoded here.
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
        intent.setData(Uri.parse("com.shos.app://medication/dashboard"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
        context,
        appWidgetId, intent, android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);
        String redactedText = prefs.getString(KEY_REDACTED_TEXT, "");
        int wDp = WidgetTextFit.widthDp(context, appWidgetManager, appWidgetId);
        if (redactedText != null && !redactedText.isEmpty()) {
            views.setTextViewText(R.id.widget_doxy_title, redactedText);
            views.setViewVisibility(R.id.widget_doxy_status, View.GONE);
            views.setViewVisibility(R.id.widget_doxy_countdown, View.GONE);
            views.setViewVisibility(R.id.widget_doxy_evidence, View.GONE);
            // ADDED 17 Oct 2026 - the RING is hidden at the Redacted tier too, and
            // not as a styling preference. The arc is a fraction of the 72-hour
            // window that remains, so drawing it puts elapsed-time-within-an-
            // exposure-window on the home screen, and ALLOWED_AT_REDACTED for
            // doxyPepWindow is category+state only - the same reason the evidence
            // DATE is hidden three lines above. A visible view is disclosed data
            // whether or not any text sits next to it.
            views.setViewVisibility(R.id.widget_doxy_ring, View.GONE);
            // Fitted in this branch too: it returns below, and on the device the
            // Redacted line was one of the two that truncated. 12f / maxLines 2
            // matches what the layout now declares for this view -
            // widgetTextFitMaxLinesGuard checks BOTH axes, so a stale 16f here fails
            // the build instead of silently rendering larger than the design allows.
            WidgetTextFit.fit(views, context, R.id.widget_doxy_title, redactedText, wDp, 12f, 2);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

// ADDED 17 Oct 2026 - the eyebrow is set EXPLICITLY rather than left to the
        // layout literal. RemoteViews reuses the inflated view between updates, so a
        // widget that was Redacted and then switched back to Full would keep the
        // Redacted line in this slot indefinitely unless a non-Redacted update
        // overwrites it. Overwriting every field in every branch is what makes a
        // privacy-tier change actually take effect on the home screen.
        //
        // It is "DOXYPEP", not the old "DoxyPEP Window". That string measured 264px
        // into a 212px field and needed ~9.8sp to fit on one line, so it could not
        // fit at any legible size - pool item t115. The word "Window" was never
        // carrying information; the ring depicts the window.
        // ADDED 18 Oct 2026 - the Full branch RESTORES visibility. It did not,
        // and that was a live bug rather than a latent one.
        //
        // RemoteViews recycles the inflated view whenever the layout id matches
        // (RemoteViews.canRecycleView, then reapply) and performApply walks ONLY
        // the actions carried by the new RemoteViews - there is no
        // reset-to-defaults pass. So a view the Redacted branch set GONE stayed
        // GONE here forever, and switching Redacted -> Full left the widget
        // showing its title and nothing else. On screen that reads as a SIZING
        // bug, which is why it survived this long.
        //
        // The rule: setting GONE in any branch obliges you to set VISIBLE in the
        // others. Every branch now pins every view it owns.
        views.setViewVisibility(R.id.widget_doxy_status, View.VISIBLE);
        views.setViewVisibility(R.id.widget_doxy_evidence, View.VISIBLE);
        views.setTextViewText(R.id.widget_doxy_title, "DOXYPEP");

        long now = System.currentTimeMillis();
        if (expiry > 0) {
            long remaining = expiry - now;
            if (remaining > 0) {
                // Ring: the percentage of the window still to run. ProgressBar takes
                // an int, so percent rather than a fraction - and CLAMPED, because a
                // deadline stored further out than 72h (which an upgraded or
                // hand-edited store can hold) would otherwise ask for progress above
                // max and render as a permanently full ring.
                int pct = (int) Math.max(0L, Math.min(100L, (remaining * 100L) / WINDOW_MS));
                views.setProgressBar(R.id.widget_doxy_ring, 100, pct, false);
                views.setViewVisibility(R.id.widget_doxy_ring, View.VISIBLE);

                // Urgency is THREE steps, not a ramp, and thresholds are fractions of
                // the window: over a third remaining is comfortable, under a ninth is
                // nearly out. WCAG 1.4.1 rules out meaning-in-colour-alone, and three
                // named steps rather than a gradient is what lets the status WORD
                // carry the same information as the colour.
                //
                // FIXED 18 Oct 2026 - this used to tint the ARC too, and that is NOT
                // POSSIBLE from a provider. RemoteViews.setProgressTintList is marked
                // @hide in the platform source and is absent from the SDK level this
                // project compiles against, so build-apk rejected all four call sites
                // with "cannot find symbol". The verb is genuinely absent, not merely
                // deprecated, so there is no remoting route to it at any API level this
                // app supports.
                //
                // The consequence is real and worth stating plainly: the ARC keeps one
                // colour (widget_good, from widget_ring_arc.xml's fallback) and does NOT
                // follow urgency. Only the status word recolours. A depleting ring that
                // is always green, beside a word that turns amber then red, is a
                // weaker signal than the design intended - and if that is to be fixed,
                // the route is a separate ProgressBar per state swapped by visibility,
                // not a tint.
                float frac = (float) remaining / (float) WINDOW_MS;
                int urgency = frac > 0.33f ? R.color.widget_good
                        : frac > 0.11f ? R.color.widget_warn
                        : R.color.widget_urgent;
                // setTextColor, not setTextColorInt: RemoteViews actions are applied
                // reflectively in the launcher process, so naming the API-26 method on
                // an API-24 device throws at reapply rather than at compile, and the
                // host turns that into "Can't load widget". Deprecated, but correct
                // on every level this app supports. Do not "upgrade" this.
                views.setTextColor(R.id.widget_doxy_status, colour(context, urgency));
                views.setTextViewText(R.id.widget_doxy_status, "ACTIVE");

                // A real Chronometer, so the countdown is live every second in the
                // LAUNCHER process - no app process, no alarm, no wake lock. It used
                // to be a pushed string ("5h 12m remaining") recomputed on every
                // push, so the number was only as current as the last sync. On a
                // widget whose whole job is to be read at a pharmacy counter, that
                // staleness IS the defect.
                //
                // base is in the SystemClock.elapsedRealtime() timebase, NOT wall
                // clock. Passing System.currentTimeMillis() here compiles, runs, and
                // produces a nonsense countdown - the trap NextDoseWidgetProvider
                // documents at exactly this line.
                long base = SystemClock.elapsedRealtime() + remaining;
                views.setChronometer(R.id.widget_doxy_countdown, base, "%s", true);
                views.setChronometerCountDown(R.id.widget_doxy_countdown, true);
                views.setViewVisibility(R.id.widget_doxy_countdown, View.VISIBLE);
            } else {
                // Expired. The ring is EMPTIED rather than hidden, so the widget's
                // shape does not change underneath the user.
                //
                // The ARC is not recoloured here either, for the reason above.
                // "Emptied" is now literally true, and was not before the layer ids
                // were added: progress 0 sets level 0 on the ARC, and the TRACK -
                // addressed separately as @android:id/background - stays a full circle.
                // An empty track is a legible "no time left". Previously the level went
                // to the whole drawable, BOTH layers swept 0, and the ring vanished.
                views.setProgressBar(R.id.widget_doxy_ring, 100, 0, false);
                views.setViewVisibility(R.id.widget_doxy_ring, View.VISIBLE);
                views.setTextColor(R.id.widget_doxy_status,
                        colour(context, R.color.widget_urgent));
                views.setTextViewText(R.id.widget_doxy_status, "EXPIRED");
                // The guidance copy, not a number: a countdown past zero is the one
                // thing a Chronometer cannot render, and an expired PEP window is
                // exactly when that instruction is worth reading.
                views.setChronometer(R.id.widget_doxy_countdown,
                        SystemClock.elapsedRealtime(), "Take within 72h", false);
                views.setChronometerCountDown(R.id.widget_doxy_countdown, false);
                views.setViewVisibility(R.id.widget_doxy_countdown, View.VISIBLE);
            }
        } else {
            // No window open. The ring is HIDDEN rather than shown empty: there is
            // no countdown to depict, and an empty ring beside "NO WINDOW" reads as a
            // depleted one - a false alarm about the user's own health.
            //
            // The stored status is still preferred when it says something more
            // specific than the no-window default, so a state this provider does not
            // model is not silently flattened into a generic label.
            String label = (status == null || status.isEmpty()
                    || "No active window".equals(status)) ? "NO WINDOW" : status.toUpperCase();
            views.setViewVisibility(R.id.widget_doxy_ring, View.GONE);
            views.setViewVisibility(R.id.widget_doxy_countdown, View.GONE);
            views.setTextColor(R.id.widget_doxy_status,
                    colour(context, R.color.widget_text_muted));
            views.setTextViewText(R.id.widget_doxy_status, label);
        }


        // ADDED 9 Oct 2026 (t093) - the evidence line, shown at the Full tier in
        // every branch above so the user can see WHICH event opened the window.
        //
        // The stored value is one of this app's fake-UTC strings
        // ("YYYY-MM-DDTHH:mm:00.000Z", see dateInputHelpers.js), so it is NOT
        // parsed into a Date and re-formatted here: that would shift the shown
        // day by the device's UTC offset. Taking the leading "YYYY-MM-DD"
        // substring renders the day exactly as it was stored.
                // ADDED 17 Oct 2026 - the evidence line is DROPPED on a narrow (2-cell)
        // widget. The layout has always claimed it was; until now the provider had
        // no width check and rendered it unconditionally, so the comment described
        // a mechanism that did not exist. The gate is real now.
        //
        // "Last unprotected event 2026-09-18" is the longest string on this widget
        // and has no room to spare at 109dp; on a wider widget it stays. The
        // threshold matches the size boundary the whole redesign branches on (see
        // CLAUDE.md on OPTION_APPWIDGET_SIZES): under 130dp is the 2-cell portrait
        // case. If widthDp() could not tell us (-1), the line is KEPT - showing
        // more on an unknown width is safer than silently hiding a field the Full
        // tier is allowed to show.
        boolean narrow = wDp > 0 && wDp < NARROW_WIDGET_DP;
String evidenceDay = (evidence != null && evidence.length() >= 10) ? evidence.substring(0, 10) : "";
        views.setTextViewText(R.id.widget_doxy_evidence,
            evidenceDay.isEmpty() ? "" : "Last unprotected event " + evidenceDay);
        if (narrow) {
            views.setViewVisibility(R.id.widget_doxy_evidence, View.GONE);
        }

        // Click opens Medication tab

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    // ADDED 9 Oct 2026 (t093) - evidenceAt is the stored date of the encounter
    // that opened the window. Empty at Redacted/Off because the payload field
    // is dropped before it reaches here (see widgetPrivacy.js); "" is the
    // right default rather than the field's absence, so a stale value from a
    // previous Full-tier update cannot survive into a later Redacted one.
    // FIXED 13 Oct 2026 (t060) - SAME CLASS OF BUG as the Appointments widget, and
    // it had been live since t093 added `evidenceAt` on 9 Oct 2026.
    //
    // The declaration read (status, expiryMs, redactedText, evidenceAt) while
    // WidgetBridgePlugin passes (status, expiryMs, evidenceAt, redactedText).
    // Both Strings, so the compiler saw nothing.
    //
    // The consequence was that `redactedText` held the EVIDENCE DATE. Since
    // evidenceAt is not in ALLOWED_AT_REDACTED for doxyPepWindow, default-deny
    // drops it at the Redacted tier - so the slot was empty, the "is there a
    // redacted line?" check skipped, and A USER WHO HAD CHOSEN THE REDACTED TIER
    // SAW THE FULL DOPYPEP STATUS ON THEIR HOME SCREEN. The evidence line and the
    // redacted line were also swapped with each other.
    //
    // Fixed by matching the declaration to the call site, and pinned by
    // widgetArgumentOrderGuard.test.js, which compares the two orders directly
    // for all seven providers.
    public static void updateDoxyPEP(Context context, String state, long countdownAt,
                                     String evidenceAt, String redactedText) {
        SharedPreferences prefs = WidgetPrefs.get(context);
        // CHANGED 1 Oct 2026 (t046) - fail closed. WidgetPrefs.get() returns null
        // rather than falling back to a plaintext store; see its own comment for
        // why that fallback was wrong. Returning here leaves the widget showing
        // whatever Android last rendered and writes nothing new, which is the
        // correct trade: a stale widget is visible and fixable, a plaintext file
        // of sexual-health data is neither.
        if (prefs == null) return; // no instance in scope here; the per-instance
            // updateAppWidget() above is what pushes the fallback
        // RENAMED 13 Oct 2026 from (status, expiryMs) to (state, countdownAt), to match
    // the bridge keys the plugin now reads and the JS actually sends. A
    // parameter named `status` that receives the key `state` is the same
    // declaration/call-site split that started all of this, one level in - and
    // widgetArgumentOrderGuard.test.js catches it by comparing the declared
    // parameter name against the bridge key at each position. The persisted
    // SharedPreferences keys below keep their old names deliberately: renaming
    // those would silently reset every user's widget on upgrade, since the store
    // is read by string key and the old value would simply stop being found.
    prefs.edit()
            .putString(KEY_DOXY_STATUS, state)
            .putLong(KEY_DOXY_EXPIRY, countdownAt)
            .putString(KEY_REDACTED_TEXT, redactedText == null ? "" : redactedText)
            .putString(KEY_DOXY_EVIDENCE, evidenceAt == null ? "" : evidenceAt)
            .apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        int[] ids = appWidgetManager.getAppWidgetIds(
            new android.content.ComponentName(context, DoxyPEPWidgetProvider.class));
        for (int id : ids) {
            new DoxyPEPWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
