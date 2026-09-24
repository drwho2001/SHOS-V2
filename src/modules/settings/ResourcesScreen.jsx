// ResourcesScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft, PencilSimpleIcon as PencilSimple } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { BASHH_TESTING_SOURCE_URL } from "../../calculations/statsCalculations";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { ResourcesRepository, CATEGORY_LABELS as RESOURCE_CATEGORY_LABELS } from "../../repositories/resourcesRepository";

function resourceLinkHref(link) {
  const trimmed = link.trim();
  if (/^(https?:|tel:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) return `mailto:${trimmed}`;
  if (/^[+(]?[\d\s()-]{6,}$/.test(trimmed)) return `tel:${trimmed.replace(/[()\s-]/g, "")}`;
  return `https://${trimmed}`;
}

// CHANGED 11 Sep 2026 — real ask (a total-app audit): this row's own
// default tap opened an EDIT form, with "open the real link" only
// reachable as a small secondary snippet — backwards from this
// screen's actual intent (a curated list of pre-provided links to
// tap, not a self-edited list first and foremost; editing/adding is
// still fully supported, just not the primary gesture anymore). When
// a real link exists, tapping the row now opens it directly (a real
// `<a>` wrapping the row's own content, so it's a genuine navigation,
// not a JS-simulated one); editing moves to its own explicit pencil
// icon. A blank entry still opens straight to edit, since there's
// nothing to open yet. Also now shows an "Added by you" tag on
// entries created via the "+ Add your own" field below (isCustom,
// resourcesRepository.js's own addEntry()) so the curated list and a
// user's own additions are visually distinguishable at a glance.
function ResourceEntryRow({ entry, categoryKey, onChanged, darkMode }) {
  const T = darkMode ? DARK : NEUTRAL;
  const [expanded, setExpanded] = useState(false);
  const [link, setLink] = useState(entry.link);
  const [notes, setNotes] = useState(entry.notes);

  const save = async () => {
    await ResourcesRepository.updateEntry(categoryKey, entry.id, { link, notes });
    onChanged();
  };
  const remove = async () => {
    await ResourcesRepository.removeEntry(categoryKey, entry.id);
    onChanged();
  };

  const rowLabel = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{entry.name}</span>
        {entry.isCustom && (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: T.textDisabled, border: `1px solid ${T.border}`, borderRadius: 999, padding: "1px 6px" }}>Added by you</span>
        )}
      </div>
      {!expanded && entry.link && (
        <div style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 2, textDecoration: "underline" }}>{entry.link}</div>
      )}
      {!expanded && !entry.link && <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic", marginTop: 2 }}>No link saved yet — tap the pencil to add one</div>}
    </div>
  );

  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        {!expanded && entry.link ? (
          <a href={resourceLinkHref(entry.link)} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, textDecoration: "none", cursor: "pointer" }}>
            {rowLabel}
          </a>
        ) : (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setExpanded((e) => !e)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
            {rowLabel}
          </div>
        )}
        <PencilSimple
          size={16}
          color={T.textDisabled}
          style={{ cursor: "pointer", flexShrink: 0 }}
          onClick={() => setExpanded((e) => !e)}
          role="button"
          tabIndex={0}
          aria-label={`Edit ${entry.name}`}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } }}
        />
      </div>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link or phone number" aria-label="Resource link"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: 8 }} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} aria-label="Resource notes"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={remove} style={{ padding: "8px 14px", borderRadius: 999, border: `1px solid ${ACTION.red}`, background: "transparent", color: ACTION.red, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove</button>
            <button onClick={save} style={{ flex: 1, padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

// CHANGED 1 Sep 2026 — real ask: a search box, now that a real URL
// population pass took this from 5 near-empty categories to 11 with
// ~30 entries — too long a scroll to find one number by eye anymore.
// Filtering happens here per-category (matches name, link, or notes)
// rather than in ResourcesScreen, so each category keeps owning its
// own entries/refresh state exactly as before; a category with zero
// matches during an active search just doesn't render at all, rather
// than showing an empty card.
// ADDED 1 Sep 2026 — real ask: a genuine "no results" state for the
// Resources search, distinct from each individual category quietly
// not rendering. Mirrors ResourceCategory's own per-entry filter
// logic just to answer "did ANY category match" — kept a plain
// function, not a hook, since it only ever runs against the query
// string already in scope, nothing stateful.
async function hasAnyResourceMatch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  for (const key of ResourcesRepository.getAllCategoryKeys()) {
    const entries = await ResourcesRepository.getEntries(key);
    if (entries.some((e) => [e.name, e.link, e.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q)))) return true;
  }
  return false;
}

function ResourceCategory({ categoryKey, darkMode, query }) {
  const T = darkMode ? DARK : NEUTRAL;
  const [refreshKey, setRefreshKey] = useState(0);
  const [addingName, setAddingName] = useState("");
  // CHANGED 4 Sep 2026 — real groundwork for encryption at rest (see
  // CLAUDE.md's Known Issues / the Notion Development log for the
  // full plan): useLoadedMemo instead of a plain useMemo — same
  // shape/ergonomics, but loads via an effect instead of
  // synchronously, since storage.load() behind getEntries() is
  // slated to become async once real encryption lands. Second real
  // proof point for the shared hook (loadedRepositoryState.js),
  // exercising the deps-driven recompute path specifically —
  // clinicCardVisibilityPreference.js already proved the mount-once
  // path.
  const entries = useLoadedMemo(() => ResourcesRepository.getEntries(categoryKey), [categoryKey, refreshKey], []);
  const refresh = () => setRefreshKey((k) => k + 1);
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => [e.name, e.link, e.notes].filter(Boolean).some((v) => v.toLowerCase().includes(q))) : entries;

  const addEntry = async () => {
    if (!addingName.trim()) return;
    await ResourcesRepository.addEntry(categoryKey, { name: addingName });
    setAddingName("");
    refresh();
  };

  if (q && filtered.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 0 6px" }}>{RESOURCE_CATEGORY_LABELS[categoryKey]}</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>Nothing added yet.</div>
        ) : filtered.map((entry) => (
          <ResourceEntryRow key={entry.id} entry={entry} categoryKey={categoryKey} onChanged={refresh} darkMode={darkMode} />
        ))}
        {!q && (
          <div style={{ display: "flex", gap: 8, padding: 12 }}>
            <input value={addingName} onChange={(e) => setAddingName(e.target.value)} placeholder="+ Add your own"
              onKeyDown={(e) => { if (e.key === "Enter") addEntry(); }}
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
            <button onClick={addEntry} style={{ padding: "8px 14px", borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 1 Sep 2026 — the "clinical justifications used" part of the
// ask. NOT from ResourcesRepository — this is a fixed, read-only
// summary of the real guidance this app's own calculations are
// already built on (exposure windows, DoxyPEP timing, the 90-day
// testing-interval stat), pulled from those files' own citations
// rather than restated from memory. Only ONE clickable link — the
// exact BASHH source URL already stored and used elsewhere in this app
// (Stats screen) — no other link here is invented; guidance without an
// existing verified URL in this codebase is named, not linked.
function ClinicalJustificationsCategory({ darkMode }) {
  const T = darkMode ? DARK : NEUTRAL;
  const items = [
    { title: "STI retesting interval (90 days)", body: "BASHH's 2023 \"Summary Guidance on Testing for STIs\" recommends 3-monthly asymptomatic screening for higher-risk groups; matches CDC's own 3–6 month guidance for PrEP users.", link: BASHH_TESTING_SOURCE_URL },
    { title: "DoxyPEP dosing window", body: "BASHH's 2025 UK national guideline and CDC's 2024 clinical guidance — doxycycline taken within 72 hours after condomless oral, vaginal, or anal sex.", link: null },
    { title: "STI exposure windows", body: "Gathered from current UK sexual-health guidance (BASHH/BHIVA position statements) and NHS-affiliated sexual health services — used to flag when a test is too early to be reliable, not as a diagnosis.", link: null },
  ];
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 0 6px" }}>Clinical justifications used</div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: RADIUS.md, overflow: "hidden" }}>
        <div style={{ fontSize: 11, color: T.textSecondary, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          What this app's own calculations (exposure windows, DoxyPEP timing, testing-interval stats) are actually based on — informational, not personalised medical advice.
        </div>
        {items.map((item) => (
          <div key={item.title} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 3 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: T.textSecondary, lineHeight: 1.4 }}>{item.body}</div>
            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ACCENTS.healthcare, marginTop: 4, display: "inline-block" }}>{item.link}</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResourcesScreen({ onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  // ADDED — real audit finding (desktop full-width sweep): each
  // category (its own label + card) is a self-contained unit — grid
  // them Guide-style on desktop instead of one long single column.
  const isDesktopWidth = useIsDesktopWidth();
  const [query, setQuery] = useState("");
  // ADDED — real groundwork for encryption at rest: hasAnyResourceMatch()
  // is now async (see resourcesRepository.js's own comment), so this
  // can no longer be called straight in the render body below — a
  // Promise is always truthy, so `!hasAnyResourceMatch(query)` would
  // never show the "no results" state once it went async. Same reactivity
  // as before (only recomputes when `query` changes) via useLoadedMemo.
  const hasMatch = useLoadedMemo(() => hasAnyResourceMatch(query), [query], true);
  return (
    <div tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Resources</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 16, lineHeight: 1.4 }}>
          Real organisations, most with a real link already filled in. Anything still blank is worth adding yourself with a current, verified one rather than trusting a guess for something this important — and any link here is worth double-checking still works before relying on it.
        </div>
        {/* ADDED 1 Sep 2026 — real ask: search, now that this list runs
            to 11 categories and ~30 entries after the real URL
            population pass. Matches name, link, or notes. */}
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search resources"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box", marginBottom: 16 }} />
        <div aria-live="polite" aria-atomic="true" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>
          {hasMatch ? `Results found${query.trim() ? `, searched "${query}"` : ""}` : query.trim() ? "No resources match" : "No query"}
        </div>
        <div style={isDesktopWidth ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8, alignItems: "start" } : undefined}>
          {ResourcesRepository.getAllCategoryKeys().map((key) => (
            <ResourceCategory key={key} categoryKey={key} darkMode={darkMode} query={query} />
          ))}
          {!query.trim() && <ClinicalJustificationsCategory darkMode={darkMode} />}
        </div>
        {query.trim() && !hasMatch && (
          <div style={{ textAlign: "center", padding: "24px 16px", color: T.textDisabled, fontSize: 13 }}>No resources match your search.</div>
        )}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Privacy screen: Anonymise mode. Real, scoped ask
// from the user, not the earlier vague "what counts as identifiable"
// unknown — see privacySettingsRepository.js for the full reasoning
// and exact field-tier list.

export default ResourcesScreen;
