import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { languageLabels, translate, type Language } from "@/i18n/translations";

const LANGUAGE_STORAGE_KEY = "thyrocare-language";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "si" ? "si" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "si" : "en");
  }, [language, setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language === "si" ? "si" : "en";
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t: (key: string) => translate(key, language),
    }),
    [language, setLanguage, toggleLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === "en" ? "si" : "en";
  return (
    <button
      type="button"
      onClick={() => setLanguage(nextLanguage)}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={`Switch language to ${languageLabels[nextLanguage]}`}
      title={`Switch language to ${languageLabels[nextLanguage]}`}
    >
      <span className={language === "en" ? "text-primary" : "text-muted-foreground"}>EN</span>
      <span className="text-muted-foreground">/</span>
      <span className={language === "si" ? "text-primary" : "text-muted-foreground"}>සිං</span>
    </button>
  );
}
