package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import com.shos.app.R;

public class ClinicCardWidgetProvider extends ResizingWidgetProvider {

    private static final int NARROW_WIDGET_DP = 130;

    // ADDED 20 Oct 2026 - the band a section heading occupies between the row
    // above it and the row it labels.
    //
    // The layout places heading_where at 87dp and the location at 106dp: 19dp
    // apart. Hiding the heading at a narrow width therefore leaves a 19dp hole
    // where the label used to be, and the row BELOW the heading has to move up
    // by exactly that much to close it. Naming the number here rather than
    // inlining it at the call site keeps the two facts - the gap and the
    // correction - in one place, where a change to the layout's margins
    // cannot leave the correction describing a gap that no longer exists.
    private static final float HEADING_BAND_DP = 19f;

    private static final String PREFS_NAME = "shos_widget_prefs";
    private static final String KEY_APPT_TITLE = "clinic_appt_title";
    private static final String KEY_APPT_DATE = "clinic_appt_date";
    private static final String KEY_APPT_LOCATION = "clinic_appt_location";
    // ADDED 21 Oct 2026 - the clinic's ADDRESS and its POSTCODE, as their own
    // keys rather than one composed string.
    //
    // The owner: the clinic had "no formal way to add registered address",
    // and the widget should launch Maps when the location is tapped. The Maps
    // tap already existed, but it could only search for the clinic's NAME, so
    // it could not find the place. A clinic visit now links to a Locations
    // record, and that record's address and postcode arrive here separately:
    // the card shows the postcode beside the place's name, and the Maps
    // intent searches for the whole address.
    private static final String KEY_APPT_LOCATION_ADDRESS = "clinic_appt_location_address";
    private static final String KEY_APPT_LOCATION_POSTCODE = "clinic_appt_location_postcode";
    // ADDED 21 Oct 2026 - what the appointment is FOR ("PrEP review", "Routine
    // screening"), on the owner's instruction that the bigger card could
    // include "tests/procedures planned for that appt". Health data, so it is
    // a Full-tier field only.
    private static final String KEY_APPT_REASON = "clinic_appt_reason";
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

    // ADDED 21 Oct 2026 - how far DOWN the date and the place move on the
    // narrow card, where the appointment's name is TWO lines.
    //
    // 27dp is the name's second line (18sp, about 22dp) and the gap before the
    // date; 48dp is the same, plus the date's own second line (14sp, about
    // 17dp) and its gap. The narrow card is a different arrangement of the
    // same rows, and a translation is how it says so: setViewLayoutMargin is
    // API 31+, and a RemoteViews action naming a method the launcher's API
    // level does not have throws at reapply, where the host turns it into
    // "Can't load widget". setTranslationY has been on View since API 11.
    private static final float NARROW_DATE_OFFSET_DP = 27f;
    private static final float NARROW_LOCATION_OFFSET_DP = 48f;



    /**
     * How far DOWN a row moves on the narrow card, in PIXELS.
     *
     * ADDED 21 Oct 2026. In PIXELS, because setTranslationY takes pixels and the
     * layout's margins are in dp - converting here rather than at the call site
     * is what keeps the two from being confused, and the density is the
     * display's, so it is right on a device whose font size or display size has
     * been changed.
     *
     * The narrow card's appointment name is TWO lines - "Biannual PrEP" needs
     * 215px at 12sp and the narrow card's text is 211px - so the date and the
     * place move down past it. The translation is a pixel offset on the view,
     * not a layout change: setViewLayoutMargin is API 31+, and a RemoteViews
     * action naming a method the launcher's API level does not have throws at
     * reapply, where the host turns it into "Can't load widget" - the same
     * trap as setTextColorInt, from the other side. setTranslationY has been
     * on View since API 11.
     */
    private static float offsetPx(Context context, float dp) {
        return dp * context.getResources().getDisplayMetrics().density;
    }

    /**
     * The place, as the CARD shows it: the place's name and its postcode.
     *
     * ADDED 21 Oct 2026. The owner asked for the "postcode, address/#" on the
     * card, and the POSTCODE fits and the STREET does not: "56 Dean Street,
     * Hull HU1 1AA" is twenty-eight characters, which is two lines on the
     * wide card too. So the card carries the name and the postcode, and the
     * Maps link - one tap away - carries the whole address.
     *
     * The NARROW card carries the name alone: "Conifer - HU1 1AA" is sixteen
     * characters at 12sp, which is 264px against the narrow card's 211px, and
     * the fitter's floor is 12sp - so it could not shrink to fit, only be cut
     * off. The name fits; the postcode does not.
     */
    private static String locationText(String name, String postcode, boolean narrow) {
        String safeName = name == null ? "" : name;
        String safePostcode = postcode == null ? "" : postcode;
        if (narrow || safeName.isEmpty() || safePostcode.isEmpty()) return safeName;
        return safeName + " · " + safePostcode;
    }

    /**
     * The place, as the MAPS LINK searches for it: the name, the street and
     * the postcode, in that order.
     *
     * The owner's reason for wanting the address at all: the Maps tap already
     * existed and could only search for the clinic's NAME, which Maps cannot
     * turn into a pin.
     */
    private static String mapQuery(String name, String address, String postcode) {
        StringBuilder sb = new StringBuilder();
        String[] parts = { name, address, postcode };
        for (String part : parts) {
            if (part == null || part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append(part);
        }
        return sb.toString();
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
        String title = prefs.getString(KEY_APPT_TITLE, "No upcoming appointment");
        String date = prefs.getString(KEY_APPT_DATE, "");
        String location = prefs.getString(KEY_APPT_LOCATION, "");
        String locationAddress = prefs.getString(KEY_APPT_LOCATION_ADDRESS, "");
        String locationPostcode = prefs.getString(KEY_APPT_LOCATION_POSTCODE, "");
        String reason = prefs.getString(KEY_APPT_REASON, "");
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
        int wDp = WidgetTextFit.widthDp(context, appWidgetManager, appWidgetId);
        // ADDED 21 Oct 2026 - the width decides what the card can say, and
        // three things depend on it: the card's own label, how much of the
        // place's address fits, and which rows the card has room for.
        boolean narrow = wDp < NARROW_WIDGET_DP;
        // THE LABEL, with its colon. The owner asked for the colon, and it is
        // what makes the card read as "label: value" now that the label is
        // small and the appointment's name is the big line under it.
        //
        // The narrow card says "Appointment:" because "Next appointment:" is
        // sixteen characters and its text is 211px wide at 12sp - the label
        // would ellipsize, and a truncated label is worse than a shorter one.
        String cardLabel = narrow ? "Appointment:" : "Next appointment:";
        // THE PLACE, as the card shows it: the name and the postcode. The
        // street address goes to the Maps link, not to the card - it does not
        // fit on a card this width.
        String locationText = locationText(location, locationPostcode, narrow);
        if (redactedText != null && !redactedText.isEmpty()) {
            // At a Redacted tier the card carries the one safe line and nothing
            // else. Every other field is hidden BY NAME rather than by relying on
            // a container or a page, for two reasons: the redaction guard is a
            // STATIC proof and cannot follow control flow, and a named
            // setViewVisibility is the only thing it can actually see.
            views.setTextViewText(R.id.widget_clinic_title, redactedText);
            views.setViewVisibility(R.id.widget_clinic_appt_title, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_date, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_visit_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_location, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
            // ADDED 21 Oct 2026 - the reason row, like every other data row
            // here, is hidden by NAME at a Redacted tier. It is health data
            // ("PrEP review", "Routine screening") and it is not in
            // ALLOWED_AT_REDACTED, so it never reaches the widget at all.
            views.setViewVisibility(R.id.widget_clinic_reason, android.view.View.GONE);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_title, redactedText, wDp, 16f, 2);
            views.setViewVisibility(R.id.widget_clinic_nhs_num, android.view.View.GONE);
            // ADDED 10 Oct 2026 (t087) - the three section headings are hidden too.
            // A static label carries no user data, so it is SAFE to show, but a
            // bare heading over a blank card reads as a broken widget rather than
            // as an intentional empty state. Hiding them is the same rule the data
            // rows already follow: a Redacted card shows the redacted line and
            // nothing else.
            views.setViewVisibility(R.id.widget_clinic_heading_when, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_where, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_details, android.view.View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (!title.isEmpty() && !title.equals("No upcoming appointment")) {
            // Reception first - what and when and where - then identifiers. Same
            // order as the Clinic Card screen, so the two surfaces read alike.
            // ADDED 18 Oct 2026 - restores visibility for the fields the Redacted
            // branch above set GONE. RemoteViews recycles the view when the layout
            // id matches and applies only the new RemoteViews' actions, so a view
            // hidden there stayed hidden here and the card rendered a title with
            // nothing under it - which reads as a clipping bug, not a privacy one.
            //
            // widget_clinic_nhs_num is NOT in this list, and that is deliberate: it
            // is hidden at every tier by design (the bridge never carries it and
            // there is no reveal affordance), so restoring it would be a leak.
            // ADDED 21 Oct 2026 - this card is the APPOINTMENTS widget now, and
            // the arrangement is the owner's: the card's own name on top, the
            // appointment's title on the line below it, then when, then where.
            //
            // The title is set back to "Next appointment" here rather than
            // left alone, because the Redacted branch above puts the redacted
            // line in it - and a RemoteViews update applies only the actions it
            // carries, so a card that switched tiers would keep saying the
            // redacted thing. Setting a property in one branch obliges you to
            // set it in the others.
            views.setTextViewText(R.id.widget_clinic_title, cardLabel);
            views.setViewVisibility(R.id.widget_clinic_appt_title, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_date, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_location, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.VISIBLE);
            // ADDED 21 Oct 2026 - the clinic NUMBER is no longer on the card.
            //
            // It was VISIBLE here and empty in practice, and the card has no
            // room left for it: the label, the appointment's name, the date,
            // the place, what it is for and the tests are six rows in a
            // 134dp card. It is in the app's own Clinic Card, which is one tap
            // away, so nothing is lost - and a row that is empty in practice
            // but would overlap the reason row if it were not is worse than no
            // row at all.
            views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
            // The rows the card no longer shows. The section headings say what
            // the title already says, the visit time is part of the date line, and
            // the clinician's name is the one detail that did not fit.
            views.setViewVisibility(R.id.widget_clinic_visit_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_when, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_where, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_details, android.view.View.GONE);
            views.setTextViewText(R.id.widget_clinic_appt_title, title);
             // THE DATE LINE, fitted on the string that is actually rendered:
             // the date and the time are one line, and fitting the date alone
             // would measure half of what the field has to hold.
             String dateText = (visitTime == null || visitTime.isEmpty())
                     ? date : date + " · " + visitTime;
             views.setTextViewText(R.id.widget_clinic_date, dateText);
             views.setTextViewText(R.id.widget_clinic_visit_time, "");
            views.setTextViewText(R.id.widget_clinic_location, locationText);
            views.setTextViewText(R.id.widget_clinic_clinic_num, "");
            // A row that says "Tests: None" is a wrong fact, not a missing
            // one: the appointment has no tests linked, so the card says
            // nothing about tests. The row is hidden rather than left blank,
            // because a blank line under a real one reads as a rendering fault.
            //
            // The row carries the NAMES of the tests now, not a count: the
            // owner asked for "tests/procedures planned for that appt", and
            // "Tests: 3" says there are three without saying three of what.
            String testsText = (tests == null || tests.isEmpty()) ? "" : "Tests: " + tests;
            views.setTextViewText(R.id.widget_clinic_tests, testsText);
            views.setViewVisibility(R.id.widget_clinic_tests,
                    testsText.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
            // WHAT THE APPOINTMENT IS FOR. The owner's "tests/procedures
            // planned for that appt" - the visit's own reasonForVisit list.
            String reasonText = (reason == null || reason.isEmpty()) ? "" : "Planned: " + reason;
            views.setTextViewText(R.id.widget_clinic_reason, reasonText);
            // SET VISIBLE, THEN HIDE IT IF THERE IS NOTHING TO SHOW. Not a
            // ternary: the visibility guard reads a literal visibility call
            // with VISIBLE spelled out, because a RemoteViews update applies
            // only the actions it carries and the launcher RECYCLES the
            // inflated view - so a view the Redacted branch hid stays hidden
            // for every later update unless some other branch says VISIBLE in
            // so many words.
            views.setViewVisibility(R.id.widget_clinic_reason, android.view.View.VISIBLE);
            if (reasonText.isEmpty()) {
                views.setViewVisibility(R.id.widget_clinic_reason, android.view.View.GONE);
            }
            views.setTextViewText(R.id.widget_clinic_doctype, docType);
            // Measured on the device: the Clinic Card title was clipped by the
            // card's own top edge and the WHOLE card overflowed, so every field
            // is fitted rather than only the headline.
            //
            // The ceilings here are the layout's own textSize for each field,
            // and the maxLines are the layout's own maxLines - the guard
            // checks both axes, so a number that drifts from the layout fails
            // the build rather than rendering larger than the design allows.
            WidgetTextFit.fit(views, context, R.id.widget_clinic_title, cardLabel, wDp, 16f, 2);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_appt_title, title, wDp, 18f, 2);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_date, dateText, wDp, 13f, 2);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_location, locationText, wDp, 12f, 1);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_tests, testsText, wDp, 11f, 2);
            WidgetTextFit.fit(views, context, R.id.widget_clinic_reason, reasonText, wDp, 11f, 2);
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
             if (narrow) {
                 views.setViewVisibility(R.id.widget_clinic_heading_details, android.view.View.GONE);
                 views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
                 views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.GONE);
                 views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
                 // CHANGED 21 Oct 2026 - the appointment's title is SHOWN here
                 // now, where it used to be hidden.
                 //
                 // It was hidden because the card's own title was a two-line
                 // 16sp headline and the two looked like the same kind of
                 // line. The card's title is now a small muted LABEL
                 // ("Appointment:") and this is the big value under it, so
                 // there is nothing to be confused with - and without it the
                 // label is a label with no value under it, which is the thing
                 // the owner was reading.
                 //
                 // It fits: "Biannual PrEP" is thirteen characters, and the
                 // fitter shrinks it if a longer title does not fit the
                 // narrow card's 211px.
                 views.setViewVisibility(R.id.widget_clinic_appt_title, android.view.View.VISIBLE);
                 // The reason row is the wide card's: a smaller widget has
                 // just what's necessary, and the tests are already off here
                 // for the same reason.
                 views.setViewVisibility(R.id.widget_clinic_reason, android.view.View.GONE);
                 // CHANGED 20 Oct 2026 - the narrow card loses the section
                 // headings, and the row the last one labelled moves up into
                 // the space it occupied.
                 //
                 // The owner's words: a smaller widget should have "just what's
                 // necessary". "WHEN" over a date and "WHERE" over a place are
                 // structure for a card with room to spare; at 109dp they are
                 // two labels eating the card, and - the part that is easy to
                 // miss - their own bands leave holes where they used to be.
                 //
                 // So the headings are hidden AND the location is translated up
                 // by the band the heading occupied. The translation is a pixel
                 // offset on the view, not a layout change: setViewLayoutMargin
                 // is API 31+, and a RemoteViews action naming a method the
                 // launcher's API level does not have throws at reapply, where
                 // the host turns it into "Can't load widget" - the same trap
                 // as setTextColorInt, from the other side. setTranslationY has
                 // been on View since API 11.
                 views.setViewVisibility(R.id.widget_clinic_heading_when, android.view.View.GONE);
                 views.setViewVisibility(R.id.widget_clinic_heading_where, android.view.View.GONE);
                  // The narrow card's appointment name is TWO lines, so the date
                  // and the place move down past it. Both offsets are pixel
                  // values on the view: setViewLayoutMargin is API 31+, and a
                  // RemoteViews action naming a method the launcher's API level
                  // does not have throws at reapply, where the host turns it
                  // into "Can't load widget". setTranslationY has been on View
                  // since API 11.
                  views.setFloat(R.id.widget_clinic_date, "setTranslationY",
                          offsetPx(context, NARROW_DATE_OFFSET_DP));
                  views.setFloat(R.id.widget_clinic_location, "setTranslationY",
                          offsetPx(context, NARROW_LOCATION_OFFSET_DP));
             } else {
                 // AND the offsets are CLEARED on the wide card. A RemoteViews
                 // update applies only the actions it carries, and the launcher
                 // RECYCLES the inflated view, so an offset set at the narrow
                 // width would survive a resize and leave the date and the
                 // place floating below where they belong. Setting a property
                 // in one branch obliges you to set it in the others.
                 views.setFloat(R.id.widget_clinic_date, "setTranslationY", 0f);
                 views.setFloat(R.id.widget_clinic_location, "setTranslationY", 0f);
             }
} else {
            // No upcoming appointment. Every other field is cleared to its empty XML
            // text rather than left alone, so a stale value from a previous push
            // cannot survive on screen - which matters more than usual here because
            // this card is reused across pushes.
            // ADDED 18 Oct 2026 - restores visibility for the fields the Redacted
            // branch above set GONE. RemoteViews recycles the view when the layout
            // id matches and applies only the new RemoteViews' actions, so a view
            // hidden there stayed hidden here and the card rendered a title with
            // nothing under it - which reads as a clipping bug, not a privacy one.
            //
            // widget_clinic_nhs_num is NOT in this list, and that is deliberate: it
            // is hidden at every tier by design (the bridge never carries it and
            // there is no reveal affordance), so restoring it would be a leak.
            views.setTextViewText(R.id.widget_clinic_title, cardLabel);
            views.setTextViewText(R.id.widget_clinic_appt_title, "");
            views.setViewVisibility(R.id.widget_clinic_appt_title, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_date, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_location, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.VISIBLE);
            views.setViewVisibility(R.id.widget_clinic_visit_time, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_when, android.view.View.GONE);
            views.setViewVisibility(R.id.widget_clinic_heading_where, android.view.View.GONE);
             views.setViewVisibility(R.id.widget_clinic_heading_details, android.view.View.GONE);
             views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
             views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.GONE);
             views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
             // ADDED 21 Oct 2026 - the reason row, cleared with everything else.
             // There is no appointment, so there is nothing it is for.
             views.setViewVisibility(R.id.widget_clinic_reason, android.view.View.GONE);
             views.setTextViewText(R.id.widget_clinic_date, "No upcoming appointment");
            views.setTextViewText(R.id.widget_clinic_visit_time, "");
            views.setTextViewText(R.id.widget_clinic_location, "");
            views.setTextViewText(R.id.widget_clinic_clinic_num, "");
            views.setTextViewText(R.id.widget_clinic_tests, "");
            views.setTextViewText(R.id.widget_clinic_reason, "");
             views.setTextViewText(R.id.widget_clinic_doctype, "");
              if (narrow) {
                  views.setViewVisibility(R.id.widget_clinic_heading_details, android.view.View.GONE);
                  views.setViewVisibility(R.id.widget_clinic_clinic_num, android.view.View.GONE);
                  views.setViewVisibility(R.id.widget_clinic_tests, android.view.View.GONE);
                  views.setViewVisibility(R.id.widget_clinic_doctype, android.view.View.GONE);
                  // The same narrow treatment as the branch above - see the
                  // note there. This branch renders "No upcoming appointment",
                  // and it has the same headings eating the same space.
                  views.setViewVisibility(R.id.widget_clinic_heading_when, android.view.View.GONE);
                  views.setViewVisibility(R.id.widget_clinic_heading_where, android.view.View.GONE);
                  views.setFloat(R.id.widget_clinic_date, "setTranslationY",
                          offsetPx(context, NARROW_DATE_OFFSET_DP));
                  views.setFloat(R.id.widget_clinic_location, "setTranslationY",
                          offsetPx(context, NARROW_LOCATION_OFFSET_DP));
              } else {
                  views.setFloat(R.id.widget_clinic_date, "setTranslationY", 0f);
                  views.setFloat(R.id.widget_clinic_location, "setTranslationY", 0f);
              }
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
        //
        // CHANGED 21 Oct 2026 - the query is now the FULL ADDRESS, not the
        // place's name. The tap always worked; what it searched for was
        // "Conifer", and Maps could not turn a clinic's name into a map
        // pin. With the visit linked to a Locations record the query carries
        // the street and the postcode as well, so the pin is the clinic.
        //
        // The card's LOCATION text is deliberately not the query: the card
        // shows what fits, and the query is what finds the place.
        String mapQuery = mapQuery(location, locationAddress, locationPostcode);
        if (!mapQuery.isEmpty()) {
            Intent mapIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(mapQuery)));
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
                                        String locationAddress, String locationPostcode,
                                        String reason,
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
            // ADDED 21 Oct 2026 - the address, the postcode and the reason.
            // The address and the postcode are what the Maps link searches
            // for; the reason is what the appointment is for. The guard that
            // checks the bridge's argument order requires this method and the
            // plugin's call site to declare the same parameters in the same
            // order, so the three new ones are added in both places together.
            .putString(KEY_APPT_LOCATION_ADDRESS, locationAddress == null ? "" : locationAddress)
            .putString(KEY_APPT_LOCATION_POSTCODE, locationPostcode == null ? "" : locationPostcode)
            .putString(KEY_APPT_REASON, reason == null ? "" : reason)
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
            new ClinicCardWidgetProvider().render(context, appWidgetManager, id);
        }
    }
}
