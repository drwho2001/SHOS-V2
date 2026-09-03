import React, { useState, useMemo } from "react";
import { MagnifyingGlassIcon as Search, XIcon as X, UsersIcon as Users, PulseIcon as Activity, PillIcon as Pill, HeartbeatIcon as HeartPulse, CaretRightIcon as ChevronRight } from "@phosphor-icons/react";
import { ContactRepository } from "../repositories/contactRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { formatRelativeDate } from "../calculations/encounterCalculations";
import { useDarkModePreference } from "../calculations/darkModePreference";
import { NEUTRAL_DARK as DARK } from "../calculations/designTokens";
// ADDED — real bug found in the user's own testing: kinks were never
// indexed in Global Search at all — searching "fisting" found nothing,
// even for a Contact/Encounter that genuinely had it recorded.
import { KinkRegistry } from "../registries/kinkRegistry";
// ADDED — real ask: typo-tolerant fuzzy matching, since plain
// substring matching (what this had before) only handled case, not
// misspellings.
import { fuzzyIncludes } from "../calculations/fuzzyMatch";
// CHANGED 20 Aug 2026 — real design-unification pass: this module had
// no shared theme object at all (every other module has a LIGHT/T
// constant built from these same values) — raw hex was typed directly
// into each style prop instead. Brought in line with the rest of the
// app's pattern, reading from the shared designTokens.js source of
// truth. Also fixes a real bug found in the process: medication's
// result-badge color here was #3B82F6, a different, lighter blue than
// Medication Dashboard's own accent (ACCENTS.medication, #3D63C9) —
// same drift App.jsx's nav tab/quick-add button had.
import { NEUTRAL, ACCENTS, FONT_FAMILY, RADIUS } from "../calculations/designTokens";
// FIXED 1 Sep 2026 — real ask: "global search nav breaks as soon as
// first letter typed." Root cause: the sort-toggle row (added 26 Aug
// 2026) referenced `radius.full` but this module never defined or
// imported a `radius` constant at all — a real ReferenceError, not a
// data issue, that only threw once there were actual results to
// render the sort toggle for (query non-empty AND results.length > 0),
// which is exactly "as soon as the first letter typed" for anything
// that matches. Same `radius = RADIUS` alias every other module uses.
const radius = RADIUS;

// ADDED 19 Aug 2026 — Global Search, one of the user's two joint-top
// priority items (alongside Settings) from the FULL VERIFIED AUDIT's
// "bigger builds" list. Doc 1 scopes this to: Contacts · Episodes
// [PLANNED] · Medications · Tests · Activities · Symptoms.
//
// Episodes isn't built — Clinical Episode is still an open, undecided
// architecture question in Notion itself, not just an app gap, so
// there's nothing real to search yet.
//
// UPDATED 19 Aug 2026 — "Symptoms" IS now its own real result type:
// Symptom Log (Notion's Symptoms Tracker) exists as a real dated-
// occurrence module now, distinct from the Symptom Registry tag
// vocabulary already searchable as part of whichever Encounter/Clinic
// Visit record it's attached to. Doc 1's own "Symptoms" listing is
// satisfied for real now, not worked around.
//
// Clinic Visits is included even though Doc 1 (written before that
// module existed) doesn't list it — it's a real, built module now, and
// the project's own standing practice is to keep search coverage
// honest against actual app state rather than a doc written earlier.
const RESULT_META = {
  contact: { label: "Contact", icon: Users, color: ACCENTS.contacts, tab: "contacts" },
  encounter: { label: "Encounter", icon: Activity, color: ACCENTS.encounters, tab: "activity" },
  medication: { label: "Medication", icon: Pill, color: ACCENTS.medication, tab: "medication" },
  test: { label: "Test", icon: HeartPulse, color: ACCENTS.healthcare, tab: "healthcare", subTab: "testing" },
  clinicVisit: { label: "Clinic Visit", icon: HeartPulse, color: ACCENTS.healthcare, tab: "healthcare", subTab: "clinicVisits" },
  symptomLog: { label: "Symptom Log", icon: HeartPulse, color: ACCENTS.healthcare, tab: "healthcare", subTab: "symptomLog" },
  vaccination: { label: "Vaccination", icon: HeartPulse, color: ACCENTS.healthcare, tab: "healthcare", subTab: "vaccinations" },
};

function norm(v) {
  return (v == null ? "" : String(v)).toLowerCase();
}

// Builds the full unfiltered index once per screen-open — the whole
// app's data is small enough (single user, not thousands of rows) that
// filtering client-side on every keystroke is simpler and fast enough,
// same "don't over-engineer for a single-user app" judgment already
// applied elsewhere in this project (e.g. the ID scheme staying
// human-readable rather than moving to UUIDs).
function buildIndex() {
  const results = [];

  ContactRepository.getAll().filter((c) => !c.isArchived).forEach((c) => {
    // CHANGED — real bug fix: resolve kink IDs to real names and
    // include them in the search text — statedKinks/limits store
    // {kinkId, role} selections, not names, so this needs an explicit
    // resolve step, the same one every kink-displaying screen already
    // does.
    const kinkNames = [...c.statedKinks, ...c.limits].map((sel) => KinkRegistry.getById(sel.kinkId)?.name).filter(Boolean);
    const searchText = [c.name, c.nickname, c.phone, c.snapchat, c.fabguys, c.fabswingers, c.recon, c.city, c.notes, ...kinkNames].join(" ");
    results.push({
      type: "contact", id: c.id,
      title: c.nickname || c.name || "Unnamed contact",
      subtitle: c.city || "",
      searchText,
      // ADDED 26 Aug 2026 — real ask: chronological sort/grouping.
      // Contacts have no natural "date" the way an Activity or Test
      // does — createdAt (when added to SHOS) is the closest honest
      // equivalent, not a record of anything that actually happened.
      date: c.createdAt || null,
    });
  });

  MedicationRepository.getAll().filter((m) => !m.isArchived).forEach((m) => {
    const searchText = [m.name, m.medicationType, m.usualSupplier, m.route].join(" ");
    results.push({
      type: "medication", id: m.id,
      title: m.name || "Unnamed medication",
      subtitle: m.medicationType || m.route || "",
      searchText,
      // No natural date field exists on Medication at all — honestly
      // null rather than guessing at one.
      date: null,
    });
  });

  EncounterRepository.getAll().filter((e) => !e.isArchived).forEach((e) => {
    // CHANGED — same real fix as Contacts above.
    const kinkNames = (e.kinksInvolved || []).map((sel) => KinkRegistry.getById(sel.kinkId)?.name).filter(Boolean);
    const searchText = [e.title, e.encounterType, e.notes, ...kinkNames].join(" ");
    results.push({
      type: "encounter", id: e.id,
      title: e.title || e.encounterType || "Encounter",
      subtitle: e.date ? formatRelativeDate(e.date) : "",
      searchText,
      date: e.date || null,
    });
  });

  TestingRepository.getAll().filter((t) => !t.isArchived).forEach((t) => {
    const searchText = [t.title, ...(t.testingFor || []), t.trackingInfo, t.kitCodePk, t.kitCodeSk, t.kitAccessKey].join(" ");
    results.push({
      type: "test", id: t.id,
      title: t.title || (t.testingFor || []).join("/") || "Test",
      subtitle: t.date ? formatRelativeDate(t.date) : "",
      searchText,
      date: t.date || null,
    });
  });

  ClinicVisitsRepository.getAll().filter((v) => !v.isArchived).forEach((v) => {
    const searchText = [v.title, v.clinician, ...(v.reasonForVisit || []), v.clinicalNotes].join(" ");
    results.push({
      type: "clinicVisit", id: v.id,
      title: v.title || (v.reasonForVisit || []).join("/") || "Clinic visit",
      subtitle: v.date ? formatRelativeDate(v.date) : "",
      searchText,
      date: v.date || null,
    });
  });

  // ADDED 19 Aug 2026 — Symptom Log, added the same session it was
  // built, immediately (not after a session-long gap the way Testing's
  // own backup omission was caught once already this project).
  SymptomLogRepository.getAll().filter((e) => !e.isArchived).forEach((e) => {
    const searchText = [e.title, e.notes].join(" ");
    results.push({
      type: "symptomLog", id: e.id,
      title: e.title || "Symptom entry",
      subtitle: e.dateStarted ? formatRelativeDate(e.dateStarted) : "",
      searchText,
      date: e.dateStarted || null,
    });
  });

  VaccinationRepository.getAll().filter((v) => !v.isArchived).forEach((v) => {
    const searchText = [v.title, v.vaccine, v.provider, v.notes].join(" ");
    results.push({
      type: "vaccination", id: v.id,
      title: v.title || v.vaccine || "Vaccination",
      subtitle: v.date ? formatRelativeDate(v.date) : "",
      searchText,
      date: v.date || null,
    });
  });

  return results;
}

function ResultRow({ result, onSelect }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const meta = RESULT_META[result.type];
  const Icon = meta.icon;
  return (
    <div onClick={() => onSelect(result)}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", background: T.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: `${meta.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} color={meta.color} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</div>
          <div style={{ fontSize: 11, color: T.textSecondary }}>{meta.label}{result.subtitle ? ` · ${result.subtitle}` : ""}</div>
        </div>
      </div>
      <ChevronRight size={16} color={T.textDisabled} style={{ flexShrink: 0 }} />
    </div>
  );
}

// onNavigate(tabKey, recordId, subTab) — switches App.jsx's active tab
// and, for every module with its own detail screen (Contacts, Activity,
// Testing, Clinic Visits, Symptom Log, Vaccinations), deep-links
// straight into that exact record via the shared openRecordId
// mechanism — not just the list it lives in. Medication is the one
// honest exception: it has no separate detail screen at all, so its
// result uses scroll-to + a neutral highlight within the dashboard
// instead, a real and disclosed limit rather than a silent gap.
export default function GlobalSearchScreen({ onClose, onNavigate }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;

  const [query, setQuery] = useState("");
  // ADDED 26 Aug 2026 — real ask: sort/filter on the search results
  // page — a kink term like a specific act can genuinely match both a
  // Contact and an Activity, which read very differently in a flat
  // relevance-only list. Chronological is the real default per the user's
  // own stated preference.
  const [sortMode, setSortMode] = useState("chronological"); // "chronological" | "alphabetical"
  const index = useMemo(() => buildIndex(), []);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q.length) return [];
    // CHANGED — real ask: typo-tolerant matching, not just case-
    // insensitive substring. See fuzzyMatch.js for exactly what this
    // does and doesn't cover.
    const matched = index.filter((r) => fuzzyIncludes(r.searchText, q)).slice(0, 30);
    if (sortMode === "alphabetical") {
      return [...matched].sort((a, b) => a.title.localeCompare(b.title));
    }
    // Chronological: most recent first. Results with no real date
    // (Medication always, Contacts sometimes) sort to the end rather
    // than being guessed into a fake position.
    return [...matched].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
  }, [query, index, sortMode]);

  // ADDED 26 Aug 2026 — date-bucket grouping, chronological mode only
  // — grouping by module AS WELL would genuinely contradict a single
  // date-ordered list (can't have one global chronological order and
  // separate per-module clusters at the same time), so per the user's own
  // "less important if too contradictory" call, this is date-bucket
  // grouping only, not module grouping.
  const groupedResults = useMemo(() => {
    if (sortMode !== "chronological") return null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
    const monthStart = new Date(todayStart.getTime() - 30 * 86400000);
    const buckets = { "Today": [], "This week": [], "This month": [], "Older": [], "No date": [] };
    results.forEach((r) => {
      if (!r.date) { buckets["No date"].push(r); return; }
      const d = new Date(r.date);
      if (d >= todayStart) buckets["Today"].push(r);
      else if (d >= weekStart) buckets["This week"].push(r);
      else if (d >= monthStart) buckets["This month"].push(r);
      else buckets["Older"].push(r);
    });
    return Object.entries(buckets).filter(([, items]) => items.length > 0);
  }, [results, sortMode]);

  // CHANGED — real ask: "whatever I click should open that
  // card/record, not nav to the list with it in somewhere." Was
  // discarding result.id entirely, only ever switching tabs. Now
  // passes the real record id (and sub-tab, for Healthcare-domain
  // results) through to the real deep-link mechanism.
  const handleSelect = (result) => {
    const meta = RESULT_META[result.type];
    onNavigate(meta.tab, result.id, meta.subTab);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", background: T.bg, zIndex: 200, display: "flex", flexDirection: "column", fontFamily: FONT_FAMILY }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <Search size={18} color={T.textDisabled} style={{ flexShrink: 0 }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts, medications, activities, tests, clinic visits..."
          style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", color: T.textPrimary, fontFamily: FONT_FAMILY }}
        />
        <X size={20} color={T.textSecondary} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onClose} aria-label="Close search" />
      </div>

      {/* ADDED 26 Aug 2026 — real ask: sort toggle. */}
      {query.trim().length > 0 && results.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", background: T.surface, borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
          {[{ key: "chronological", label: "Most recent" }, { key: "alphabetical", label: "A–Z" }].map((s) => (
            <div key={s.key} onClick={() => setSortMode(s.key)}
              style={{ padding: "5px 12px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${sortMode === s.key ? T.textPrimary : T.border}`, color: sortMode === s.key ? "#FFFFFF" : T.textSecondary, background: sortMode === s.key ? T.textPrimary : "transparent" }}>
              {s.label}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {query.trim().length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: T.textDisabled, fontSize: 13 }}>
            Start typing to search across Contacts, Medications, Activities, Tests, and Clinic Visits.
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: T.textDisabled, fontSize: 13 }}>
            No matches for "{query}".
          </div>
        )}
        {groupedResults
          ? groupedResults.map(([label, items]) => (
              <div key={label}>
                <div style={{ padding: "10px 16px 4px", fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, background: T.bg }}>{label}</div>
                {items.map((r) => <ResultRow key={`${r.type}-${r.id}`} result={r} onSelect={handleSelect} />)}
              </div>
            ))
          : results.map((r) => (
              <ResultRow key={`${r.type}-${r.id}`} result={r} onSelect={handleSelect} />
            ))}
      </div>
    </div>
  );
}
