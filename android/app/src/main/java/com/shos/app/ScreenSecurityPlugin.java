package com.shos.app;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// ADDED — real ask: an "allow screenshots" toggle in Settings > Privacy,
// default OFF (screenshots/recording blocked), on top of this app's own
// existing always-on FLAG_SECURE default (see MainActivity's own
// onCreate). FLAG_SECURE can be added/cleared on the real Window at any
// time — not just at onCreate — so toggling this setting takes effect
// immediately, on the very next recent-apps thumbnail/screen-recording/
// casting attempt, with no activity recreation or app restart needed.
// The one custom Capacitor plugin this app has ever needed — every
// other native integration is a third-party npm package.
@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {
  @PluginMethod
  public void setSecure(PluginCall call) {
    boolean secure = call.getBoolean("secure", true);
    getActivity().runOnUiThread(() -> {
      if (secure) {
        getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
      } else {
        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
      }
    });
    JSObject ret = new JSObject();
    ret.put("secure", secure);
    call.resolve(ret);
  }
}
