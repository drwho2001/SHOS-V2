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

    @PluginMethod
    public void updateNextDose(PluginCall call) {
        NextDoseWidgetProvider.updateNextDose(
                getContext(),
                opt(call, "medName"),
                opt(call, "nextDoseTime")
        );
        call.resolve();
    }

    @PluginMethod
    public void updateRefill(PluginCall call) {
        RefillWidgetProvider.updateRefill(
                getContext(),
                call.getInt("count", 0),
                opt(call, "nextRefill")
        );
        call.resolve();
    }

    @PluginMethod
    public void updateAppointment(PluginCall call) {
        AppointmentWidgetProvider.updateAppointment(
                getContext(),
                call.getInt("count", 0),
                opt(call, "nextAppt")
        );
        call.resolve();
    }

    @PluginMethod
    public void updateTest(PluginCall call) {
        TestWidgetProvider.updateTest(
                getContext(),
                opt(call, "lastTest"),
                opt(call, "retestDue")
        );
        call.resolve();
    }

    @PluginMethod
    public void updateDoxyPEP(PluginCall call) {
        DoxyPEPWidgetProvider.updateDoxyPEP(
                getContext(),
                opt(call, "status"),
                call.getLong("expiryMs", 0L)
        );
        call.resolve();
    }

    @PluginMethod
    public void updateCycle(PluginCall call) {
        CycleWidgetProvider.updateCycle(
                getContext(),
                call.getInt("day", 0),
                opt(call, "phase"),
                opt(call, "nextPeriod")
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
        ClinicCardWidgetProvider.updateClinicCard(
                getContext(),
                opt(call, "title"),
                opt(call, "date"),
                opt(call, "location"),
                opt(call, "tests"),
                opt(call, "docType"),
                opt(call, "clinicNum")
        );
        call.resolve();
    }

    private String opt(PluginCall call, String key) {
        String v = call.getString(key);
        return v == null ? "" : v;
    }
}
