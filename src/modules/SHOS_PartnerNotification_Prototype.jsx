// SHOS_PartnerNotification_Prototype.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "partner notification - produce a task? ... should be
// able to generate a task/checklist of who to contact - produce name,
// contact method and detail (@/#). also consider a clinical version
// for tracking which may ask DOB/Age and address for sourcing." See
// partnerNotificationRepository.js's own header for the full scope
// reasoning (one list per Test, no auto-send, no new nav entry).
//
// Reached from a positive Test's own detail screen (Testing module) —
// not a standalone module with its own tab, per the user's explicit
// "that's a tangent" on the bigger nav/module-architecture question.
import React, { useState, useMemo, useEffect } from "react";
import { useLoadedMemo } from "../calculations/loadedRepositoryState";
import { CaretLeftIcon as ChevronLeft, XIcon as X, MagnifyingGlassIcon as Search, CheckIcon as Check, PencilSimpleIcon as Edit, ExportIcon as ExportIcon, TrashIcon as Trash2 } from "@phosphor-icons/react";
import { ContactRepository } from "../repositories/contactRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { PartnerNotificationRepository } from "../repositories/partnerNotificationRepository";
import { fuzzyIncludes } from "../calculations/fuzzyMatch";
import { exportTextFile } from "../storage/fileExportHelper";
import { NEUTRAL, NEUTRAL_DARK as DARK, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";
import { useDarkModePreference } from "../calculations/darkModePreference";

const radius = RADIUS;

function contactDisplayName(c) {
  return c.nickname || c.name || "Unnamed contact";
}

// Pulls together every real, distinct contact channel this app
// actually stores for a Contact into one human-readable line — this is
// the "detail (@/#)" the user asked for, auto-filled rather than
// requiring it be typed out by hand from the Contact record.
function summarizeContactMethods(c) {
  const parts = [];
  if (c.phone) parts.push(`Phone/WhatsApp: ${c.phone}`);
  if (c.snapchat) parts.push(`Snapchat: @${c.snapchat}`);
  if (c.fabguys) parts.push(`Fabguys: ${c.fabguys}`);
  if (c.fabswingers) parts.push(`Fabswingers: ${c.fabswingers}`);
  if (c.recon) parts.push(`Recon: ${c.recon}`);
  if (c.contactableVia?.length) parts.push(`Also on: ${c.contactableVia.join(", ")}`);
  return parts.join("  /  ");
}

function itemFromContact(c) {
  return {
    contactId: c.id,
    name: contactDisplayName(c),
    methods: summarizeContactMethods(c),
    dob: "",
    age: c.age ?? null,
    address: [c.address, c.city].filter(Boolean).join(", "),
    notified: false,
  };
}

// ── Contact picker (the "build/edit" step) ──
function ContactPickerStep({ initialSelectedIds, initialClinical, onGenerate, onCancel, T }) {
  // CHANGED 4 Sep 2026 — encryption-at-rest groundwork (see CLAUDE.md's
  // Known Issues / the Notion Development log): useLoadedMemo instead
  // of a plain useMemo, one of the ~100 real sites the audit found.
  const contacts = useLoadedMemo(() => ContactRepository.getAll().filter((c) => !c.isArchived), [], []);
  // Most-recently-encountered first — same "recent is most relevant"
  // reasoning as every other suggestion list this session, real value
  // here specifically since partner notification is inherently about
  // recent activity.
  const lastEncounterAt = useMemo(() => {
    const map = new Map();
    EncounterRepository.getAll().forEach((e) => {
      (e.attendeeIds || []).forEach((id) => {
        const existing = map.get(id);
        if (!existing || new Date(e.date || 0) > new Date(existing)) map.set(id, e.date);
      });
    });
    return map;
  }, []);
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => new Date(lastEncounterAt.get(b.id) || 0) - new Date(lastEncounterAt.get(a.id) || 0));
  }, [contacts, lastEncounterAt]);

  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelectedIds));
  const [clinical, setClinical] = useState(initialClinical);

  const queryTrimmed = query.trim();
  const visible = queryTrimmed
    ? sortedContacts.filter((c) => fuzzyIncludes(contactDisplayName(c), queryTrimmed))
    : sortedContacts;

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const generate = () => {
    const chosen = contacts.filter((c) => selectedIds.has(c.id));
    onGenerate(chosen, clinical);
  };

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.4 }}>
        Pick who to include. This never sends anything — it just builds a checklist you work through yourself, or hand to a clinic's partner notification team.
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>Clinical version</div>
            <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>Adds DOB, Age, and Address per contact — for handing to a clinic's own partner notification team, who need enough to actually locate someone themselves.</div>
          </div>
          <div onClick={() => setClinical((c) => !c)} role="switch" tabIndex={0} aria-checked={clinical} aria-label="Clinical version"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setClinical((c) => !c); } }}
            style={{ width: 40, height: 24, borderRadius: 999, background: clinical ? ACCENTS.healthcare : T.surfaceVariant, position: "relative", cursor: "pointer", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: clinical ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
          </div>
        </div>
      </div>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={15} color={T.textDisabled} style={{ position: "absolute", left: 12, top: 12 }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts…"
          style={{ width: "100%", padding: "10px 12px 10px 34px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, overflow: "hidden" }}>
        {visible.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textDisabled }}>No contacts match.</div>
        ) : visible.map((c) => {
          const isSelected = selectedIds.has(c.id);
          return (
            <div key={c.id} onClick={() => toggle(c.id)} role="checkbox" tabIndex={0} aria-checked={isSelected}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(c.id); } }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.textPrimary }}>{contactDisplayName(c)}</div>
                {summarizeContactMethods(c) && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{summarizeContactMethods(c)}</div>}
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${isSelected ? ACCENTS.healthcare : T.border}`, background: isSelected ? ACCENTS.healthcare : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {isSelected && <Check size={14} color="#FFFFFF" weight="bold" />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 12, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={generate} disabled={selectedIds.size === 0}
          style={{ flex: 2, padding: 12, borderRadius: 999, border: "none", background: selectedIds.size === 0 ? T.textDisabled : ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: selectedIds.size === 0 ? "default" : "pointer" }}>
          {selectedIds.size === 0 ? "Select at least one" : `Generate list (${selectedIds.size})`}
        </button>
      </div>
    </div>
  );
}

// ── Checklist (the generated list itself) ──
function ChecklistStep({ list, onEditContacts, onDelete, onClose, T }) {
  const [, forceRefresh] = useState(0);
  const refresh = () => forceRefresh((n) => n + 1);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleNotified = (contactId) => { PartnerNotificationRepository.toggleNotified(list.id, contactId); refresh(); };
  const editField = (contactId, field, value) => { PartnerNotificationRepository.updateItem(list.id, contactId, { [field]: value }); refresh(); };

  const notifiedCount = list.items.filter((i) => i.notified).length;

  const doExport = async () => {
    const lines = [
      `SHOS partner notification checklist`,
      list.clinical ? "(clinical version — includes DOB/age/address)" : "",
      "",
      "Not sent automatically. Not a diagnosis or medical advice — for your own use, or to hand to a clinic's partner notification team.",
      "",
    ];
    list.items.forEach((i, idx) => {
      lines.push(`${idx + 1}. ${i.name}${i.notified ? " [notified]" : ""}`);
      if (i.methods) lines.push(`   Contact: ${i.methods}`);
      if (list.clinical) {
        if (i.dob) lines.push(`   DOB: ${i.dob}`);
        if (i.age != null) lines.push(`   Age: ${i.age}`);
        if (i.address) lines.push(`   Address: ${i.address}`);
      }
      lines.push("");
    });
    await exportTextFile(`shos-partner-notification-${list.id}.txt`, lines.join("\n"));
  };

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12, lineHeight: 1.4 }}>
        Not sent automatically — work through this yourself, or export it to hand to a clinic. Tap a name to mark it done.
        {list.clinical && " Clinical version: DOB/address are typed in here, not pulled from anywhere — this app doesn't store DOB on a Contact."}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 8 }}>{notifiedCount} of {list.items.length} notified</div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, overflow: "hidden", marginBottom: 16 }}>
        {list.items.map((item, idx) => (
          <div key={item.contactId} style={{ padding: "14px", borderBottom: idx < list.items.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div onClick={() => toggleNotified(item.contactId)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${item.notified ? ACTION.green : T.border}`, background: item.notified ? ACTION.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.notified && <Check size={14} color="#FFFFFF" weight="bold" />}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, textDecoration: item.notified ? "line-through" : "none", opacity: item.notified ? 0.6 : 1 }}>{item.name}</span>
            </div>
            <textarea value={item.methods} onChange={(e) => editField(item.contactId, "methods", e.target.value)} placeholder="Contact method(s) — e.g. Phone: 07700 900123 / Snapchat: @handle" rows={2}
              style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box", resize: "vertical", marginBottom: list.clinical ? 8 : 0 }} />
            {list.clinical && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input value={item.dob} onChange={(e) => editField(item.contactId, "dob", e.target.value)} placeholder="DOB"
                  style={{ flex: "1 1 90px", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box" }} />
                <input value={item.age ?? ""} onChange={(e) => editField(item.contactId, "age", e.target.value === "" ? null : Number(e.target.value))} type="number" placeholder="Age"
                  style={{ flex: "1 1 70px", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box" }} />
                <input value={item.address} onChange={(e) => editField(item.contactId, "address", e.target.value)} placeholder="Address"
                  style={{ flex: "2 1 140px", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Inter', sans-serif", fontSize: 12, boxSizing: "border-box" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button onClick={onEditContacts} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>
          <Edit size={14} /> Edit contacts
        </button>
        <button onClick={doExport} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 999, border: "none", background: ACCENTS.healthcare, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
          <ExportIcon size={14} /> Export as text
        </button>
      </div>
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { onDelete(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: ACTION.red, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete this list</button>
        </div>
      ) : (
        <div onClick={() => setConfirmDelete(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 8, fontSize: 12, color: ACTION.red, cursor: "pointer" }}>
          <Trash2 size={13} /> Delete this list
        </div>
      )}
    </div>
  );
}

export default function PartnerNotificationSheet({ testId, onClose }) {
  const [darkMode] = useDarkModePreference();
  const T = darkMode ? DARK : NEUTRAL;
  // CHANGED 4 Sep 2026 — encryption-at-rest groundwork (see CLAUDE.md's
  // Known Issues / the Notion Development log): NOT a mechanical
  // useLoadedState swap — editing's own initial value depends on
  // whether `list` is null, and if `list` starts at the fallback (null)
  // before loading, then resolves to a real list shortly after,
  // `editing` (computed once at ITS OWN mount time) would go stale —
  // stuck on "no list yet, start on the generate step" even once a
  // real list has loaded. Both need to resolve together, in the same
  // effect, so editing is always in sync with the real, loaded list.
  // REAL BUG caught live: initially set editing=false to "match" list's
  // own null fallback, but the render below only ever reads list.items
  // in the `!editing` (ChecklistStep) branch — in the OLD synchronous
  // code that was always safe, since editing was only ever false when
  // list was already a real object. list=null + editing=false (for the
  // one render before the effect resolves) broke that invariant and
  // crashed with "Cannot read properties of null (reading 'items')".
  // editing defaults to true instead — the ContactPickerStep branch
  // doesn't touch `list` at all, so it's always safe to render first,
  // exactly the same worst-case assumption the original `!list` made.
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(true);
  useEffect(() => {
    const loaded = PartnerNotificationRepository.getByTestId(testId);
    setList(loaded);
    setEditing(!loaded);
  }, [testId]);

  const handleGenerate = (chosenContacts, clinical) => {
    // Preserves notified/edited fields for a contact that's still on
    // the list after an edit; a newly-added contact gets a fresh item.
    const existingByContact = new Map((list?.items || []).map((i) => [i.contactId, i]));
    const items = chosenContacts.map((c) => existingByContact.get(c.id) || itemFromContact(c));
    const saved = PartnerNotificationRepository.save({ testId, clinical, items });
    setList(saved);
    setEditing(false);
  };

  const handleDelete = () => {
    PartnerNotificationRepository.remove(list.id);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", background: T.bg, zIndex: 230, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {editing && list ? (
            <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={() => setEditing(false)} />
          ) : (
            <X size={20} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} aria-label="Close" />
          )}
          <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{editing ? (list ? "Edit contacts" : "Contact list") : "Contact list"}</span>
        </div>
      </div>
      {editing ? (
        <ContactPickerStep
          initialSelectedIds={(list?.items || []).map((i) => i.contactId)}
          initialClinical={list?.clinical || false}
          onGenerate={handleGenerate}
          onCancel={() => (list ? setEditing(false) : onClose())}
          T={T}
        />
      ) : (
        <ChecklistStep list={list} onEditContacts={() => setEditing(true)} onDelete={handleDelete} onClose={onClose} T={T} />
      )}
    </div>
  );
}
