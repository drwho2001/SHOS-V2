# Healthcare Tabs Component — Design Manual

## Anatomy

Healthcare tabs follow the same tabbed interface pattern as **Encounters** and **Contacts**, but use the healthcare accent (`#09582E` / `#0E8144`) and healthcare-specific data.

### Tab List (`<div class="tab-list">`)

- Horizontal flex row of `.tab-btn` elements
- One `.tab-btn.active` designates the currently visible panel
- Each tab has a `.tab-icon` (emoji or icon) and `.tab-text` label
- Gap: `8px` between tabs

### Tab Panel (`<div class="tab-content.active">`)

Only one panel is visible at a time (`.tab-content` has `display: none`; the active one has `display: block`).

Each panel contains a **single Healthcare Card** (see `healthcare-card-mockup.html` for full anatomy):

1. **Name line**: `.dot` + `.name` (8px dot; green for normal, red for overdue/positive)
2. **Byline**: Single line carrying quantity + timing — e.g.:
   - `C&S (symptomatic/treatment) · Oct 28 · 4:00 PM`
   - `2 doses total · Sep 2025 · Sep 2025`
   - `Treatment follow-up · Now · 4:00 PM`
3. **Chip group**: Small status chips using the healthcare accent (`#09582E`)
4. **Actions**: Two buttons — `.btn.filled` (primary, healthcare-accented) and `.btn.outline` (secondary)

### Stripe/Row Order (per tab panel)

```
[Name line with dot + title]
[Byline: quantity + timing]
[Advisory note block (optional)]
[Chip group: status / urgency / diagnostic info]
[Footer: last/next visit/due dates]
[Actions: two-button row (filled + outline)]
```

### Tab Styling Reference

| Element | Dark mode style |
|---|---|
| `.tab-btn` background | `var(--surface)` — dark card background |
| `.tab-btn:hover` | `var(--variant)` — slightly lighter |
| `.tab-btn.active` | `var(--healthcare-accent)` with white text |
| Chip `.chip.healthcare` | Tint `#09582E15` border only — no fill in dark mode |
| Chip `.chip.red` | `background: #ff7a7e15` |
| Chip `.chip.green` | `background: #5fd9a440` |
| Button `.btn.filled` | `background: #F59E0B12`, border `#F59E0B66` |
| Button `.btn.outline` | `background: transparent`, border `#F59E0B` |

### Tab Panel per Subject

| Tab key | Default view | Notes |
|---|---|---|
| `sti-test` | Completed STI test (green result, amber urgency) | Primary/main tab — analogous to "Encounters overview" first tab |
| `vaccination` | Overdue vaccination (red alert) | Secondary tab |
| `clinic-visit` | Ongoing clinic visit (healthcare accent) | Tertiary tab |

> **Design decision**: The **STI Test** tab is the primary/default, matching the encounters prototype where the overview tab is first. Users can swipe/click to the other tabs (Vaccination, Clinic Visit) to view different record types. Each tab shows one card at a time, consistent with the modular card approach.

### Global Scope Note

The frequency/usage sort applies **globally** — kinks from encounters + contacts + profile, chems from encounters + contacts + profile, protection from encounters, symptoms from encounters + symptom log + clinic visits, organism from testing. Ties fall back to A–Z. Counts are shown as a small muted number on suggestion chips.