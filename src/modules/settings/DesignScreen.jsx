// DesignScreen — extracted verbatim from src/modules/SHOS_Settings_Prototype.jsx
// (24 Sep 2026 settings split). Behavior unchanged; only the file moved.
import React, { useState, useEffect, useRef } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { WarningIcon as AlertTriangle, CaretLeftIcon as ChevronLeft, ArrowUUpLeftIcon as ResetIcon } from "@phosphor-icons/react";
import { ACCENTS, ACTION, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { ModuleColorRepository, CUSTOMIZABLE_MODULE_KEYS, CUSTOMIZABLE_ACTION_KEYS } from "../../repositories/moduleColorRepository";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useLoadedMemo, useLoadedState } from "../../calculations/loadedRepositoryState";
import { useIsDesktopWidth } from "../../calculations/responsive";

const MODULE_LABELS = { contacts: "Contacts", encounters: "Encounter", medication: "Medication", healthcare: "Healthcare", home: "Home", menstrual: "Menstrual" };
// ADDED — real ask: the semantic pass/fail pair, editable alongside
// the 5 module colours above — see CUSTOMIZABLE_ACTION_KEYS in
// moduleColorRepository.js and ACTION in designTokens.js.
const ACTION_COLOR_LABELS = { actionRed: "Negative / alert (red)", actionGreen: "Positive / success (green)" };

// ADDED 26 Aug 2026 — real ask: clickable info explaining the
// calculation behind a stat, citing real guidance (BASHH/CDC) where
// relevant. A styled "i" rather than a new icon import — this session
// already found two confirmed-broken icon imports elsewhere, so a
// zero-risk approach felt safer than a third guess.

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(r, g, b) {
  const clamp = (n) => Math.max(0, Math.min(255, Number(n) || 0));
  return "#" + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("");
}

// ADDED — real ask: "on sliders page for colour selection, can we
// maybe have optional user switch to colour wheel as well... then no
// previous hex needed to know." The native input[type=color] below is
// whatever picker the device/WebView happens to ship (varies by
// Android version — sometimes a wheel, sometimes a plain RGB slider
// grid), and typing hex/RGB both assume you already know a value to
// start from. h: 0-360, s/v: 0-100 — standard HSV, not HSL, since a
// wheel (hue x saturation) with a separate brightness axis is the
// familiar "colour wheel" shape people expect, not what HSL would draw.
function hsvToHex(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
function hexToHsv(hex) {
  const rgb = hexToRgb(hex) || { r: 0, g: 0, b: 0 };
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}
// Renders the wheel itself into a canvas at a fixed brightness (V) —
// hue as angle, saturation as distance from centre, the standard "HSV
// wheel" shape. Recomputed only when V changes (the brightness slider
// moves), not on every hue/saturation pick — picking a point on an
// already-drawn wheel is just reading its angle/distance, no redraw
// needed.
function drawColorWheel(canvas, v) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const radius = size / 2;
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius, dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * size + x) * 4;
      if (dist > radius) continue; // leave transparent outside the circle
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      angle = (angle + 360) % 360;
      const s = Math.min(100, (dist / radius) * 100);
      const rgb = hexToRgb(hsvToHex(angle, s, v));
      data[idx] = rgb.r; data[idx + 1] = rgb.g; data[idx + 2] = rgb.b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}
// The picker component itself — a canvas wheel (drag/tap to set hue +
// saturation) plus one brightness slider underneath, so no dimension
// this app's colours need (full HSV space) is left unreachable. Reads
// its current hue/saturation/brightness straight from currentValue
// every render rather than its own separate copy — the same value the
// parent already owns via ModuleColorRepository, avoiding a second
// source of truth that could drift from what Hex/RGB or the native
// picker show for the same colour.
function ColorWheelPicker({ currentValue, onPick, darkMode }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const size = 200;
  const { h, s, v } = hexToHsv(currentValue);

  useEffect(() => {
    if (canvasRef.current) drawColorWheel(canvasRef.current, v);
  }, [v]);

  const pickFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = point.clientX - rect.left, y = point.clientY - rect.top;
    const radius = rect.width / 2;
    const dx = x - radius, dy = y - radius;
    const dist = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    angle = (angle + 360) % 360;
    const sat = Math.min(100, (dist / radius) * 100);
    onPick(hsvToHex(angle, sat, v));
  };

  const markerAngleRad = (h * Math.PI) / 180;
  const markerRadius = (s / 100) * (size / 2);
  const markerX = size / 2 + markerRadius * Math.cos(markerAngleRad);
  const markerY = size / 2 + markerRadius * Math.sin(markerAngleRad);

  return (
    <div>
      <div
        style={{ position: "relative", width: size, height: size, margin: "0 auto", touchAction: "none" }}
        onPointerDown={(e) => { setDragging(true); pickFromEvent(e); }}
        onPointerMove={(e) => { if (dragging) pickFromEvent(e); }}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
      >
        <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size, borderRadius: "50%", display: "block", cursor: "pointer" }} />
        <div style={{
          position: "absolute", left: markerX - 8, top: markerY - 8, width: 16, height: 16, borderRadius: "50%",
          background: currentValue, border: "2px solid #FFFFFF", boxShadow: "0 0 0 1px rgba(0,0,0,.5)", pointerEvents: "none",
        }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
        <span style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, flexShrink: 0 }}>Brightness</span>
        <input type="range" min="0" max="100" value={Math.round(v)}
          onChange={(e) => onPick(hsvToHex(h, s, Number(e.target.value)))}
          style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function ColorInputRow({ colorKey, currentValue, isOverridden, onSetColor, onReset, label }) {
  const [darkMode] = useDarkModePreference();

  const [expanded, setExpanded] = useState(false);
  // ADDED — real ask: optional colour wheel alongside the existing
  // Hex/RGB fields, so picking a colour never requires already knowing
  // a value. Wheel is the default tab on expand — the whole point of
  // the ask was "no previous hex needed to know" — Hex/RGB stays one
  // tap away for anyone who does have a specific value in mind.
  const [panelMode, setPanelMode] = useState("wheel");
  const [hexDraft, setHexDraft] = useState(currentValue);
  const rgb = hexToRgb(currentValue) || { r: 0, g: 0, b: 0 };

  const commitHex = (v) => {
    setHexDraft(v);
    if (/^#?[a-f\d]{6}$/i.test(v)) onSetColor(colorKey, v.startsWith("#") ? v : `#${v}`);
  };
  const commitRgbChannel = (channel, value) => {
    const next = { ...rgb, [channel]: value };
    onSetColor(colorKey, rgbToHex(next.r, next.g, next.b));
  };

  return (
    <div style={{ borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div role="button" tabIndex={0} aria-label={`Customise ${label} colour`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setExpanded((e) => !e)} style={{ width: 16, height: 16, borderRadius: "50%", background: currentValue, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), cursor: "pointer" }} />
          <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>{label}</span>
          {isOverridden && <span style={{ fontSize: 10, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, fontStyle: "italic" }}>(customised)</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isOverridden && (
            <ResetIcon role="button" tabIndex={0} aria-label="Reset to default" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} size={16} color={darkMode ? DARK.textDisabled : NEUTRAL.textDisabled} style={{ cursor: "pointer" }} onClick={onReset} title="Reset to default" />
          )}
          {/* REMOVED 1 Sep 2026 — real ask: "colour buttons sit on a
              white background... looks visually out of place." That
              was this native input[type=color] swatch button — its box
              is drawn by the OS/WebView itself, not this app, so it
              can't be reliably restyled to match either theme (dark
              mode especially showed it as a stray white box next to an
              otherwise dark row). Not a loss of function: the circular
              preview dot to the left already opens the exact same row
              (onClick={() => setExpanded}), and the real picker for
              actually choosing a colour is the wheel/Hex/RGB panel
              below, built specifically because native pickers alone
              "feel v dated" (see ColorWheelPicker's own comment) — this
              button was a second, redundant entry point to that same
              native picker the app already moved away from. */}
          <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={() => setExpanded((e) => !e)} style={{ fontSize: 11, color: ACCENTS.medication, fontWeight: 600, cursor: "pointer" }}>{expanded ? "Hide" : "Customise"}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
            {[["wheel", "Colour wheel"], ["hexrgb", "Hex/RGB"]].map(([mode, tabLabel]) => (
              <span role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} key={mode} onClick={() => setPanelMode(mode)}
                style={{
                  fontSize: 12, fontWeight: 700, cursor: "pointer", paddingBottom: 4,
                  color: panelMode === mode ? ACCENTS.medication : (darkMode ? DARK.textDisabled : NEUTRAL.textDisabled),
                  borderBottom: panelMode === mode ? `2px solid ${ACCENTS.medication}` : "2px solid transparent",
                }}>
                {tabLabel}
              </span>
            ))}
          </div>
          {panelMode === "wheel" ? (
            <ColorWheelPicker currentValue={currentValue} darkMode={darkMode}
              onPick={(hex) => { onSetColor(colorKey, hex); setHexDraft(hex); }} />
          ) : (
            <>
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>Hex</div>
              <input value={hexDraft} onChange={(e) => commitHex(e.target.value)} placeholder="#RRGGBB" aria-label="Hex colour value"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontFamily: "'JetBrains Mono', monospace", fontSize: 13, marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ fontSize: 11, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 4 }}>RGB</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["r", "g", "b"].map((channel) => (
                  <input key={channel} type="number" min="0" max="255" value={rgb[channel]} aria-label={`${channel.toUpperCase()} (0-255)`}
                    onChange={(e) => commitRgbChannel(channel, e.target.value)}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), fontSize: 13, boxSizing: "border-box" }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ADDED 26 Aug 2026 — real ask: Trash / recently deleted, a genuine
// persistent holding area distinct from the 8s undo toast built
// earlier this session — that toast only covers the immediate moment
// of deletion, this is for "I deleted this three days ago and want it
// back." 30-day retention, matching common conventions (Photos apps,
// most email clients).

export function DesignScreen({ onClose }) {
  // ADDED — real audit finding (desktop full-width sweep): grid the
  // Dark-mode/CVD-palette toggle cards; multi-column flow (matching
  // Registry Management's own row-list precedent) for the Module
  // colours/Status colours row lists.
  const isDesktopWidth = useIsDesktopWidth();
  const [overrides, setOverrides] = useLoadedState(() => ModuleColorRepository.getOverrides(), [], {});
  const [changed, setChanged] = useState(false);
  // ADDED 26 Aug 2026 — real ask: single global dark mode toggle here,
  // replacing Medication's own per-module icon. Same shared
  // useDarkModePreference() hook/storage key as before — only the
  // location of the control changed, not the preference itself.
  const [darkMode, setDarkMode] = useDarkModePreference();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  // CHANGED — Phase 2 encryption groundwork: ModuleColorRepository is
  // now async — every handler below awaits its write, then awaits a
  // fresh getOverrides() before updating local state, same "write then
  // reread" shape as everywhere else this session.
  const setColor = async (key, hex) => {
    await ModuleColorRepository.setOverride(key, hex);
    setOverrides(await ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const reset = async (key) => {
    await ModuleColorRepository.resetOverride(key);
    setOverrides(await ModuleColorRepository.getOverrides());
    setChanged(true);
  };
  const resetAll = async () => {
    await ModuleColorRepository.resetAll();
    setOverrides({});
    setChanged(true);
  };
  // ADDED — real ask, 28 Aug 2026: a single toggle applying/removing
  // all 7 CVD_SAFE_PALETTE colours at once, via the same
  // setOverride()/resetOverride() mechanism as a manual pick — see
  // that constant's own comment in moduleColorRepository.js for the
  // research behind the exact hues. "On" is derived from the actual
  // stored overrides each render, not a separate flag.
  // CHANGED — Phase 2 encryption groundwork: isCvdPaletteActive() is
  // now async — was a plain render-body call ("safe" only while the
  // repository stayed synchronous, the same trap this exact pattern
  // has hit for other repositories earlier this session), now resolved
  // via useLoadedMemo, re-evaluated whenever the loaded overrides
  // change so a manual colour edit still correctly flips it back off.
  const cvdActive = useLoadedMemo(() => ModuleColorRepository.isCvdPaletteActive(), [overrides], false);
  const toggleCvdPalette = async () => {
    if (cvdActive) await ModuleColorRepository.removeCvdPalette();
    else await ModuleColorRepository.applyCvdPalette();
    setOverrides(await ModuleColorRepository.getOverrides());
    setChanged(true);
  };

  return (
    <div ref={dialogRef} role="dialog" aria-label="Colour scheme" tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}>
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label="Back" onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>Colour scheme</h1>
      </div>
      <div style={{ padding: 16 }}>
        {changed && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#1B1B1F", color: "#FFFFFF", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} /> Colour changes need a reload to apply everywhere.
            </div>
            {/* ADDED 26 Aug 2026 — real ask: auto-reload on design edit.
                Not a true instant auto-reload — native colour inputs
                fire continuously while dragging in most browsers, so
                reloading on every event would interrupt you mid-pick.
                A one-tap reload right here, the moment you're done
                choosing, is the safe version of the same ask. */}
            <button onClick={() => window.location.reload()}
              style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #FFFFFF", background: "transparent", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Reload now
            </button>
          </div>
        )}
        <div style={isDesktopWidth ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8, alignItems: "start" } : undefined}>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
            <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>Dark mode</span>
            {/* CHANGED — real bug: the knob used to switch to
                DARK.surface (#1C1C1F) when on, nearly identical to the
                track's own #1B1B1F — the one control to turn dark mode
                OFF was invisible while IN dark mode. Every other toggle
                in this app keeps its knob solid white regardless of
                state (only the track colour changes) — matching that
                established pattern here too, plus the same subtle
                shadow those use for depth against a light track. */}
            <div onClick={() => setDarkMode((d) => !d)} role="switch" tabIndex={0} aria-checked={darkMode} aria-label="Dark mode"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDarkMode((d) => !d); } }}
              style={{ width: 44, height: 26, borderRadius: 999, background: darkMode ? ACCENTS.home : "#DCDCE1", position: "relative", cursor: "pointer", transition: "background 0.15s" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: darkMode ? 21 : 3, transition: "left 0.15s" }} />
            </div>
          </div>
        </div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, fontWeight: 500 }}>Colour-blind friendly palette</span>
              <div onClick={toggleCvdPalette} role="switch" tabIndex={0} aria-checked={cvdActive} aria-label="Colour-blind friendly palette"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCvdPalette(); } }}
                style={{ width: 44, height: 26, borderRadius: 999, background: cvdActive ? ACCENTS.home : (darkMode ? DARK.border : NEUTRAL.border), position: "relative", cursor: "pointer", transition: "background 0.15s", flexShrink: 0 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,.4)", position: "absolute", top: 3, left: cvdActive ? 21 : 3, transition: "left 0.15s" }} />
              </div>
            </div>
            {/* ADDED — real ask: brief, honest explanation of what this
                actually does, right where the toggle lives, since it's
                a research-backed preset rather than a self-explanatory
                control. */}
            <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginTop: 6, lineHeight: 1.4 }}>
              Swaps all module and status colours below for one shared set, checked
              (via real colour-blindness simulation, not just standard vision) to stay
              distinguishable and legible under protanopia, deuteranopia, AND
              tritanopia at once — one balanced set covering all three, not tuned to
              any single type. Turning it off resets those 7 colours back to their
              regular defaults, and every colour stays yours to fine-tune by hand
              below either way.
            </div>
          </div>
        </div>
        </div>
        <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "0 0 6px" }}>Module colours</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", ...(isDesktopWidth ? { columnCount: 2, columnGap: 0 } : {}) }}>
          {CUSTOMIZABLE_MODULE_KEYS.map((key) => {
            const isOverridden = key in overrides;
            const currentValue = overrides[key] || ACCENTS[key];
            return (
              <ColorInputRow key={key} colorKey={key} currentValue={currentValue} isOverridden={isOverridden}
                label={MODULE_LABELS[key]} onSetColor={setColor} onReset={() => reset(key)} />
            );
          })}
        </div>
        {/* ADDED — real ask: the semantic pass/fail pair, editable
            alongside the 5 module colours — the single most relevant
            pair for colourblind usability specifically, since red/
            green confusion is the most common form. Wired app-wide,
            dark mode included — see designTokens.js's ACTION export
            and resolveDarkAccent(). */}
        <div style={{ ...TYPE.sectionLabel, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, padding: "20px 0 6px" }}>Status colours</div>
        <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, overflow: "hidden", ...(isDesktopWidth ? { columnCount: 2, columnGap: 0 } : {}) }}>
          {CUSTOMIZABLE_ACTION_KEYS.map((key) => {
            const isOverridden = key in overrides;
            const currentValue = overrides[key] || ACTION[key === "actionRed" ? "red" : "green"];
            return (
              <ColorInputRow key={key} colorKey={key} currentValue={currentValue} isOverridden={isOverridden}
                label={ACTION_COLOR_LABELS[key]} onSetColor={setColor} onReset={() => reset(key)} />
            );
          })}
        </div>
        {Object.keys(overrides).length > 0 && (
          <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} onClick={resetAll} style={{ marginTop: 14, fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, textDecoration: "underline", cursor: "pointer", textAlign: "center" }}>
            Reset all to defaults
          </div>
        )}
      </div>
    </div>
  );
}

// REMOVED 15 Sep 2026 — InactiveThresholdCard/ShowRoleOnCardsToggleCard
// moved to SHOS_Contacts_Prototype.jsx (now reachable via a real
// in-module Contacts settings screen) — see this file's own real
// audit entry in CLAUDE.md's Recently shipped for the full reasoning.

// ADDED — real ask: Menstrual/Contraception/Pregnancy tracking, gated
// behind this toggle rather than gender (menopause HRT/TRT tracking
// already established gender-based assumptions don't hold for who
// needs this). Off by default, same "opt-in feature area" toggle
// pattern as calendar sync above.

export default DesignScreen;
