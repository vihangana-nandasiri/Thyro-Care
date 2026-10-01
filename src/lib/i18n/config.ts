import en from "./dictionaries/en.json";
import si from "./dictionaries/si.json";
import ta from "./dictionaries/ta.json";

export type Lang = "en" | "si" | "ta";
export type I18nKey = keyof typeof en;

export const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, si, ta };

export const languageOptions: ReadonlyArray<{ value: Lang; label: string }> = [
  { value: "en", label: "English" },
  { value: "si", label: "සිංහල" },
  { value: "ta", label: "தமிழ்" },
];

export function isLang(value: string | undefined): value is Lang {
  return value === "en" || value === "si" || value === "ta";
}

export function localeForLang(lang: Lang): string {
  return lang === "si" ? "si-LK" : lang === "ta" ? "ta-LK" : "en-LK";
}
