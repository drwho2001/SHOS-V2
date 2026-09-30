#!/usr/bin/env bash
# android-probe.sh - round-1 diagnostics against a real Android device.
#
# WHY A SEPARATE FILE RATHER THAN INLINE YAML. The emulator action's `script`
# input is required, and its purpose is "run this inside the booted emulator".
# Keeping the probe in a version-controlled file means what runs is reviewable
# in a diff, rather than a shell blob buried in a workflow - and this repo has
# been bitten repeatedly by logic that exists but cannot be read.
#
# ROUND 1 DOES NOT ASSERT. It captures the real shape of the output so round 2
# can assert against evidence instead of against a guess. This workflow only
# runs on GitHub, so an assertion written from memory about `dumpsys` output
# would be a fabricated test - the exact failure mode that produced this
# project's three "shipped but never run" defects. Therefore this script NEVER
# exits non-zero. A failing step in round 1 would throw away the diagnostics
# that are the entire point of the round.
#
# Deliberately no `set -e`. One failed probe must not hide the other twelve.

APK="${1:-android/app/build/outputs/apk/debug/app-debug.apk}"
PKG="com.shos.app"

say() { echo ""; echo "########## $* ##########"; }

say "environment"
echo "date:   $(date -u)"
echo "pwd:    $(pwd)"
echo "whoami: $(whoami)"

say "kvm availability (is the emulator hardware accelerated?)"
if [ -e /dev/kvm ]; then
  echo "/dev/kvm EXISTS"
  ls -l /dev/kvm || true
  stat -c '%A %U %G' /dev/kvm || true
  [ -r /dev/kvm ] && echo "readable: yes" || echo "readable: NO - udev rule did not apply"
else
  echo "/dev/kvm DOES NOT EXIST - emulator will run in software mode and be very slow"
fi

say "adb devices"
adb devices -l || true

say "device identity"
for prop in ro.product.model ro.build.version.release ro.build.version.sdk \
            ro.product.cpu.abi ro.kernel.qemu ro.hardware; do
  echo "$prop = $(adb shell getprop $prop 2>/dev/null | tr -d '\r')"
done

say "installing the app"
adb install -r "$APK" 2>&1 || echo "INSTALL FAILED"

say "is the package actually installed?"
adb shell pm list packages | grep -i shos || echo "PACKAGE NOT FOUND"
adb shell dumpsys package "$PKG" 2>/dev/null \
  | grep -iE 'versionName|versionCode|targetSdk|minSdk|firstInstallTime' | head -10 || true

say "granted runtime permissions"
adb shell dumpsys package "$PKG" 2>/dev/null \
  | sed -n '/runtime permissions/,/install permissions/p' | head -25 || true

say "launching"
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" 2>&1 || echo "AM START FAILED"
sleep 15

say "is our activity actually focused?"
adb shell dumpsys window 2>/dev/null | grep -iE 'mCurrentFocus|mFocusedApp' || true

say "is our activity resumed (rather than crashed back to launcher)?"
adb shell dumpsys activity activities 2>/dev/null | grep -i shos | head -20 || true

say "crash buffer (empty means no native crash)"
adb logcat -d -b crash -v brief 2>&1 | tail -40 || true

say "fatal errors and anything naming our package"
adb logcat -d -v brief 2>&1 | grep -iE 'FATAL|AndroidRuntime|shos' | tail -50 || true

say "FLAG_SECURE - is it actually applied to the window?"
# Set unconditionally in MainActivity.onCreate. This is pure OS behaviour and is
# completely unobservable in a browser, so it has never been verified anywhere.
# NOTE: exact dumpsys output differs between Android versions; round 2 asserts
# on whatever this prints, not on a guess made beforehand.
adb shell dumpsys window windows 2>/dev/null | grep -iE 'SECURE|shos' | head -30 || true
echo "--- flags section ---"
adb shell dumpsys window 2>/dev/null | grep -i -A3 'FLAG_SECURE' | head -20 || echo "no FLAG_SECURE token in dumpsys"

say "registered widget providers (manifest says 10)"
# Registration in AndroidManifest and presence in the system's AppWidgetService
# registry are DIFFERENT facts. Round 1 measures the second.
adb shell dumpsys appwidget 2>/dev/null | grep -iE 'shos' | head -40 || true
echo "--- provider count as the OS sees it ---"
adb shell dumpsys appwidget 2>/dev/null | grep -icE 'shos' || echo 0

say "webview devtools socket (would allow driving the React layer)"
# Capacitor enables WebView debugging on debuggable builds. If this socket
# exists, the existing Playwright suite could potentially be pointed at the
# NATIVE WebView rather than only at the web build - which would be a large
# win, and is worth knowing before designing round 2.
adb shell cat /proc/net/unix 2>/dev/null | grep -i webview | head -10 || echo "no webview devtools socket found"
PID=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r')
echo "app pid: ${PID:-none}"
[ -n "$PID" ] && adb shell cat /proc/net/unix 2>/dev/null | grep -i "webview_devtools_remote_${PID}" || true

say "process alive?"
adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' || echo "PROCESS NOT RUNNING - the app died"

say "screenshot (so a human can look at it)"
# Round 1 cannot judge whether the UI looks right, but a human can. This is the
# one thing an emulator genuinely adds that a browser test cannot do.
mkdir -p android-probe-artifacts
adb exec-out screencap -p > android-probe-artifacts/01-home-after-launch.png 2>/dev/null \
  && echo "captured android-probe-artifacts/01-home-after-launch.png" \
  || echo "screencap failed"

say "press BACK and see whether we survive"
adb shell input keyevent 4
sleep 3
adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' >/dev/null && echo "still alive after back: yes" || echo "still alive after back: NO"
adb shell dumpsys window 2>/dev/null | grep -iE 'mCurrentFocus' || true
adb exec-out screencap -p > android-probe-artifacts/02-after-back.png 2>/dev/null || true

say "round 1 probe complete"
echo "diagnostics captured; round 2 will turn these into assertions"
exit 0