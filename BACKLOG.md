# Backlog

Deferred requests, captured so they are not lost. Not started unless noted.

## 1. Render comparison: encounter pre-test segment treatment
Requested: a single render comparison of four options for the pre-test segment —
solid green, green hatch, pink hatch, grey hatch — to decide whether to encode
the pre/post split by colour or by texture, without mixing colours.

Deliverable: one HTML page rendering all four side by side, mobile + web, dark +
light, with the same ring geometry as Home.

## 2. Navigation bar icons in module colours
Requested: the four bottom-nav icons (Contacts, Encounters, Healthcare,
Medications) should use their module key-colour instead of plain white while
unselected. When that module is selected, the icon goes white on a module-colour
box. The label text stays white.

Notes:
- Module colours must come from the existing module-colour keycoding rules, not
  hardcoded hexes.
- Selected state becomes white icon on a filled module-colour pill/box.
- Applies wherever the main nav renders (mobile + web).

## 3. Encounter ring: verify and document the corrected pre/post logic
Done in `a9cb831` / deployed `01ecc67`: pre = encounters still inside the
priority window periods (HIV 45d unless PrEP adequate, gonorrhoea/chlamydia 14d
unless DoxyPEP taken), post = encounters on/after the last test by date.
The hardcoded 40/13 demo fallback was removed.

Residual: decide whether the ring should also expose the "cleared" encounters
(older than every priority window) somewhere, since the ring no longer sums to
the total encounter count.
