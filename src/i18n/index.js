import React, { createContext, useContext, useMemo, useState } from "react";
import en from "./en.json";

const translations = { en };
const I18nContext = createContext({ lang: "en", t: (key) => key });

export function I18nProvider({ children, defaultLang = "en" }) {
  const [lang, setLang] = useState(() => localStorage.getItem("shos_lang") || defaultLang);
  const t = useMemo(() => {
    return (key, fallback) => {
      const parts = key.split(".");
      let cur = translations[lang] || translations.en;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else { cur = undefined; break; }
      }
      if (typeof cur === "string") return cur;
      if (fallback !== undefined) return fallback;
      return key;
    };
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang: (l) => { localStorage.setItem("shos_lang", l); setLang(l); }, t }), [lang, t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}

