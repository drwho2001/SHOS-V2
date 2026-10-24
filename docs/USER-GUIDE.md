# SHOS — User and Developer Guide

SHOS (Sexual Health Operating System) is a **personal sexual-health and lifestyle tracker for one person on one device**. It is not an electronic health record, not a clinical record system, and it does not diagnose, prescribe, or give clinical advice. Everything is stored on the device: there is no backend, no cloud sync, and no account.

Version: `0.2.0` (see `package.json`). Ships as an Android APK (Capacitor) and a web/PWA build.

> Medical disclaimer: SHOS is an organisational aid only. Exposure-window flags, retest suggestions, cycle predictions, and reminders are informational and are never automated actions. Always follow advice from a clinician or sexual-health service.

## 1. Quick start

### Run locally (web/PWA)

```powershell
npm install
npm run dev
```

Open the Vite URL in a browser. Data is created in that browser profile only.

### Build

```powershell
npm run build
npm run preview
```

### Android APK

CI builds a debug APK on every push to `main` (`.github/workflows/build-apk.yml`) and publishes it to the `latest` release. Local build:

```powershell
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Native/Java changes can only be confirmed by a green CI `build-apk` run.

### First launch

1. Onboarding slides appear once (`hasCompletedOnboarding` is false). You can skip or complete.
2. One real question is asked: enable **Menstrual & contraception tracking**. This is opt-in regardless of gender.
3. Completion may offer the interactive tour. The tour is replayable from Settings → Content & Lists → Guide.
4. Home is the centre tab; Settings is reached via the gear icon on Home.

## 2. Navigation

Bottom tabs: **Contacts**, **Encounter**, **Home** (centre), **Medication**, **Healthcare**.

- **Home** is the dashboard: recent activity, quick-add buttons, due banners, and three shortcuts: **Clinic Card**, **Episodes**, **Calendar**.
- **Clinic Card** is a read-only summary you can show a clinician.
- **Episodes** groups related encounters and tests (for example, "this test relates to these encounters").
- **My Profile** is not a tab. Reach it via the profile icon next to the gear on Home, or from Settings.
- **Global Search** searches across modules.

Settings groups (gear icon on Home):

- **Backup & Data** — export/restore.
- **Security & Privacy** — App Lock, PIN, anonymise mode, network calls, widgets.
- **General** — Preferences, Notifications.
- **Appearance** — colour scheme.
- **Content & Lists** — Manage lists, Resources, Glossary, Guide.
- **Insights** — Stats, Calendar, Trash.
- **Support** — Developer tools, About.

## 3. Feature reference

### Contacts

Manage contacts, favourites, relationship/role axes, and contact settings. Enter once, reuse everywhere: a contact is referenced by other records rather than duplicated.

### Encounters (Activity)

Log encounters with protection context. DoxyPEP status is **derived after the event** (a dose within 72 hours), so it is not a field you answer on the form; PrEP coverage is a before-the-event fact and is stored on the encounter. Attachments can be linked.

### Medication

Medication dashboard: add medications, log doses/refills/waste, view adherence, and schedule reminders. Most numbers (adherence %, active/inactive, most recent test) are calculated live from logged events, not typed.

### Healthcare

Healthcare is a tab host for peer modules:

- Testing
- Clinic Visits
- Symptom Log
- Vaccinations
- Measurements
- Menstrual / Contraception / Pregnancy (toggle-gated, off by default)

Also includes Clinic Card, Attachments, Timeline/Episodes, and Partner Notification.

### Menstrual, contraception and pregnancy tracking

Off by default and not its own tab. Turn it on: Settings → General → Preferences → "Menstrual & contraception tracking." Opt-in regardless of gender; nothing assumes who wants it.

Predictions are **estimates, not diagnoses**. The cycle widget shows "est." next to predicted dates. Phase boundaries are fixed (Menstrual 1–7, Follicular 8–14, Ovulatory 15–21, Luteal 22+) as a rough guide and are not personalised to cycle length (personalising would be ovulation prediction, which this app does not make). Irregularity (cycle lengths varying by more than 2 weeks) and menopause (no period in 12+ months) are shown as informational messages with NHS/RCOG links, never as automated actions.

### Attachments, Clinic Card, Partner Notification, Timeline

- Attachments: files/photos linked to records.
- Clinic Card: shareable read-only summary.
- Partner Notification: checklists for partner notification.
- Timeline/Episodes: groups related encounters and tests.

### Registries and option lists

Registries define shared vocabularies (Kinks, Chems, Organisms, Results, Protection, Symptoms). Option lists are editable. Contacts, Locations, and Medications are repositories, not registries.

## 4. Data, storage, and backup

### Storage model

- App data: `localStorage`, via `src/storage/storageAdapter.js`, encrypted at rest by `src/storage/cryptoService.js`.
- At-rest encryption is **always on**, even before App Lock is configured (Data Key envelope).
- Widgets use Android `EncryptedSharedPreferences` so a widget can read from a cold-started process.
- Defensive-default merge on read: adding a field later does not break saved records.
- Archive before hard delete: outdated items are archived (`isArchived`), recoverable in Trash. A real delete-with-confirmation exists per module for genuine mistakes.
- Undo is single-step and per-module only.
- Demo data: seed records carry `isDemo: true`; real records get `isDemo: false`. `isDemoData()` checks `isDemo` first, then falls back to snapshot comparison for legacy records.

### Backup and restore

`src/storage/backupService.js` produces a versioned JSON snapshot of repositories, registries, and settings.

- Export plain or password-protected encrypted (AES-256-GCM, PBKDF2).
- Selective export by group and date range.
- Restore modes: replace all, or merge.
- Auto-export to a Documents folder on an interval (Android SAF folder reference).
- Backup reminder: 90 days plus unbacked changes.
- Plain exports strip PIN, duress PIN, and App Lock flags; encrypted exports retain secrets.

### Trash and recovery

Deleted items usually archive first and appear in Trash (Insights). Recovery is available there; permanent delete is explicit.

## 5. Privacy and security

### Layers (each does a different job)

1. **At-rest encryption**: always on, even with no App Lock.
2. **App Lock** (Settings → Security & Privacy → Privacy): optional PIN or biometric gate so someone holding your unlocked phone cannot open the app. Off by default.
3. **Duress PIN**: if set, opens a decoy version of the app with fake data instead of real records.
4. **Anonymise mode**: hides identifying details across notification surfaces; useful if someone may glance at your screen.
5. **Widget tier**: per-widget `full` / `redacted` / `off`, set in Settings → Widgets. Redacted uses a default-deny allowlist (`ALLOWED_AT_REDACTED`); fields not listed are dropped and render as `GONE`, not blank.
6. **Screen security**: Android `FLAG_SECURE` by default; screenshot toggle can opt out.
7. **Network calls**: only optional calls are documented under Data & network (address lookup via Nominatim, update checks via GitHub). Nothing else leaves the device.

### Disclosure level vs widget tier

These are deliberately separate and must not be merged:

- **Disclosure level** (`detailed` / `glanceable` / `masked`) controls the *text* of notifications on surfaces outside the app. It reaches notifications only.
- **Widget tier** (`full` / `redacted` / `off`) controls what a home-screen widget stores and renders.

Privacy settings are stripped from plain export files.

### App Lock note

App Lock PINs are verified against a PBKDF2 verifier (100k iterations, own salt), not stored as plaintext. Because the secret is not stored, privileged actions (turning App Lock on/off, enabling biometrics, setting recovery string, changing PIN) ask you to type the PIN again. The App Lock grace window and biometric unlock mean the app can be open without a recent PIN entry.

## 6. Notifications and reminders

- Due banners cover medications, testing, vaccinations, and clinic visits.
- Disclosure level controls notification text.
- Android OEM battery optimisation can kill background alarms; if reminders are missed, exempt SHOS from battery optimisation in OS settings.
- The app requests persistent storage (`navigator.storage.persist()`) on web to reduce eviction risk.

## 7. Home-screen widgets

- Per-widget tier: `full`, `redacted`, or `off`.
- Adding a field to a widget is a privacy decision: it survives Redacted only if explicitly allowlisted.
- Widget text fitting measures the real string against the widget's real width and steps down a whole-sp ladder (floor 12sp); `maxLines` controls wrapping.
- Resize handling: data providers extend `ResizingWidgetProvider` so a manual resize re-renders; Quick Add widgets do not resize-dependently.
- Known device behaviour: widgets may initially land at a narrow width (around 109dp on some launchers) and require manual resize; text fitting logs launcher-reported bounds for diagnosis. Do not assume a wider ceiling is a fix.

## 8. Calendar

The app has two calendar views (in-app Calendar screen and the phone's real calendar). Shared facts are derived once in `src/calculations/plannedCalendarEvents.js`. Phone-calendar sync uses marker families:

- `[shos:<id>]` appointments
- `[shosvax:<id>:<doseKey>]` vaccination doses
- `[shosplan:<kind>:<key>]` planned events

Each family has its own opt-in and cleanup. Turning a family off removes events the app placed.

## 9. Clinical and health content rules (app behaviour)

- No diagnosis engine and no automated clinical risk scoring.
- Exposure-window flagging and retest-date suggestions are informational only.
- DoxyPEP window is anchored to the **first** qualifying activity (BASHH "cover a period of activity with one dose at the end").
- Menstrual predictions are estimates with fixed phase boundaries; not ovulation prediction.

## 10. Settings reference

See section 2. Settings screens live in `src/modules/settings/` (About, Automatic Backups, Backup & Export, Calendar, Clinical Evidence, Data & Network, Design, Developer Tools, Error Log, Glossary, Guide, Manage Lists, Notification History, Notifications, Preferences, Privacy, Resources, Stats, Trash, Widgets).

## 11. FAQ

**Does it sync between devices?** No. Single owner, single device by design. Use backup/restore to move data.

**Is my data encrypted?** Yes, at rest, always. App Lock adds a gate in front of the key; it is not what makes data encrypted.

**What if I forget my PIN?** App Lock uses a verifier, not stored plaintext. Recovery depends on your configured recovery string/biometric; without it, data is inaccessible. Export backups regularly.

**Can I recover deleted records?** Usually yes via Trash (archive-first). Permanent delete is explicit.

**What is demo data?** Seed records are flagged `isDemo: true`; real records are `isDemo: false`. Demo separation is supported.

**Why can't I find menstrual tracking?** It is off by default and lives inside Healthcare's sub-nav. Enable it in Settings → General → Preferences.

**Why does a widget look empty or redacted?** Redacted tier drops non-allowlisted fields and renders them as `GONE`. Check Settings → Widgets.

**Why did a widget not update after I resized it?** Only providers extending `ResizingWidgetProvider` re-render on resize; Quick Add widgets are static.

**Why are notifications vague?** Disclosure level may be set to glanceable/masked. Change in Privacy settings.

**Are predictions diagnoses?** No. They are estimates/informational.

**Does it give clinical advice?** No. Follow your clinician or sexual-health service.

**What network calls does it make?** Only optional ones documented in Data & network (address lookup, update checks).

**Can I lose data?** Yes if the device is lost or browser storage is evicted and you have no backup. There is no backend recovery. Export regularly; consider auto-export.

**Web vs Android data?** They are separate profiles. Move data via backup export/import.

## 12. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Widget shows blank fields | Empty value beats default; redacted tier; bridge field mismatch | Check widget tier; re-push data; verify field names both sides |
| Widget text truncated | Narrow placement width; wrong `maxLines`/`maxSp`; orientation | Manually resize widget; check logs for chosen sp and width |
| Widget "Can't load widget" | `autoSizeMaxTextSize <= autoSizeMinTextSize` at inflate (API 27+) | Review autosize attributes; fall back to `WidgetTextFit` |
| Notifications missing/vague | Disclosure level; OS permissions; battery optimisation | Set disclosure to detailed; grant notification permission; exempt from battery saver |
| Reminders not firing on Android | OEM battery saver killing alarms | Exempt SHOS from battery optimisation |
| Data disappeared in browser | Storage eviction/7-day caps | Use Android app or enable persistent storage; restore from backup |
| Restore fails | Password mismatch; version mismatch | Re-enter password; use matching backup version |
| App Lock won't disable | PIN required as key material | Enter current PIN in prompt |
| Duress PIN opens wrong data | Working as designed | Duress PIN intentionally opens decoy |
| Menstrual tracking hidden | Toggle off by default | Enable in Preferences |
| Build fails locally | Memory starvation; docs gate; encoding | Run `verify:fast`; check free RAM; ensure docs updated with src changes |
| Mojibake in source | PowerShell 5.1 encoding | Use editor/Node scripts, not `Get-Content`/`Set-Content` |
| Smoke tests flaky | Memory starvation; timing waits | Run on CI; use bounded waits on state |
| Native compile unverified | Local gradle not authoritative | Check CI `build-apk` |

## 13. Predicted teething problems

### User-facing

- First-run confusion: menstrual tracking is off by default and nested in Healthcare.
- Widget placement may start narrow and truncate until manually resized.
- Redacted tier hides fields completely (`GONE`), which can look like missing data.
- App Lock privileged actions re-prompt for PIN, which may surprise users expecting grace.
- No cloud sync; device loss means data loss without backups.
- Browser storage eviction on web/PWA.
- OEM battery optimisation may break reminders.
- Date/time display relies on fake-UTC storage convention; users changing time zones should verify.

### Developer-facing

- Two AI sessions share one checkout; never `git add -A`; stage immediately before commit.
- Docs gate: any `src/` change requires `CLAUDE.md` or `docs/` change.
- Pre-commit hook blocks mojibake.
- PowerShell 5.1 is not UTF-8; use editor/Node for file writes.
- Full local gate is heavy (~15 min unit suite); prefer `verify:fast` locally, CI for full.
- Memory starvation can OOM Vitest; kill orphan node processes.
- Native/Java changes require CI confirmation.
- Bridge fields must be renamed on both JS and Java sides; type mismatches (epoch ms vs Date) fail silently in try/catch.
- RemoteViews updates do not reset; every branch must restate properties.
- Launcher resize events require provider handling.
- Hand-maintained inventories go stale; prefer commands/tests with exact counts.
- Guard regexes can span statement boundaries and misreport; use balanced scans.
- Test timeouts must be the third argument to `it()` to be effective.

## 14. Known limitations / out of scope

Permanently out of scope: multi-user collaboration, full EHR functionality, NHS interoperability, diagnosis engine, automated clinical risk scoring. Exposure-window flagging and retest suggestions are informational only. No multi-device sync.

## 15. Developer appendix

### Scripts

- `npm run dev`, `build`, `preview`
- `npm run lint`, `npm run typecheck`
- `npm run test`, `test:watch`, `test:coverage`, `test:ui`
- `npm run check:encoding`
- `npm run verify`, `verify:fast`, `verify:smoke`, `verify:docs`

### Gate

`npm run verify` = build → lint → unit tests → encoding → inherited-instructions → smoke suite → docs check. CI runs the same file.

### Other references

- `CLAUDE.md` — architecture rules and current truth.
- `docs/HISTORY.md` — shipped history.
- `docs/DEVICE-TESTING.md` — hardware-only checks.
- `docs/MODELS.md` — usable models and privacy notes.
- `docs/CHANGE-PROCEDURE.md` — commit/push algorithm.
- Session bus: `node scripts/session-bridge.mjs pool list` for current work items (this repo states no work items in CLAUDE.md by rule).
- Model consultation: `node scripts/consult.mjs gemini "..." --task=<slug>`.
- Second-opinion protocol: `node scripts/session-bridge.mjs stuck <slug> "..."`.

### Encoding reminder

Never use PowerShell `Get-Content`/`Set-Content` for source. Use the editor or Node `fs.readFileSync`/`writeFileSync`. Commit messages with backticks are dangerous in PowerShell double-quoted strings.
