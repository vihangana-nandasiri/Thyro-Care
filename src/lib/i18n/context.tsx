"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { dictionaries, type I18nKey, type Lang } from "./config";

export type { I18nKey, Lang } from "./config";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `lang=${next}; path=/; max-age=31536000`;
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: I18nKey) => dictionaries[lang][key] ?? dictionaries.en[key],
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}
