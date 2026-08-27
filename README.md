# SHOS — Sexual Health Operating System

Personal health life-events recorder and wellness tracker. Not an EHR.

## Running locally / in StackBlitz

```
npm install
npm run dev
```

Or drag this whole folder into a new project at stackblitz.com — it's a
standard Vite + React project, so StackBlitz should recognize and run it
without any manual configuration.

## Structure

- `src/App.jsx` — module switcher (placeholder nav for testing; Doc 1's
  bottom nav bar is the real target design)
- `src/main.jsx` — Vite/React entry point
- `src/modules/` — the four screens: Contacts, Medication, Encounters
  (Activity), My Profile
- `src/repositories/` — data layer (getAll/getById/create/update, all
  localStorage-backed via `storage/storageAdapter.js`)
- `src/registries/` — small shared vocabularies (Kinks, Chems,
  Protection, Symptoms)
- `src/calculations/` — pure derived-data functions used by the modules
- `src/storage/` — the storage adapter, backup/restore, and the
  My Profile share/import mechanism

## Not included here

The `*_PREVIEW.jsx` bundles (single-file, memory-only versions used
only inside Claude's own chat preview panel) are deliberately NOT part
of this real project — they'd be dead weight here since this project
already has real localStorage persistence. They still exist in Project
Knowledge as reference/preview artifacts only.
