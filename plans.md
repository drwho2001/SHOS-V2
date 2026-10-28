# Plan log

Durable record of settled plans, for quick rereference.
Appended whenever a plan is settled. Times UTC. Outside repository on purpose.

---
## Retroactive transcription (last 7 days)

### 2026-10-23T23:05:09Z — ses_e94fd2e00ffeQi1as7qmb1AsSn — Shos onboarding guide and troubleshooting
Create docs/USER-GUIDE.md covering user and developer audiences, quick start, feature reference, privacy/security, widgets, backup/restore, FAQ, troubleshooting, and predicted teething issues. No src changes.

### 2026-10-25T14:14:54Z — ses_e8c95ecbeffeJwVhNFs72LhiM0 — Delegate session backlog tasks
Implement contactMerge duplicateCandidatePanel, run targeted tests and lint, update docs/NEXT-SESSION.md, commit only own files, and log session-bus progress.

### 2026-10-25T14:14:54Z — ses_e8c95ec87fferboSBN50qWRN7q — DELEGATE session handover task planning
Complete DELEGATE work: 32-flow smoke suite, i18n interpolation, auth repair, contactMerge, and device update; remaining work includes accessibility, broader i18n, flow 21 fix, and widget refinements.

### 2026-10-26T20:00:41Z — ses_e8632fb47ffeWUnDnah90AJNzQ — Finish remaining backlog
Backlog split into owner decisions, native/device tasks, code tasks, and pool tasks; proposed batched commits, with remaining low/deferred items and no-device-needed work identified.

### 2026-10-27T01:04:48Z — ses_e851c8e29ffeFXNKgQWsV0DVrA — Session history and microstepping workflow review
Link work-style instructions into OpenCode config, avoid repeated go/continue pauses, and finish one module per fresh session instead of accumulating huge context.

### 2026-10-27T01:14:55Z — ses_e85134c26ffeVehF1DiPCqiQ2J — End-to-end i18n extraction workflow
Fix timezone and vaccine smoke failures, then extract i18n across modules in separate commits; track CI status, smoke results, and pre-existing failures.

### 2026-10-27T19:58:38Z — ses_e810e814fffeR592kQe2BXk6DS — Zeus Audit areas planning for smoke tests
Run a multi-stage read-only audit and stress-test campaign covering core flows, privacy, accessibility, menstrual/contraception matrices, temporal correctness, and native/device checks.

### 2026-10-27T22:13:17Z — ses_e80933b4affenoiGyypWsJ6HmJ — Project progress report and AI workflow analysis
Reduce bloat, fix timezone smoke spiral, complete audits, harden profile sharing and privacy/accessibility, and finalize Live Session phased data-model plan.

### 2026-10-27T21:16:54Z — ses_e80c6d89fffe9J3ybv0jme7p24 — Lily Audit handover and security review
Completed profile sharing size cap, runtime validation, and dedup; pending allowlist single source, App Lock restore, notch consistency, and touch targets.

### 2026-10-28T03:29:04Z — ses_e7f721c81ffeQYnqDmH6JglCDY — Cheapest model for OpenCDE Go
Recommend DeepSeek V4.1 Flash default, GPT 6 Luna escalation, avoid GPT 5.6 Luna for routine use, and use DeepSeek V4 Pro or GPT 5.6 Luna for hard debugging.

### 2026-10-28T03:29:04Z — ses_e7f721c4fffePFZb9AyKADA1SA — Cheapest model for OpenCode Go
Choose DeepSeek V4.1 Flash as best cheap default, with GPT 6 Luna as quality alternative and GPT 5.6 Luna only for difficult tasks.

### 2026-10-28T03:29:04Z — ses_e7f721c20ffeFyrj0uapup0qdH — Cheapest model for OpenCode Go
Choose DeepSeek V4.1 Flash for maximum usage, with GPT 6 Luna for better proprietary-model consistency.

### 2026-10-28T03:29:07Z — ses_e7f721339ffenycZs3zvBSGwDT — Cheapest model selection in OpenCode Go
For 1M+ context, recommend DeepSeek V4.1 Flash default, GPT 6 Luna escalation, and stronger models only for hard reasoning.

### 2026-10-28T03:29:08Z — ses_e7f720f86ffemtnGax5D0efIke — Cheapest model for opencde go
For SHOS app dev on OpenCode Go with 1M+ context, recommend DeepSeek V4.1 Flash with GPT 6 Luna escalation.

### 2026-10-28T07:30:00Z - ses_e8072c060ffeH9QgsaWh6PX4Hv - Live Session stress test, refined plan, and audit documentation
Approved and documented the next Session work: one active Session, Session attendee list, per-activity quick log, role-specific fisting detail cards, canonical tally reconciliation, and hideable contact fisting profiles. Added manual audit entries and t197-t204.

### 2026-10-28T17:05:00Z - session B - Session attendees, fisting role cards, streak spacing
Settled: Session carries attendeeIds (set at Start Session from the encounter form, unioned with per-activity participants for the group count); fisting is one activity whose detail pack renders a Top card (hands, depth) and a Bottom card (fingers, depth, width) with new persisted fields topHands/topDepth/bottomFingers/bottomDepth/bottomWidth; legacy fingers/hands/depth/width stay for older records. Streak spacing root cause was minHeight:44 on the 11px AdherencePill info icon, fixed by padding:16 with margin:-16 so the tap target stays 44x44 without growing the row. Recorded as t206-t208.
