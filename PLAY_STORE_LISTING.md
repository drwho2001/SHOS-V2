# Play Store readiness — reference content

Working notes for the Google Play Console listing, not a file the Play
Console reads directly. Everything below is drafted from this repo's
actual, verified state (permissions, network calls, architecture) — copy
what's needed into the Console by hand when a Play Console account exists.
See CLAUDE.md's own "Known issues" / backlog history for how this fits
into the rest of the pre-release work; this doc exists so a future
session (or the owner directly) doesn't have to re-derive it from
scratch.

**What this session could and couldn't do without a real Play Console
account**: could produce — a real, hosted privacy policy page (see
below), real screenshots taken from the actual running app, and accurate
draft content for every text field the Console asks for. Could NOT do —
actually create the listing, answer the Data Safety questionnaire's
interactive form, run the Content Rating (IARC) questionnaire (it's an
external, session-based flow Google hosts, not just text entry), set up
a signing key / app bundle upload, or verify any of this against a real
device. Those need the owner's own Play Console login.

## Privacy policy — done, real, hosted

`public/privacy-policy.html`, deployed automatically by the existing
`web-alpha.yml` workflow alongside the PWA build. Once this lands on
`main` and that workflow runs, it's live at:

```
https://drwho2001.github.io/SHOS-V2/privacy-policy.html
```

This is a genuine, publicly reachable URL — exactly what Play Console's
"Privacy policy" field requires, not a placeholder. Content was drafted
directly from this app's actual architecture (verified, not assumed):
no backend, no accounts, encrypted local storage, the two specific
optional network calls (Nominatim address lookup, GitHub update check),
and every permission actually declared in `AndroidManifest.xml`.

## Screenshots — 5 real captures, ready to use

Taken via Playwright against a real `vite preview` production build, at
1080×1919 (9:16, a standard Play Store phone screenshot size), using the
app's own public seed/demo data — never the owner's real data, per this
repo's own personal-alpha/public-alpha split. Sent to the user this
session; also worth regenerating any time the UI changes meaningfully
before an actual submission, since Play Console screenshots should
reflect the current build. Play requires a minimum of 2 phone
screenshots (up to 8); these 5 (Home, Contacts, Encounters, Medication,
Healthcare) cover the app's real breadth.

Not yet produced, and lower priority (optional in Console, not
required to publish): a feature graphic (1024×500) and tablet/7"/10"
screenshots — this app isn't tablet-optimized, so tablet screenshots
would just show phone-width content on a larger canvas, honestly not
worth producing until/unless a tablet layout exists.

## Store listing text (draft)

**App name**: SHOS (matches the installed app's own `app_name` string).

**Short description** (≤80 chars):
```
Private, on-device sexual health & lifestyle tracker. No accounts, no cloud.
```

**Full description** (draft — adjust tone/length to taste, ≤4000 chars):
```
SHOS is a personal sexual health and lifestyle tracker built for one
thing: giving you a real, useful record of your own sexual health,
without handing your data to anyone else.

There's no account to create, no server, and no cloud sync — every
record you enter is stored, encrypted, only on your own device. Nothing
you log is ever sent anywhere, because there's nowhere for it to go.

Track what matters to you:
• Contacts and encounters — who, when, what, with real context, not just a name
• STI testing, results, and clinic visits, with retest reminders
• PrEP, DoxyPEP, and any other medication — dose logging, adherence, refill tracking
• Symptoms, vaccinations, and general measurements over time
• Contraception, menstrual health, and pregnancy tracking (optional, toggle-able)

Built with real privacy protections, not just a promise:
• AES-256-GCM encryption at rest for everything stored on your device
• Optional App Lock (PIN or biometric) with a duress PIN and an
  "Anonymise mode" that hides identifying details at a glance
• You control every export — nothing leaves your device unless you
  choose to share a backup yourself

SHOS is UK-focused and LGBT-inclusive by design — built from a real
gay/kink-community context (Kink Registry, DoxyPEP/PrEP tracking, BASHH/
UK guidance), with trans-inclusive fields (pronouns, contraception,
menstrual and pregnancy tracking) as first-class options for anyone who
needs them, not an afterthought.

This is a personal tracker, not a clinical record system or a diagnosis
tool — it won't score your risk or tell you what to do. It's just a
clear, private, judgement-free place to keep track of your own sexual
health, on your own terms.
```

**Category**: Medical or Health & Fitness (owner's call — Medical fits
the testing/medication tracking; Health & Fitness fits the broader
lifestyle framing. Either is defensible; Play doesn't allow "both.")

## Data Safety section — draft answers

This is Play's own structured questionnaire (Console UI, not free text) —
answers below reflect what's actually true of this app's real data flow,
checked against the code, not guessed:

- **Does your app collect or share any of the required user data
  types?** The honestly correct answer is **"No data collected"** for
  data the *developer* receives — nothing is ever transmitted to any
  server the developer operates or controls, and there's no analytics/
  ads SDK anywhere in the app (confirmed via `package.json` — the only
  third-party runtime dependencies are Capacitor plugins for on-device
  hardware access, e.g. biometrics/notifications/calendar/filesystem,
  none of which send data off-device).
- **The one genuine gray area, flagged honestly rather than glossed
  over** — and larger than it might first look, checked directly
  against `src/storage/locationService.js` rather than assumed from
  the feature's name: the optional address-lookup feature has two
  real modes. Typing in the address-search field sends that typed text
  to OpenStreetMap's public Nominatim API (a third party, not the
  developer). The "use current location" button is a real step up in
  sensitivity — it sends the device's actual GPS coordinates
  (`reverseGeocode(latitude, longitude)`) to that same Nominatim
  endpoint, not just typed text — the file's own header comment
  states this plainly as a genuine privacy trade-off, not something
  found only while writing this doc. Whether Play's own definitions
  count either as "data shared with a third party" (even though the
  developer never sees or stores it, and both are off by default /
  user-initiated / individually toggle-able in Settings > Data &
  network) is a real judgment call under Play's specific category
  definitions — the safer, more conservative answer is to declare
  **Location — Approximate or precise location — collected: No,
  shared: Yes (with the third-party service, only when the user
  actively taps "use current location" or searches, never stored)**
  rather than claim "no data at all" and risk a policy mismatch. The
  GitHub update-check call sends no personal data (a generic,
  anonymous release-metadata request), so it doesn't need a data-type
  declaration at all.
- **Is all user data encrypted in transit?** Yes for the two outbound
  calls above (both plain HTTPS).
- **Do you provide a way for users to request data deletion?** Not
  applicable in the usual sense — there's no server-side copy to
  delete. The honest framing for Play's own "data deletion" question:
  select **"You don't need to submit a deletion request because your
  app doesn't store user data outside of the user's device"** if that
  exact option is available in the current Console version, else
  explain the same thing in the free-text field Play provides for it.
- **Security practices**: Yes — data is encrypted at rest (real, not
  claimed — see this repo's own Phase 4 encryption work in CLAUDE.md),
  and users can request deletion via uninstall / in-app data clearing
  (true and immediate, since nothing is stored elsewhere).

## Content rating — flagged, not resolved

This needs the IARC questionnaire inside Play Console itself (an
external, interactive flow — not something fillable from outside the
Console), so this is guidance for whoever runs it, not a completed
answer. Honest assessment: this app lets users log their own sexual
activity, kink practices, and recreational drug use as **private,
user-entered data never displayed to or by anyone else** — it does not
itself display or publish sexual content, pornography, or drug
promotion (the app has no public feed, no shared content, no way for
one user's entries to reach another person). That's a meaningfully
different case from an app that *hosts or serves* mature content, but
Play's IARC questionnaire asks about themes the app supports/enables,
not just what it displays by default — expect this to land at a mature
content rating (likely 17+/Mature in the US scheme, 18 in IARC's
generic scale) given the health/sexual-activity/substance-tracking
subject matter, similar to how period-tracking or harm-reduction apps
are commonly rated. Answer the questionnaire honestly rather than
under-declaring to chase a lower rating — a mismatch discovered later
risks a takedown, which is a far worse outcome than a correct Mature
rating from day one.

## Other Play Console requirements not yet addressed

- **Signing / app bundle**: the existing `build-apk.yml` produces a
  debug APK for the GitHub Release, not a signed release AAB — Play
  Console requires a signed Android App Bundle (`.aab`), which needs a
  real signing keystore (ideally Play App Signing) the owner controls.
  Not something this session can generate safely — a signing key is a
  genuine secret, and generating one inside this sandboxed environment
  would mean the private key touches infrastructure it shouldn't.
  Recommended: the owner generates and stores this key themselves,
  following Android's own `bundletool`/Play Console-guided flow.
- **Target API level**: already fine — `targetSdkVersion 36`
  (`android/variables.gradle`), ahead of Play's current minimum
  requirement.
- **Data safety / permissions declared match reality**: cross-checked
  above against the real `AndroidManifest.xml` — no undeclared
  permission, no declared-but-unused one found.
- **Real-device testing**: still genuinely not possible from this
  sandboxed environment (no physical device or emulator with Play
  Services access) — remains a real, separate backlog item, not folded
  into this one.
- **Closed testing track**: Play now requires a period of closed
  testing with a minimum tester count before a new app can go to
  production — a real process step, not a content gap, and entirely
  the owner's own to run once a Play Console account/listing exists.
