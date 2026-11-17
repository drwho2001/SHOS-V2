# Platform parity — think → challenge → plan → fix (17 Nov 2026)

## 1. THINK — what is native-only and what does a web user actually see?

| Feature | Native (APK) | Web/PWA | How it's gated today |
|---|---|---|---|
| Biometric unlock | Real fingerprint/face via `@aparajita/capacitor-biometric-auth` | **Impossible** — no plugin, no hardware API | `checkBiometryAvailable()` returns "Biometrics need the installed app, not this preview" — but the toggle is **rendered anyway** whenever App Lock is on (`PrivacyScreen.jsx:629-642`). A web user sees "Unlock with biometrics — Fingerprint or face unlock…", taps it, gets an error. |
| Local notifications | Capacitor local notifications | Web Notification API (`notificationService.js:586`) | Already gated by platform internally |
| Calendar write-sync | `@capacitor/calendar` | **Impossible** | `calendarSyncService` warns and no-ops; `CalendarScreen` shows sync toggles + "Loading calendars…" / "none available" |
| App Lock / PIN | Works (vault in EncryptedSharedPreferences) | Works (localStorage vault) | Shared |
| Share sheet / folder export | Native picker | Clipboard / browser fallback | `Contacts` + `ShareScreen` already fall back |
| Update banner "Download APK" | Relevant | **Irrelevant** — the web build is always current | Shown on web (`App.jsx:3318`) — R1 |
| "Get the app" / QR codes (About, Share) | Helpful | Fine (install prompt) | — |

**Core question the owner raised:** a web user should not be *offered* something the web build cannot do. The biometric toggle is the clearest violation: it is advertised on web and fails on tap. The comment at `PrivacyScreen.jsx:625-627` claims it is "Not shown at all in a browser preview's own build check" — that comment is **wrong**: the check happens on *tap*, not on *render*. That is exactly the "negative status claim that misleads the next session" class `CLAUDE.md` warns about.

## 2. CHALLENGE

- **Is hiding biometrics on web right?** Yes — the repo already hides native-only UI elsewhere by platform (`App.jsx` guards SW update for native; `notificationService` picks a path). Biometric is the one place it is rendered and fails on tap. But: a user who sets up biometrics on Android then opens the same data in the browser should still see that it's enabled (read-only), not have the setting vanish silently. So: **hide the toggle on web, but if the flag is on, show a one-line read-only note** ("Biometric unlock is set up in the Android app").
- **Calendar sync on web:** same logic — a web user sees toggles that no-op. But the Settings "Calendar" I exercised in this browser is only a read-only month grid (Filter + week-start); the 4 sync toggles live in a different screen path not reached here. Do NOT rip out the sync UI blind — confirm reachability first. Safe fix: gate the sync toggles on native if they are reachable on web.
- **"Download APK" in the update banner:** owner asked why a web user is offered an APK. On web the app auto-updates via GitHub Pages; the banner itself is largely a native-app concern. Fix under R1 (hide APK link on web), already queued — not a new item.
- **Fit-to-screen pages:** the owner asks which pages should not scroll. Calendar is a prime candidate — a month grid should fit one viewport (7 rows max + week-start + filter), so no vertical scroll. But: a month grid with event dots + an event list below will overflow on small phones; "no scroll" must mean the *grid* fits, with the event list still scrollable. Also landscape (405dp tall) is the real constraint (`DESIGN-MANUAL.md` landscape note). Do not force `overflow:hidden` — that hides data.

## 3. PLAN

1. Add a pure platform helper `isNativePlatform()` in `src/calculations/platform.js` (lazy dynamic import of `@capacitor/core`, try/catch, cached) + a test. Reuse `Capacitor.isNativePlatform()` where synchronous is fine; async helper where already async.
2. **FIX (this change):** `PrivacyScreen.jsx` — render the biometric toggle only when native AND App Lock on; when the flag is on but platform is web, show a read-only note. Fix the misleading comment.
3. **Queue (not this change):** Calendar sync toggles on web (confirm reachability), update-banner APK link on web (R1).
4. **Calendar fit-to-screen:** treat as a design rule, not a blanket `overflow:hidden` — add to DESIGN-MANUAL that calendar-style grid views must fit the viewport on portrait *and* landscape, with the event list as the only scroll region. Implementation queued, not forced now (needs careful responsive work + real-device check).
5. Update docs (CLAUDE.md, HISTORY, audits) per workflow.

## 4. FIX (implemented)

- `src/calculations/platform.js` — `isNativePlatform()` pure-ish helper (async, cached, false on web/failed import) + test.
- `PrivacyScreen.jsx` — gate biometric toggle on `isNativePlatform()`, show a read-only note when biometric flag is set on web; correct the comment.

## 5. WHAT I DID NOT DO (and why)

- Did not remove Calendar sync toggles: reachability on web unconfirmed in this browser (Settings "Calendar" here is a read-only grid). A blind edit risks removing a working native setting. Queued.
- Did not force Calendar `overflow:hidden`: would hide event data. Rule documented; implementation queued for a responsive pass with real-device verification.
- Did not touch the other session's i18n/BACKLOG files that failed the gate — those are not this change.

---
*No clinical advice. No commit/push.*
