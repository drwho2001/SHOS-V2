package com.shos.app;

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
  @Override
  public void onStart() {
    super.onStart();
    if (getBridge() != null && getBridge().getWebView() != null) {
      float fontScale = getResources().getConfiguration().fontScale;
      getBridge().getWebView().getSettings().setTextZoom(Math.round(fontScale * 100));
    }
  }
}
