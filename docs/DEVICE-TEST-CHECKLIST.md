# SHOS — Physical Device Test Checklist

Generated 30 Sep 2026 from a four-part read-only audit of the codebase.

**Why this file exists.** Everything below is something that genuinely cannot be
verified from a development machine, and each item says why — usually because the
relevant value resolves to `0px` in a headless browser, or the behaviour belongs
to the Android OS rather than to this app's code. The audit found several real
defects while reading (items marked **KNOWN FAIL**), and those are listed first
because running them will confirm defects I already know about rather than
discovering new ones.

Ordering is by expected value, not by topic. Do the top block first.

## Status as of 1 Oct 2026 — first real-device round (session A)

Device: Redmi Note 13, model 23124RA7EO, Android 15 / API 35, MIUI V816,
arm64-v8a, 1080x2400 @ 440dpi, build 576f994 then 82ee6f5 then 31f0f9e.

**DONE and verified (the three items below were previously unverified):**

- **§3.3 — FLAG_SECURE immediacy.** PASS. Measured behaviourally with a real
  screencap, not from `dumpsys`: toggle OFF gives mean luminance 2 (black apart
  from the system status/nav bars, which FLAG_SECURE deliberately leaves
  rendering), toggle ON gives 30. No activity recreation needed, so the plugin's
  "immediately, on the very next thumbnail" claim is TRUE.
  **Two measurement traps found doing this, both worth remembering:**
  `dumpsys window` does NOT print `FLAG_SECURE` on Android 15 even when it is
  set (count was 0 in both states), and a correctly-blocked capture has pixel
  *range* 255 — judge the MEAN, never the range, or a working privacy feature
  reads as broken.
- **§6.4 (part) — widget providers registered.** All ten are registered with the
  OS, confirmed independently on the CI emulator and on the phone. A real
  WidgetBridge bug was found and fixed here (see below). **Still outstanding:**
  no widget has been placed on a home screen, so "the widgets now populate"
  is confirmed at code/behaviour level only.
- **A real bug, found and fixed.** All 50 entries in the app's own error log
  were `WidgetBridge.then() is not implemented on android`. Root cause: a
  Capacitor plugin proxy is a catch-all, so `proxy.then` exists, making it look
  *thenable*; returning it bare from an `async` function makes the engine unwrap
  it by calling `.then()`. It threw before reaching the plugin method, so **the
  home-screen widgets had never once displayed anything.** Fixed in all six
  copies (`82ee6f5`); verified silent on-device afterwards.

**Verified with no code change needed:** all 41 storage keys encrypted except
`shos_vault_key_slots` (plaintext BY DESIGN — bootstrap circularity); `adb_enabled`
and `adb_wifi_enabled` both 1; 25 alarms correctly scheduled; all six
`ACTION_TYPE_STORE*` action types registered.

**Environment notes, so a future session does not re-derive them:**

- Wireless adb **drops to offline whenever the phone locks**, and a WiFi change
  additionally invalidates the pairing. Re-pair with the "Pair device with
  pairing code" dialog — the *pairing* port goes to `adb pair`, the *separate*
  main port goes to `adb connect`. Using one port for both is what produces
  "protocol fault". Feed the 6-digit code on `adb pair`'s **stdin**; passing it
  as an argument does not work.
- USB is unusable on this machine: Windows reports `Unknown USB Device (Device
  Descriptor Request Failed)`, error code **43** — the phone never answers the
  USB handshake. That is a cable/port/phone-mode fault, **not** an authorisation
  problem (an unapproved RSA prompt shows as `unauthorized` in adb instead).
- Raise `screen_off_timeout` immediately after connecting, or the session dies
  within a minute or two.
- A WebView accessibility tree dumped with `uiautomator` and **no screen reader
  running** reports toggles as `checkable="false"` regardless of their real
  state. This is an artefact, not an app bug — over CDP the real DOM has
  `role="switch"` with a live `aria-checked`. See §3 warning below.

---

## DO THESE FIRST (≈20 minutes, highest value)

### 1. Per-widget privacy tiers — **IMPLEMENTED; DEVICE RENDER CHECK**

- **Do:** Settings → **Widgets**. Set *Refills Due* and *Next Appointment* to
  **Redacted**, then inspect both placed widgets. Also try **Off**, then restore
  **Full** on one widget.
- **PASS:** Redacted shows its generic category/count line without names, dates,
  times or locations; Off blanks the widget; Full restores the configured details.
- **Code state:** each of the seven data widgets now has its own setting and the
  bridge applies that tier at write time; changing a tier triggers a widget sync.
  The three Quick Add widgets are shortcuts and correctly have no tier picker.
- **Still useful on-device:** source and unit tests prove the write/render path,
  but only a placed widget verifies the launcher displays the expected
  `RemoteViews` after each setting change.

### 2. Home-screen widgets ignore the disclosure level — **KNOWN FAIL**

- **Do:** Settings → **Privacy & Security** → "Lock screen & home screen
  detail". Confirm it is on **Masked** (the default). Go Home and look at Refills
  Due, Next Appointment, Last Test, Clinic Card, Cycle and DoxyPEP.
- **Look for:** any health-identifying text.
- **PASS:** counts and generic status only.
- **FAIL (expected):** medication names, clinic visit titles, clinic locations,
  cycle phase. The disclosure resolver has exactly one call site in the whole app
  (`notificationService.js`, inside `scheduleNotification`); every widget write
  bypasses it. The copy on that screen says it covers "your notifications **and
  home-screen widgets**".
- **The one correct widget:** Next Dose, which shows a time and never a name.

### 3. Duress PIN plus a home-screen widget — **LIMITATION DISCLOSED; DEVICE CHECK**

- **Do:** Have a real medication due for refill and a real booked clinic visit.
  Open the app so the widgets populate. Lock the app (Home tab 🔒 icon), enter the
  **duress** PIN, then press Home so the launcher and its widgets are visible.
- **Look for:** what the widgets say while the decoy session is showing.
- **Expected:** the widget remains under the launcher's control and may continue
  showing the information permitted by its own Full/Redacted/Off setting. Duress
  mode changes the app screen; it does not hide already-placed launcher widgets.
  The Privacy screen now states this limitation and points users to Settings →
  Widgets to choose Redacted or Off before handing over the phone.
- **Record:** whether the visible widget agrees with its configured tier, and
  whether the disclosure is visible in Privacy & Security before setting the
  duress PIN. Do not treat an already-disclosed Full-tier widget remaining visible
  as a new regression; this check verifies the documented boundary on hardware.

### 4. Android back button out of Partner Notification

- **Do:** Healthcare → **Testing** → open a **positive** result → ⋯ menu → open
  **Partner notification**. Press back.
- **Look for:** whether the sheet closes and you stay on the test detail.
- **PASS:** one press → sheet closed, still on the test detail.
- **FAIL:** one press exits toward the Testing list or Home — the sheet is
  skipped.
- **Why device-only:** this depends on whether `TestDetail`'s registered handler
  knows the sheet is open. That logic exists and looks right, but its behaviour is
  only observable through a real `backButton` event, which never fires in a
  browser preview.

### 5. Maximum system font size

- **Do:** Settings → System → Display → **Font size**, set to the largest.
  Reopen SHOS and walk Contacts, Encounters, Medication, Healthcare and Settings.
- **Look for:** clipped or overlapping text, buttons pushed off-screen.
- **PASS:** nothing clipped at any size.
- **FAIL:** any element truncates or overlaps.
- **Why device-only:** this app uses `px` throughout with no scaling, plus a
  WebView font-scale multiplier. It cannot be reproduced by resizing a browser
  window.

---

## 1. Safe-area / status-bar / notch (Known Issue #68)

**Why untestable off-device:** 201 `env(safe-area-inset-*)` references across 41
files, and `index.html` sets `viewport-fit=cover` so the WebView genuinely draws
edge-to-edge. In a headless browser `env()` resolves to `0px`, so every one of
those values silently collapses and the layout looks correct while being wrong.

### 1.1 Bottom nav vs the last row of content
- **Do:** On each of the 5 tabs, scroll to the absolute bottom. Contacts (long
  list) → Activity/Encounters → Medication → Healthcare (each sub-tab).
- **Look for:** clear space between the last content pixel and the nav bar's top
  edge.
- **PASS:** ≥ ~8px gap on every tab.
- **FAIL:** the last row is flush with or hidden behind the nav bar.
- **Why:** `<main>` carries `paddingBottom: calc(76px + env(safe-area-inset-bottom))`
  while the nav itself is padded `calc(7px + env(...))` — two independently
  computed numbers for one physical bar.

### 1.2 The double top inset on the coloured banners
- **Do:** Open **Contacts**, **Healthcare**, **Medication**, **Activity** at
  scroll position 0 without scrolling, then scroll and watch the banner stick.
- **Look for:** is the gap above the title the same at rest and when stuck?
- **PASS:** identical.
- **FAIL:** a noticeably larger gap at rest than when stuck — roughly double the
  notch height — snapping tighter on first scroll.
- **Why:** `<main>` already applies the top inset, *and* each banner applies its
  own `padding: calc(16px + env(safe-area-inset-top))`. Pure CSS reasoning about
  sticky positioning, but the visible result needs a real notch.

### 1.3 Sub-heading bars must sit flush under the banner
- **Do:** Healthcare → scroll down; then each sub-tab (Testing, Clinic Visits,
  Vaccinations, Symptoms, Measurements). Then Contacts in select-mode.
- **PASS:** flush, both borders visible.
- **FAIL:** overlap, clipping, or a 1–2px sliver between them.
- **Why:** these bars hardcode `top: calc(env(safe-area-inset-top) + 62px)`, an
  offset only correct for one specific banner height plus one specific inset.

### 1.4 Bottom sheets — last field above the gesture bar
- **Do:** Open a long Add/Edit sheet and scroll to the bottom: Contacts FAB **+**;
  Testing FAB **+**; Clinic Visits FAB **+**; Measurements FAB **+**; Settings →
  **Privacy**.
- **PASS:** Save fully visible with a thumb-sized gap below.
- **FAIL:** Save clipped or only reachable by reaching under the gesture bar.
- **Why:** two different sheet shapes exist — some pad by
  `calc(80px + env(safe-area-inset-bottom))`, others use
  `alignItems: "flex-end"` with **no** bottom padding at all. The second has no
  inset protection by construction.

### 1.5 FABs and toasts
- **Do:** Check the floating **+** on Testing, Clinic Visits, Vaccinations,
  Symptom Log, Measurements, Menstrual & Contraception, Episodes. Then trigger an
  undo toast and a "hidden for now" dismissal toast.
- **FAIL (if seen):** the bottom of the **+** is under the gesture area, or a
  toast's lower line is cut.

### 1.6 Switch gesture nav ↔ 3-button nav
- **Do:** System Settings → System → Navigation mode. Change it, then re-check
  1.1 and 1.5.
- **PASS:** re-checked items still pass immediately, no app restart needed.
- **Why:** `MainActivity` declares `configChanges` including `navigation`, so the
  activity handles the change itself rather than recreating — exactly the case
  where a CSS `env()` value could fail to be re-read.

---

## 2. Notifications

**Why untestable off-device:** every native call is wrapped in `withTimeout(…, 8000)`
and returns `false` on web. On a browser, `scheduleNotification` takes the web
branch using an in-memory `setTimeout`, which only fires while the tab is alive.
The APK path goes through `plugin.schedule()` and the OS holds the alarm.

### 2.1 Confirm the pipeline works at all — do this first in §2
- **Do:** Settings → **Notifications**. Read the status card. If it says
  notifications aren't allowed, tap **Allow notifications** and accept the system
  prompt. Read the exact-alarms card; if it says not allowed, tap **Fix this** and
  enable in system settings. Then tap **Send test notification**, wait ~6s.
- **Look for:** a notification titled "SHOS test notification" within ~6s.
- **PASS:** it arrives.
- **FAIL:** nothing, or the button reports failure.
- **If the status card says "Couldn't check notification status":** record the
  monospaced error block under it. It deliberately names the failing native method
  and whether it "timed out (never resolved)" or "rejected", plus whether the
  failure is bridge-wide or plugin-specific. That block is the single most useful
  diagnostic the app has and it only exists on-device.
- **Why:** `SCHEDULE_EXACT_ALARM` is an Android 12+ *system* setting, off by
  default for most apps. Without it Android silently downgrades to an inexact
  alarm. No browser can observe this.

### 2.2 Lock-screen text at each disclosure level — the whole point of the setting
- **Do, three times:** set Settings → Privacy → "Lock screen & home screen
  detail" to *Masked*, then *Glanceable*, then *Detailed*. For each, trigger a real
  reminder — Home's due banners have **Request Refill** / **Snooze** actions that
  fire the real notification immediately — then **lock the screen** and let it
  arrive.
- **Look for, on a locked screen** (not the shade):
  - *Masked* → title `SHOS`, body something like `Open the app to see what's due.`
  - *Glanceable* → real title, short non-clinical body (`Medication reminder`).
  - *Detailed* → the full original text including the medication name.
- **PASS:** rendered text matches the level in every case, and at *Masked* no
  medication name, test type, appointment title or cycle phase appears anywhere —
  including the channel name, the app label line, and the action button labels
  (`Take`, `Cancel`, `Snooze 30 min`, `Requested`).
- **FAIL:** any clinical text at Masked or Glanceable. Copy it exactly and note
  which reminder type.
- **Why:** the resolver's decisions *are* unit-tested. What no test can check is
  what **Android actually renders** on a locked screen, which depends on your
  lock-screen settings and your OEM's skin. Some devices show only the app name
  and truncate aggressively, so "masked" can be satisfied while "detailed" still
  doesn't show what you expect.

### 2.3 Doze / battery optimisation — expect this to be the flakiest
- **Do:** Schedule something a few hours out (a real DoxyPEP window or a dose).
  Turn the screen off. Check Settings → Battery → **Battery optimisation** for
  SHOS and set it *Unrestricted* if it isn't, then repeat.
- **PASS:** arrives within ~15 minutes of intended.
- **FAIL:** hours late or not at all, and only appears when you open the app.
- **Why:** `allowWhileIdle: true` is set, but Android still throttles to once per
  9 minutes per app, and OEM battery managers (MIUI, OneUI, HyperOS) kill the
  alarm outright. Device/OEM property, not a code property.

### 2.4 Quiet hours
- **Do:** Set quiet hours to cover the next 30 minutes. Trigger a real reminder.
- **PASS:** deferred to the end of the window.
- **Why device-only:** deferral is real scheduling, so it is partly verifiable —
  but the *test* notification deliberately bypasses quiet hours, so the only way
  to test it is with a real reminder over real elapsed time.

### 2.5 Action buttons and history backfill
- **Do:** With a real medication reminder showing, expand it and tap **Take**.
  Then open Settings → Notifications → **Notification history**.
- **PASS:** the dose is logged in the app and appears in history.
- **Expected failure, not a bug:** if you **force-stop** the app first, then tap
  **Take**, the app may open without logging the dose. That is a documented
  upstream Capacitor limitation (`localNotificationActionPerformed` never fires
  from a dead process). Test action buttons with the app *running* in background.

---

## 3. FLAG_SECURE / screenshots

**Why untestable off-device:** enforced entirely by the Android window manager.

**§3.3 is DONE and verified — see the status block at the top. Do not redo it.**
What remains is only the recents-thumbnail rendering (§3.1), the
Power+Volume-Down attempt (§3.2), and recording/casting (§3.4), none of which
can be driven over adb.

**Measurement warning, learned the hard way.** Do NOT verify FLAG_SECURE from
`dumpsys window` — on Android 15 it does not print the flag at all, so a
grep-based check reports a working feature permanently broken. And a
correctly-blocked screencap is NOT uniform black: FLAG_SECURE blanks the app
window while the system status and navigation bars still render, giving a pixel
range of 255. Judge the MEAN luminance (measured 2 blocked vs 30 visible).

### 3.1 Toggle OFF (default) — task switcher thumbnail
- **Do:** Confirm Settings → Privacy → **Allow screenshots** is OFF. Open a screen
  with real content. Lock the phone, unlock, then open the **recents** view
  (swipe up and hold).
- **PASS:** a solid black rectangle / app icon on a blank tile.
- **FAIL:** a real screenshot of your data in the thumbnail.

### 3.2 Toggle OFF — real screenshot attempt
- **Do:** With the toggle still OFF, on a data screen, press Power + Volume Down.
- **PASS:** no screenshot taken.
- **FAIL:** a screenshot of your data lands in the gallery.
- **Do this before touching the toggle**, or you will have to delete it.

### 3.3 Toggle ON — does it actually work immediately?
- **Do:** Settings → Privacy → **Allow screenshots** → ON. **Without leaving
  Settings** and without restarting, return to the recents view and try a
  screenshot.
- **PASS:** both now show real content.
- **FAIL:** the UI says it changed but nothing did.
- **Why this is worth doing:** the plugin's own comment claims the change takes
  effect "immediately, on the very next recent-apps thumbnail, with no activity
  recreation". That claim is unverified. If it only works after a restart, the
  comment is wrong.
- **Also:** the toggle should only be *offered* on native. If you see it in a
  browser preview, that is a bug.

### 3.4 Screen recording and casting
- **Do:** With the toggle OFF, start a screen recording while SHOS is foreground.
  Also check a screen-mirroring target does not offer SHOS.
- **PASS:** black/blank recording, no mirroring target.
- **Why:** `FLAG_SECURE`'s recording/casting coverage is broader than its
  screenshot coverage, and the app's comment claims both.

---

## 4. Duress PIN and the decoy

**Why untestable off-device:** the duress PIN is checked by a literal `===`
against a pre-unlock mirror, and there is no browser equivalent of a duress screen.

### 4.1 The decoy opens and is convincing
- **Do:** Settings → Privacy → set a real PIN (4+ digits) → turn App Lock **on** →
  **Set a duress PIN** (must differ; the app rejects a duplicate). Lock the app →
  enter the **duress** PIN.
- **PASS:** a plausible but empty SHOS — 5 tabs, header, fabricated rows.
- **FAIL:** anything real is visible, or the duress PIN is rejected.

### 4.2 No path out of the decoy
- **Do:** In the decoy, tap every tab, tap the 🔒 icon, press back repeatedly,
  then try the launcher long-press **App Shortcuts** ("Log dose" / "Add encounter").
- **PASS:** no path to real data.
- **FAIL (worth checking):** an App Shortcut opens a *real* Add Encounter / Add
  Medication sheet on top of the decoy. The deep-link listener is registered at
  module scope and is not gated on `decoyActive`. A shortcut tap is a real app
  start, so it may escape the decoy.

### 4.3 Drafts are wiped on lock
- **Do:** With App Lock on, open Contacts → **+**, type a name and some notes into
  several fields, **do not save**. Close the sheet. Lock. Unlock with the **real**
  PIN. Reopen Contacts → **+**.
- **PASS:** empty form, no "Restored unsaved changes" banner.
- **FAIL:** the draft came back.
- **Why:** drafts live in `sessionStorage`, cleared by one effect keyed on
  `locked`. There are four lock paths (manual, auto-relock timeout,
  double-press-home, leaving the decoy) — test **at least two**, since the risk is
  a specific path bypassing the wipe.

---

## 5. App Lock

Lowest-yield section of the checklist, except 5.2 — the basic PIN flow is covered
by smoke flow 13 in CI.

### 5.1 Rejection messages
- **Do:** Try to set a duress PIN equal to the real one (should be rejected);
  a 3-digit PIN (rejected); mismatched confirmation (rejected). Then confirm App
  Lock works from the lock screen, the Home 🔒 icon locks, and 5 wrong PINs
  triggers the lockout.
- **PASS:** each rejection shows the right message; lockout engages.

### 5.2 Auto-relock grace period — the real item here
- **Do:** Set the grace period to **1 minute**. Unlock, note the time. At **+30s**
  press Home and reopen — expect to go straight in. At **+90s** reopen — expect the
  PIN. Then set it to **10 minutes** and repeat at **+2 min** and **+11 min**.
- **PASS:** exactly that boundary behaviour.
- **FAIL:** ignored, inverted, or drifting by more than ~30s.
- **Why:** this is real elapsed time against `appLockGraceMinutes * 60000`.
- **Bonus worth doing:** while the grace window is open, change the phone's
  date/time in system settings, then reopen. A backwards jump would make elapsed
  time negative and silently skip the relock. Nobody has ever looked for this.

### 5.3 Recovery string end-to-end
- **Do:** Settings → Privacy → **Set a recovery string** (6+ chars). Lock. Tap
  **Forgot PIN?** Enter the recovery string plus a new PIN and confirmation.
- **Then confirm:** changing the PIN afterwards still works, and turning App Lock
  off still works.
- **PASS:** all of it.
- **Why:** this is a real already-diagnosed-and-fixed bug (the vault's PIN slot and
  the repository's `anonymisePin` were two copies of "the current PIN"; recovery
  originally wrote only one, leaving Settings reading a stale PIN forever after).
  The failure only manifests with a real PBKDF2 re-wrap followed by a real
  Settings toggle.
- **Also:** change your PIN normally, lock, and use the recovery string again — it
  should still work, because the recovery slot wraps the permanent Data Key.

---

## 6. Deep links and widgets — tapping

### 6.1 Every widget's tap destination

| Widget | Should open | Known state |
|---|---|---|
| Refills Due | Medication tab | |
| DoxyPEP Window | Medication tab | |
| Last Test | Healthcare → Testing | |
| Cycle | Healthcare → Menstrual & Contraception | |
| Next Appointment | Healthcare → Clinic Visits | |
| Quick Add Contact / Encounter / Medication | the relevant Add sheet | the only three that have ever worked — pure launch intents |
| Clinic Card | **probably Healthcare → Testing, not the Clinic Card** | **KNOWN FAIL, likely** |
| Next Dose | nothing at all | **KNOWN FAIL** — this provider has no click PendingIntent, the only one of the ten that lacks one |

### 6.2 Clinic Card widget tap — likely wrong screen
- **Do:** Book a future clinic visit, open the app so the widget writes, then tap
  the Clinic Card widget body.
- **FAIL (expected):** you land on **Healthcare → Testing**. The route resolves to
  `{tab: "healthcare", subTab: "clinicCard"}`, but Healthcare's sub-tab
  initialiser is a hardcoded list of `testing / clinicVisits / vaccinations /
  symptomLog / measurements / menstrualHealth` — `clinicCard` matches none, so it
  falls through to `testing`. Clinic Card is a separate overlay, not a sub-tab.

### 6.3 Clinic Card widget "tap to reveal" — likely inert
- **Do:** With a booked visit, tap the blue "Tap to reveal sensitive info" line on
  the Clinic Card widget.
- **FAIL (expected):** the app opens and nothing is revealed. The route resolves to
  an `action`, and `App.jsx` handles it with a **comment and nothing else**.
- **Secondary note:** even once wired, the revealed flag lives in the same prefs
  file and is reset only on the next clinic-visit save, so one tap would flip it
  permanently. A mask you can permanently disable with one tap is security
  theatre — which the Java file's own comment already says.

### 6.4 Widget refresh timing and force-stop — set expectations first
- **Do:** Note what each widget shows. Settings → Apps → SHOS → **Force stop**.
  Wait 60s. Look at the widgets. Then open the app and look again.
- **EXPECTED, correct behaviour:** nothing changes while force-stopped, and
  everything refreshes within a second of relaunching. All ten widget XML files
  declare `updatePeriodMillis="0"` — there is **no periodic refresh at all**.
  Widgets only change when the app runs and a sync fires.
- **Why device-only:** the encryption design is why this is subtle. The app's own
  vault Data Key is non-extractable and in-memory only, so a cold-started widget
  process cannot reach it; hence a separate Keystore-backed
  `EncryptedSharedPreferences`. You can only confirm on-device that a cold-started
  widget process can actually decrypt it.

### 6.5 Widget resizing
- **Do:** Long-press each widget → resize → drag both handles to their extremes.
- **PASS:** text reflows or truncates cleanly, nothing overlaps.
- **Why:** layouts are plain `LinearLayout` with `wrap_content` text and no
  `maxLines`, `ellipsize` or `autoSizeTextType`.

---

## 7. Play Store readiness (not a device test)

Outstanding and requiring your Play Console account:
1. **Signing key + App Bundle.** `build-apk.yml` produces a **debug** APK. The
   `release` build type has no `signingConfig` at all as configured.
2. **Closed testing track.** Required minimum testers before production.
3. **Data Safety questionnaire.** The draft answers in `PLAY_STORE_LISTING.md`
   are reasoned and honest; they need entering into the structured form, which may
   ask things the Markdown draft does not anticipate.
4. **IARC content rating.** Interactive; expect Mature/18 and answer honestly.
5. **Feature graphic (1024×500).** Optional, not produced.

---

## 8. Android version matrix

- **Do:** If you have only one device, note its Android version. Everything above
  is designed around the common case and should be re-checked on a different
  version if you can.
- **Highest-value differences across versions:** notification channels and
  exact-alarm behaviour (Android 12+ `SCHEDULE_EXACT_ALARM` is a system setting);
  scoped storage (Android 10+) affecting folder export; Doze and OEM battery
  management (item 2.3); widget resizing and refresh.
- **Most likely to differ:** anything involving notifications or widgets, on an
  OEM-skinned device. That is where this codebase's own comments record having
  previously seen `withTimeout` fire because a MIUI-style process throttle
  stopped the native bridge call resolving at all.

---

## Reporting back

For anything that fails, the most useful thing you can give me is:
1. The exact navigation path you took.
2. What you expected and what happened.
3. A screenshot.
4. For notification/widget issues, the exact text or value shown.

For item 2.1 specifically, the on-device error block is worth copying verbatim —
it names the failing native method, which is far more actionable than "it didn't
work".
