package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;
import com.shos.app.R;

/**
 * Blanks every widget immediately after a reboot.
 *
 * WHY THIS EXISTS. Android persists the last RemoteViews a provider rendered and
 * the Launcher re-displays them on the home screen WITHOUT the app running and
 * WITHOUT the vault being unlocked. So a phone that is rebooted shows the last
 * medication name, cycle phase, test date and clinic visit that were on screen
 * before the restart - before the user has entered a PIN, and on a device that
 * may not even have been unlocked once yet.
 *
 * That is the same class of leak this file's package has been closing one layer
 * at a time: EncryptedSharedPreferences protects the FILE, but RemoteViews are
 * already-rendered pixels that encryption never touched. Closing the storage gap
 * does nothing about the screen gap, which is the reason widgetPrivacy exists at
 * all.
 *
 * WHY A RECEIVER RATHER THAN WAITING FOR THE APP. The app will not necessarily
 * be launched for a long time after a reboot, and a user glancing at their home
 * screen before then is exactly the person this is meant to protect. This runs
 * from the broadcast alone.
 *
 * WHAT IT DOES NOT DO. It does not clear the encrypted store. The stored values
 * stay, so the next widget update repopulates the widget exactly as before - a
 * reboot should cost the user nothing once they open the app. Only the RENDERED
 * pixels are cleared.
 *
 * WHY HIDE THE ROOT RATHER THAN SETTING TEXT TO "". Setting every label to an
 * empty string still leaves the widget's own background, padding and spacing on
 * screen, so it reads as "something is here" and looks broken rather than
 * deliberately blank. Hiding the root collapses the lot into an empty box.
 * ClinicCardWidgetProvider already uses setViewVisibility with View.GONE the
 * same way, so the signature is proven in this codebase rather than assumed.
 */
public class WidgetBootReceiver extends BroadcastReceiver {

    private static final String TAG = "WidgetBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !isBootAction(intent.getAction())) {
            return;
        }
        try {
            blankAll(context);
        } catch (Exception e) {
            // A widget provider crashing here would take down the boot broadcast
            // for everything else listening. Log and stop; the next normal widget
            // update repopulates.
            Log.w(TAG, "could not blank widgets on boot", e);
        }
    }

    /**
     * Accepts both boot broadcasts, and the order of these two matters.
     *
     * The first version of this file accepted BOOT_COMPLETED alone, which reads
     * like the obvious choice and is the wrong one: that broadcast fires only
     * AFTER the user unlocks the device. system_server re-paints a widget's last
     * cached RemoteViews from disk without waking the app, so a receiver that
     * waits for BOOT_COMPLETED cannot blank anything until someone types a PIN -
     * which is precisely after the disclosure it exists to prevent.
     *
     * LOCKED_BOOT_COMPLETED arrives while the user is still locked, and reaches
     * this receiver because the manifest marks it android:directBootAware.
     * BOOT_COMPLETED is retained as the pre-N fallback, where no direct-boot
     * concept exists and it is the only signal there is.
     */
    private static boolean isBootAction(String action) {
        return Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action);
    }

    private void blankAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;

        blank(manager, new ComponentName(context, NextDoseWidgetProvider.class), R.layout.next_dose_widget);
        blank(manager, new ComponentName(context, RefillWidgetProvider.class), R.layout.refill_widget);
        blank(manager, new ComponentName(context, AppointmentWidgetProvider.class), R.layout.appointment_widget);
        blank(manager, new ComponentName(context, TestWidgetProvider.class), R.layout.test_widget);
        blank(manager, new ComponentName(context, DoxyPEPWidgetProvider.class), R.layout.doxy_pep_widget);
        blank(manager, new ComponentName(context, CycleWidgetProvider.class), R.layout.cycle_widget);
        blank(manager, new ComponentName(context, ClinicCardWidgetProvider.class), R.layout.clinic_card_widget);
    }

    /**
     * Blanks ONE data widget, leaving the other six untouched.
     *
     * Exists because "Off" is per widget, not global. The owner can reasonably
     * want their medication countdown on the home screen and no clinic card at
     * all, and blanking all seven because one is off would be a privacy control
     * that destroys the settings around it.
     *
     * The widget tier is decided in JS by sendWidgetUpdate, which sends nothing
     * but the tier when a widget is Off; this is the half JS cannot do, because
     * an empty payload would still render the widget's own background, padding
     * and title - which looks broken rather than deliberately blank. Hiding the
     * root is what makes it look intentional.
     */
    public static void blankWidget(Context context, Class<?> provider, int layoutId) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        blank(manager, new ComponentName(context, provider), layoutId);
    }

    private static void blank(AppWidgetManager manager, ComponentName component, int layoutId) {
        int[] ids = manager.getAppWidgetIds(component);
        if (ids == null || ids.length == 0) return;
        RemoteViews empty = new RemoteViews(component.getPackageName(), layoutId);
        // CHANGED - the first version of this used setEmptyView(R.id.widget_root)
        // and CI rejected it: "required: int,int / found: int". There is no
        // single-argument setEmptyView. The two-argument overload sets a
        // FALLBACK layout to use when a container is empty - it does not blank
        // anything - so the method was never going to do what the comment claimed.
        //
        // Hiding the root is the honest equivalent: the widget renders as an
        // empty box rather than showing a title with nothing under it, and the
        // next successful update replaces the whole RemoteViews, so nothing here
        // has to be undone.
        empty.setViewVisibility(R.id.widget_root, View.GONE);
        manager.updateAppWidget(ids, empty);
    }
}
