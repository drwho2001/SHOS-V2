package com.shos.app;

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
  @Override
  public void onCreate(Bundle savedInstanceState) {
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    super.onCreate(savedInstanceState);
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
