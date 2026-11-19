package com.shos.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

// CHANGED 1 Sep 2026 — real ask: accessibility pass found the app's
// own CSS uses fixed px font sizes everywhere (no rem/em anywhere in
// the codebase), and — the real, fixable half of that finding — this
// WebView was never wired to the device's own font-size accessibility
// setting at all, so someone who's turned up Android's "Font size" in
// system Settings for readability got zero benefit in this app, on
// top of the CSS issue. WebView's own textZoom is a percentage that
// scales ALL rendered text, px-declared sizes included, the same way
// a browser's text-only zoom would — this is the standard, minimal
// fix for that gap without a full CSS unit rewrite. Read once at
// launch, not live-observed: Android doesn't restart the activity for
// a font-scale-only config change class this app declares, and a
// stale value only self-corrects on the next full app open — an
// honest, acceptable limit for how small this fix stays.
public class MainActivity extends BridgeActivity {
  // ADDED — real ask, from a build audit: no screenshot/screen-recording
  // protection existed anywhere in the app, for a build whose own stated
  // value is that personal privacy is paramount. FLAG_SECURE blocks the
  // OS recent-apps switcher from capturing a thumbnail of this app's
  // content and blocks screen-recording/casting from seeing it, for
  // every screen in the app — the simplest, most complete version of
  // this fix, appropriate for an app with no screen that's meant to be
  // shown to someone else mid-session (My Profile/Clinic Card sharing
  // works via an explicit export/share action, not by showing the live
  // screen). Set before super.onCreate() so it applies to the very
  // first frame drawn, not just frames after some later point.
  // CHANGED — real ask: an "allow screenshots" toggle in Settings >
  // Privacy (default on, matching this exact starting flag). The
  // toggle's own real effect happens later, at runtime, via
  // ScreenSecurityPlugin — registered here, before super.onCreate() per
  // Capacitor's own plugin-registration contract, so it's available the
  // moment the WebView can reach it.
  // WidgetBridgePlugin - registered here for the SAME reason as
  // ScreenSecurityPlugin above, and this is not optional bookkeeping: the JS
  // side calls Capacitor's own `registerPlugin("WidgetBridge")`, and that only
  // resolves to a real method if the native class has been registered in
  // MainActivity. Without this line `bridge.updateNextDose` is undefined, the
  // JS guard `if (bridge && bridge.updateNextDose)` silently does nothing, and
  // the home-screen widgets stay exactly as dead as they have been since they
  // were built. That is the whole reason this feature did not work: the
  // provider half, the manifest receiver, the layout and the JS call site all
  // existed, and the one line that joins them did not.
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // COLD-START "TAKE ALL" HANDOFF (19 Nov 2026) — the medication reminder's
    // "Take" action button posts ACTION_MAIN with the plugin's own extras
    // (LocalNotificationManager.buildIntent(): ACTION_INTENT_KEY="TAKE_ALL").
    // The plugin fires `localNotificationActionPerformed` for that tap, but
    // @capacitor/local-notifications v8.3.1 has NO `url` field on a local
    // notification (confirmed in its own LocalNotification.kt + definitions.d.ts
    // — `url` exists only on Attachment, and buildIntent() never sets intent
    // data), so the JS deep-link fallback can never see a tap on its own.
    // Here, on a cold start, we give the launch intent a custom-scheme data
    // URI so Capacitor's Bridge captures it as the launch URL; App.jsx's
    // existing getLaunchUrl()/appUrlOpen handler then logs all due meds with
    // its 5s dedup. This runs BEFORE super.onCreate() because BridgeActivity
    // creates the Bridge (which snapshots getIntent().getData()) inside
    // super.onCreate(). Setting `data` leaves the ACTION_MAIN intent shape
    // intact, so the plugin's own action event still fires normally on a
    // warm start — the two paths co-exist and the JS dedup absorbs a double.
    Intent launchIntent = getIntent();
    if (launchIntent != null && "TAKE_ALL".equals(launchIntent.getStringExtra("LocalNotificationUserAction"))) {
      launchIntent.setData(Uri.parse("com.shos.app://medication/take-all"));
    }
    // Plugins must be registered before super.onCreate() per Capacitor's
    // contract. Window flag operations must happen AFTER super.onCreate()
    // because super.onCreate() (BridgeActivity) fully initialises the
    // Window — any flags set before it can be overwritten.
    registerPlugin(ScreenSecurityPlugin.class);
    registerPlugin(WidgetBridgePlugin.class);
    super.onCreate(savedInstanceState);

    // FLAG_SECURE is always applied at launch, then cleared if the user has
    // previously saved "allow screenshots" ON (default ON on fresh install).
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    if (ScreenSecurityPlugin.isAllowed(this)) {
      getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    if (getBridge() != null && getBridge().getWebView() != null) {
      float fontScale = getResources().getConfiguration().fontScale;
      getBridge().getWebView().getSettings().setTextZoom(Math.round(fontScale * 100));
    }
  }
}
