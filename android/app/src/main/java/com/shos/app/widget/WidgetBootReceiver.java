package com.shos.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
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
 * WHY setEmptyView RATHER THAN SETTING TEXT. Setting text to "" still leaves the
 * widget's own layout, spacing and background on screen, which reads as "something
 * is here" and looks broken. setEmptyView collapses the layout, so the widget is
 * visibly blank and visibly the app's own doing.
 */
public class WidgetBootReceiver extends BroadcastReceiver {

    private static final String TAG = "WidgetBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
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

    private void blank(AppWidgetManager manager, ComponentName component, int layoutId) {
        int[] ids = manager.getAppWidgetIds(component);
        if (ids == null || ids.length == 0) return;
        RemoteViews empty = new RemoteViews(component.getPackageName(), layoutId);
        empty.setEmptyView(R.id.widget_root);
        manager.updateAppWidget(ids, empty);
    }
}
