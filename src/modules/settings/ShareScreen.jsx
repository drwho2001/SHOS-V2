// ShareScreen.jsx — in-app counterpart of public/share.html. Same two
// QR codes (APK latest release + web app), same share-link action, so the
// card works offline (the PNGs ship inside the bundle) and there is one
// source of truth for the URLs (gen-share-qr.cjs + share.html).
import React, { useRef, useEffect } from "react";
import { NEUTRAL_DARK as DARK } from "../../calculations/designTokens";
import { CaretLeftIcon as ChevronLeft } from "@phosphor-icons/react";
import { ACCENTS, NEUTRAL, RADIUS, TYPE } from "../../calculations/designTokens";
import { useDarkModePreference } from "../../calculations/darkModePreference";
import { useIsDesktopWidth } from "../../calculations/responsive";
import { useTranslation } from "../../i18n/index.js";

const APK_URL = "https://github.com/drwho2001/SHOS-V2/releases/latest";
const WEB_URL = "https://drwho2001.github.io/SHOS-V2/";
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

export function ShareScreen({ onClose }) {
  const { t } = useTranslation();
  const [darkMode] = useDarkModePreference();
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);
  const isDesktopWidth = useIsDesktopWidth();

  const shareLink = async () => {
    const url = WEB_URL;
    try {
      if (navigator.share) { await navigator.share({ title: "SHOS", text: "SHOS - Sexual Health Operating System", url }); return; }
    } catch (e) { /* user cancelled */ }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); alert(t("share.copied", "Link copied to clipboard.")); return; }
    } catch (e) { /* fall through */ }
    window.prompt(t("share.copyPrompt", "Copy this link:"), url);
  };

  const card = (title, sub, qrSrc, href, linkText) => (
    <div style={{ background: darkMode ? DARK.surface : NEUTRAL.surface, border: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border), borderRadius: RADIUS.md, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, marginBottom: 12, lineHeight: 1.4 }}>{sub}</div>
      <img src={qrSrc} alt={title + " QR code"} style={{ width: "100%", maxWidth: 220, height: "auto", borderRadius: 8, background: "#FFFFFF" }} />
      <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 10, fontSize: 12, color: ACCENTS.medication, fontWeight: 600, wordBreak: "break-all" }}>{linkText}</a>
    </div>
  );

  return (
    <div ref={dialogRef} role="dialog" aria-label={t("share.title", "Share SHOS")} tabIndex={0} style={{ position: "fixed", inset: 0, paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", background: darkMode ? DARK.bg : NEUTRAL.bg, zIndex: 220, overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: darkMode ? DARK.bg : NEUTRAL.bg, borderBottom: "1px solid " + (darkMode ? DARK.border : NEUTRAL.border) }}><div aria-hidden="true" data-notch-band="1" style={{ position: "absolute", left: 0, right: 0, bottom: "100%", height: "env(safe-area-inset-top)", background: darkMode ? DARK.bg : NEUTRAL.bg, pointerEvents: "none" }} />
        <ChevronLeft size={22} color={darkMode ? DARK.textPrimary : NEUTRAL.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} role="button" tabIndex={0} aria-label={t("common.back", "Back")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); } }} />
        <h1 style={{ ...TYPE.subScreenTitle, margin: 0, color: darkMode ? DARK.textPrimary : NEUTRAL.textPrimary }}>{t("share.title", "Share SHOS")}</h1>
      </div>
      <div style={isDesktopWidth ? { padding: 16, maxWidth: 480, margin: "0 auto" } : { padding: 16 }}>
        <p style={{ fontSize: 13, color: darkMode ? DARK.textSecondary : NEUTRAL.textSecondary, lineHeight: 1.5, marginBottom: 16 }}>
          {t("share.intro", "Share SHOS with someone: scan a code or send the link. Everything stays on the device — no accounts, no cloud.")}
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {card(t("share.android", "Android APK"), t("share.androidSub", "Scan, then tap to download the latest debug APK. Updates install in place."), BASE + "share-qr-apk.png", "https://github.com/drwho2001/SHOS-V2/releases/latest", "github.com/drwho2001/SHOS-V2/releases/latest")}
          {card(t("share.web", "Web app (PWA)"), t("share.webSub", "Scan to open SHOS in the browser. Install from there — it auto-updates to the latest deploy."), BASE + "share-qr-web.png", "https://drwho2001.github.io/SHOS-V2/", "drwho2001.github.io/SHOS-V2/")}
        </div>
        <button onClick={shareLink} style={{ marginTop: 16, width: "100%", padding: "12px 16px", borderRadius: 999, border: "none", background: ACCENTS.home, color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {t("share.shareLink", "Share link")}
        </button>
        <div style={{ fontSize: 11, color: darkMode ? DARK.textDisabled : NEUTRAL.textDisabled, textAlign: "center", marginTop: 16 }}>
          {t("share.footer", "Local-first — nothing here leaves the device unless you choose to export or share it.")}
        </div>
      </div>
    </div>
  );
}

export default ShareScreen;
