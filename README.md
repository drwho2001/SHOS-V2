# SHOS — Sexual Health Operating System

A personal sexual health + lifestyle tracker for one user. Not an EHR,
not a clinical record system, no clinical advice. On-device only — no
backend, no cloud sync, no accounts. Ships as an Android APK
(Capacitor) and a web/PWA build.

See [`CLAUDE.md`](./CLAUDE.md) for architecture rules, current known
issues, and where things live — kept current, unlike this file's old
version was.

## Running locally

```
npm install
npm run dev
```

## Structure

- `src/App.jsx` — app shell: routing, global state, notification
  banners, App Lock/decoy mode. Feature screens live in `src/modules/`,
  not here.
- `src/main.jsx` — Vite/React entry point.
- `src/modules/` — one file per feature area (`SHOS_<Feature>_Prototype.jsx`):
  Contacts, Encounters, Medication Dashboard, Healthcare (Testing,
  Clinic Visits, Menstrual & Contraception & Pregnancy, Symptoms,
  Vaccinations), Home, Settings, Global Search, My Profile, Clinic
  Card, Attachments, Episodes (Timeline), Partner Notification,
  Registry Management, Option List Editor.
- `src/repositories/` — data layer (`getAll`/`getById`/`create`/`update`),
  localStorage-backed via `src/storage/storageAdapter.js`.
- `src/registries/` — small shared vocabularies (Kinks, Chems,
  Protection, Symptoms, Organisms, Results).
- `src/calculations/` — pure derived-data functions and the
  `*ReminderSync.js` notification-scheduling glue.
- `src/storage/` — cross-cutting platform services: backup/export,
  notifications, biometric auth, location, calendar sync, update
  checks.
- `android/` — the Capacitor native Android project.

## Building the Android APK

Handled by `.github/workflows/build-apk.yml` on every push to `main` —
publishes a debug APK to a public GitHub Release tagged `latest`. To
build locally: `npm run build && npx cap sync android && cd android &&
./gradlew assembleDebug`.
