import React, { createContext, useContext, useMemo, useState } from "react";
import en from "./en.json";

const translations = { en };
const I18nContext = createContext({ lang: "en", t: (key) => key });

export function I18nProvider({ children, defaultLang = "en" }) {
  const [lang, setLang] = useState(() => localStorage.getItem("shos_lang") || defaultLang);
  const t = useMemo(() => {
    return (key, fallbackOrVars, vars) => {
      let fallback;
      let variables = vars;
      if (fallbackOrVars && typeof fallbackOrVars === "object" && !Array.isArray(fallbackOrVars)) {
        variables = fallbackOrVars;
        fallback = undefined;
      } else {
        fallback = fallbackOrVars;
      }
      const parts = key.split(".");
      let cur = translations[lang] || translations.en;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in cur) cur = cur[p];
        else { cur = undefined; break; }
      }
      let result;
      if (typeof cur === "string") result = cur;
      else if (fallback !== undefined) result = fallback;
      else result = key;
      if (variables && typeof result === "string") {
        result = result.replace(/\{(\w+)\}/g, (_, name) =>
          Object.prototype.hasOwnProperty.call(variables, name) ? String(variables[name]) : `{${name}}`
        );
      }
      return result;
    };
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang: (l) => { localStorage.setItem("shos_lang", l); setLang(l); }, t }), [lang, t]);
  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useTranslation() {
  return useContext(I18nContext);
}
