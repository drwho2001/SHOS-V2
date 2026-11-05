# Backlog

Deferred requests, captured so they are not lost. Not started unless noted.

## 1. Render comparison: encounter pre-test segment treatment — DECIDED
Requested: a single render comparison of four options for the pre-test segment —
solid green, green hatch, pink hatch, grey hatch — to decide whether to encode
the pre/post split by colour or by texture, without mixing colours.

Rendered and reviewed (hatch, double-hatch/crosshatch, polka dot, dotted line,
stipple; mobile + web; dark + light). **Decision: keep solid green. No texture.**
The ring's 6px mobile stroke cannot hold a readable pattern, and texture read as
noise rather than a category cue. Nothing to build here.

## 2. Navigation bar icons in module colours — DONE
Requested: the four bottom-nav icons (Contacts, Encounters, Healthcare,
Medications) should use their module key-colour instead of plain white while
unselected. When that module is selected, the icon goes white on a module-colour
box. The label text stays white.

Notes:
- Module colours must come from the existing module-colour keycoding rules, not
  hardcoded hexes.
- Selected state becomes white icon on a filled module-colour pill/box.
- Applies wherever the main nav renders (mobile + web).

Shipped in `7df19e8`: unselected icons read `resolveTabAccent(tab, darkMode)`;
active tab still fills the pill with that colour and turns the icon white. Home
keeps its raised circle. Contrast measured against both surfaces — all four
accents clear 3:1 (Contacts 4.50/3.78 light/dark, Encounters 7.30/5.60,
Medication 11.32/4.95, Healthcare 8.58/3.43). Verified rendering in the web
build. Verified on-device too: installed `SHOS.apk`, confirmed all four icons
render in their module colours and the active tab shows a white icon on the
module-colour pill.

## 3. Encounter ring: verify and document the corrected pre/post logic
Done in `a9cb831` / deployed `01ecc67`: pre = encounters still inside the
priority window periods (HIV 45d unless PrEP adequate, gonorrhoea/chlamydia 14d
unless DoxyPEP taken), post = encounters on/after the last test by date.
The hardcoded 40/13 demo fallback was removed.

Residual: whether the ring should also expose the "cleared" encounters (older
than every priority window) somewhere. **Decided: no.** A cleared encounter is a
history fact, not a current decision — it cannot change behaviour today. Showing
it would be visual noise and would blur the ring's meaning from "needs attention"
to "all history". The ring intentionally does not sum to the total encounter
count; cleared detail already lives in Timeline per encounter.
