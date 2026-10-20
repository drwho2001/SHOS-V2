package com.shos.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.shos.app.widget.AppointmentWidgetProvider;
import com.shos.app.widget.ClinicCardWidgetProvider;
import com.shos.app.widget.CycleWidgetProvider;
import com.shos.app.widget.DoxyPEPWidgetProvider;
import com.shos.app.widget.NextDoseWidgetProvider;
import com.shos.app.widget.RefillWidgetProvider;
import com.shos.app.widget.TestWidgetProvider;
import com.shos.app.widget.WidgetBootReceiver;

/**
 * The missing half of the widget feature.
 *
 * WHY THIS FILE WAS ABSENT UNTIL NOW. Every widget provider, its manifest
 * receiver, its layout, and the JS call site that wants to feed it have existed
 * since the widgets were built. Nothing has ever connected them: the JS side
 * registers a plugin literally named "WidgetBridge", and this app had no plugin
 * of that name - the only @CapacitorPlugin in the whole project was
 * ScreenSecurityPlugin. The guard on the JS side
 * ({@code if (bridge && bridge.updateX)}) therefore never passed, so no provider
 * method was ever invoked, and the seven data-driven widgets rendered their
 * empty state forever. Three of the ten widgets (QuickAdd contact, encounter and
 * medication) are pure launch Intents and DID work throughout; they need no
 * data, which is why the feature looked installed.
 *
 * Storage is encrypted via WidgetPrefs - see that file for why widgets cannot
 * use this app's own vault key.
 *
 * The NHS NUMBER IS DELIBERATELY NOT WRITTEN. It used to be passed through to
 * ClinicCardWidgetProvider, which stored it in plaintext SharedPreferences, and
 * src/storage/widgetPlaintextSink.test.js exists to stop that. The requirement
 * it enforces has now changed shape rather than been deleted: the invariant is
 * no longer "no bridge exists" (that would be false the moment this file landed)
 * but "the NHS number is never written to widget storage at all". The Clinic
 * Card is one tap away and shows the real value, so the widget has no reason to
 * hold a copy of a national identifier.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String MISSING = "missing";

    /**
     * Whether the caller asked for this widget to be blanked.
     *
     * Reads the tier the JS side resolved (widgetPrivacy.js) rather than
     * re-deciding it here, because that module is the single owner of the rule
     * and a second copy of the table in Java is a second copy that will drift.
     *
     * FAILS CLOSED. Anything this code does not recognise as a positive tier
     * blanks the widget, including a missing parameter. That direction is
     * deliberate and it is the opposite of how the rest of this plugin works -
     * every other method here defaults a missing value to an empty string and
     * carries on. Here, a value we cannot read must never be read as permission
     * to disclose: a caller that forgets to send a tier renders nothing rather
     * than everything. The cost of that choice is a blank widget during
     * development if the parameter is misspelled, which is visible immediately,
     * against a lock screen showing a medication name.
     */
    private boolean isBlank(PluginCall call) {
        String tier = call.getString("tier");
        return tier == null || "off".equals(tier);
    }

    @PluginMethod
    public void updateNextDose(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), NextDoseWidgetProvider.class, R.layout.next_dose_widget);
            call.resolve();
            return;
        }
        NextDoseWidgetProvider.updateNextDose(
                getContext(),
                opt(call, "medName"),
                opt(call, "nextDoseTime"),
                // 0 when absent, which the provider reads as "no countdown".
                // Deliberately not defaulted to "now": that would render a
                // Chronometer counting up from zero, which looks like a live
                // reading rather than the absence of one.
                call.getLong("countdownAt", 0L),
      // CHANGED 5 Oct 2026 - the pre-formatted Redacted line, or "" when the
      // tier is not Redacted. Empty rather than absent, so the provider needs no
      // null case and a stale value cannot survive a change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    @PluginMethod
    public void updateRefill(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), RefillWidgetProvider.class, R.layout.refill_widget);
            call.resolve();
            return;
        }
        RefillWidgetProvider.updateRefill(
                getContext(),
                call.getInt("count", 0),
                opt(call, "nextRefill"),
      // ADDED 20 Oct 2026 - the card's one-word headline, "Soon" or "None".
      //
      // It is computed in JS, from the same stock projection the lines under it
      // are built from, and it is a Full-tier value: "headline" is not in
      // ALLOWED_AT_REDACTED for refillDue, so default-deny drops it at the
      // Redacted tier, where the pre-formatted redacted line carries the
      // meaning instead. It goes BEFORE redactedText because redactedText must
      // stay the last argument of every provider's call - widgetArgumentOrderGuard
      // asserts that positionally, and it is the property that decides whether a
      // Redacted-tier widget is redacted at all.
      opt(call, "headline"),
      // CHANGED 5 Oct 2026 - the pre-formatted Redacted line, or "" when the
      // tier is not Redacted. Empty rather than absent, so the provider needs no
      // null case and a stale value cannot survive a change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    @PluginMethod
    public void updateAppointment(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), AppointmentWidgetProvider.class, R.layout.appointment_widget);
            call.resolve();
            return;
        }
        AppointmentWidgetProvider.updateAppointment(
                getContext(),
                call.getInt("count", 0),
                opt(call, "nextAppt"),
      // ADDED 10 Oct 2026 (t088) - the appointment's time of day and location.
      //
      // BEFORE redactedText, not after. widgetRedactedRender asserts
      // redactedText is the LAST argument of every wired provider's call, and
      // the failure names a DIFFERENT provider than the one you broke - so this
      // is L-083 happening a second time in one session, and this comment is the
      // receipt for why the order below is what it is.
      opt(call, "nextApptTime"),
      opt(call, "nextApptLocation"),
      // ADDED 13 Oct 2026 (t060) - which appointment this widget is showing, so
      // the tap opens THAT one. opt() with no default, because an absent field
      // and an empty id mean the same thing here: "we are not allowed to name an
      // appointment", which is the correct state for every Redacted-tier push.
      opt(call, "nextApptId"),
      // ADDED 13 Oct 2026 (t060) - how many booked visits are beyond the 14-day
      // window. 0 when absent, which renders no suffix at all.
      call.getInt("futureCount", 0),
      // CHANGED 5 Oct 2026 - the pre-formatted Redacted line, or "" when the
      // tier is not Redacted. Empty rather than absent, so the provider needs no
      // null case and a stale value cannot survive a change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    @PluginMethod
    public void updateTest(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), TestWidgetProvider.class, R.layout.test_widget);
            call.resolve();
            return;
        }
        TestWidgetProvider.updateTest(
                getContext(),
                opt(call, "lastTest"),
                opt(call, "retestDue"),
      // CHANGED 5 Oct 2026 - the pre-formatted Redacted line, or "" when the
      // tier is not Redacted. Empty rather than absent, so the provider needs no
      // null case and a stale value cannot survive a change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    @PluginMethod
    public void updateDoxyPEP(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), DoxyPEPWidgetProvider.class, R.layout.doxy_pep_widget);
            call.resolve();
            return;
        }
        DoxyPEPWidgetProvider.updateDoxyPEP(
                getContext(),
                // FIXED 13 Oct 2026 - THIS READ TWO FIELD NAMES THAT CAN NEVER EXIST.
                // Both were `status` and `expiryMs`. The JS side sends `state` and
                // `countdownAt`, and those are the names ALLOWED_AT_REDACTED
                // protects for this widget ("category","state","countdownAt") -
                // `status` and `expiryMs` are not on that list, so default-deny
                // DROPS them at the Redacted tier, and at Full tier they were
                // simply never sent.
                //
                // The symptom was the DoxyPEP widget rendering its title and
                // nothing else. `opt(call,"status")` returned "" for a key that
                // the provider then stored as "", so its own `"No active window"`
                // default never applied - a present-but-empty value beats a
                // default - and the status TextView was set to the empty string.
                // Same for the countdown: `expiryMs` was always 0, so the branch
                // that renders "Active / Expired / Xh Ym remaining" was never
                // taken, for as long as the field was renamed.
                //
                // Fixed HERE rather than by renaming the JS back, because
                // ALLOWED_AT_REDACTED is the privacy contract and the provider
                // must read the names that contract protects. Sending the old
                // names as well would have meant sending two fields where one
                // survives redaction, which is the kind of duplicate that quietly
                // becomes a leak later.
                opt(call, "state"),
                call.getLong("countdownAt", 0L),
                // ADDED 9 Oct 2026 (t093) - the evidence date, or "" at a tier
                // that dropped it. Explicitly whitelisted here (rather than
                // forwarded wholesale) because this bridge picks named fields:
                // an unnamed field is silently dropped, which is exactly how the
                // evidence line would have looked "broken" rather than absent.
                //
                // Placed BEFORE redactedText, not after. widgetRedactedRender
                // asserts the redacted line is the LAST argument of every wired
                // provider's call, so appending a field after it is a regression
                // that only shows up when that guard actually runs.
                 opt(call, "evidenceAt"),
                 opt(call, "lastDoseAt"),
                // The pre-formatted Redacted line, or "" when the tier is not
                // Redacted. Empty is the right default rather than the field's
                // absence, so the provider's "is there a redacted line?" check
                // needs no null case and a stale value from a previous update
                // cannot survive.
                opt(call, "redactedText")
        );
        call.resolve();
    }

    @PluginMethod
    public void updateCycle(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), CycleWidgetProvider.class, R.layout.cycle_widget);
            call.resolve();
            return;
        }
        CycleWidgetProvider.updateCycle(
                getContext(),
                call.getInt("day", 0),
                opt(call, "phase"),
                opt(call, "nextPeriod"),
      // CHANGED 5 Oct 2026 - the pre-formatted Redacted line, or "" when the
      // tier is not Redacted. Empty rather than absent, so the provider needs no
      // null case and a stale value cannot survive a change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    /**
     * nhsNum is accepted for call-shape compatibility with the existing JS and
     * then ignored on purpose - the provider no longer has a parameter for it.
     * See the class comment: storing a national identifier in widget storage is
     * the thing the sink guard exists to stop, and the app already has the real
     * value. Ignoring it here rather than forwarding it means the write cannot
     * come back by accident.
     */
    @PluginMethod
    public void updateClinicCard(PluginCall call) {
        if (isBlank(call)) {
            WidgetBootReceiver.blankWidget(getContext(), ClinicCardWidgetProvider.class, R.layout.clinic_card_widget);
            call.resolve();
            return;
        }
    ClinicCardWidgetProvider.updateClinicCard(
      getContext(),
      opt(call, "title"),
      opt(call, "date"),
      opt(call, "location"),
      opt(call, "tests"),
      opt(call, "docType"),
      opt(call, "clinicNum"),
      // ADDED 6 Oct 2026 - the appointment's TIME of day, separate from `date`.
      // The owner asked for the time on the Clinic Card widget's appointment page.
      // It cannot be derived provider-side: the stored value is a deliberate
      // fake-UTC local wall-clock string, and formatting it in Java would put the
      // timezone interpretation in the one file that has no business owning it.
      // opt() returns "" when absent, so an older JS build simply renders nothing.
      opt(call, "visitTime"),
      // CHANGED 5 Oct 2026 (t059) - the pre-formatted Redacted line, or "" when
      // the tier is not Redacted. Empty rather than absent so the provider's
      // "is there a redacted line?" check needs no null case and a stale value
      // from a previous update cannot survive a tier change back to full.
      opt(call, "redactedText")
    );
        call.resolve();
    }

    private String opt(PluginCall call, String key) {
        String v = call.getString(key);
        return v == null ? "" : v;
    }
}
