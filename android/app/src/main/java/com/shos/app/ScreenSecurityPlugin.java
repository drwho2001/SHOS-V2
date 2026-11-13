package com.shos.app;

import android.content.SharedPreferences;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// ADDED - real ask: an "allow screenshots" toggle in Settings > Privacy,
// default OFF (screenshots/recording blocked), on top of this app's own
// existing always-on FLAG_SECURE default (see MainActivity's own
// onCreate). FLAG_SECURE can be added/cleared on the real Window at any
// time - not just at onCreate - so toggling this setting takes effect
// immediately, on the very next recent-apps thumbnail/screen-recording/
// casting attempt, with no activity recreation or app restart needed.
// The one custom Capacitor plugin this app has ever needed - every
// other native integration is a third-party npm package.
// FIXED 13 Nov 2026 - persist the choice in SharedPreferences so
// MainActivity can apply it at cold start (before the WebView/JS ever
// runs). Previously the flag was only cleared at runtime via JS, so a
// cold launch re-added FLAG_SECURE and the saved preference was only
// re-applied later (fire-and-forget), which could leave screenshots
// blocked even when Settings showed "allowed".
@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {
  private static final String PREFS = "shos_prefs";
  private static final String KEY_ALLOW = "allow_screenshots";

  @PluginMethod
  public void setSecure(PluginCall call) {
    boolean secure = call.getBoolean("secure", true);
    final boolean allow = !secure;
    getActivity().runOnUiThread(() -> {
      if (secure) {
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
      } else {
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
      }
    });
    // Persist for cold-start application in MainActivity.
    SharedPreferences sp = getActivity().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    sp.edit().putBoolean(KEY_ALLOW, allow).apply();
    JSObject ret = new JSObject();
    ret.put("secure", secure);
    call.resolve(ret);
  }

  public static boolean isAllowed(android.content.Context ctx) {
    SharedPreferences sp = ctx.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    return sp.getBoolean(KEY_ALLOW, false);
  }
}
"