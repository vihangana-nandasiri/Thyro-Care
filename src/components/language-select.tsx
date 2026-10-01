"use client";
import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/context";
import { isLang, languageOptions } from "@/lib/i18n/config";
export function LanguageSelect() {
  const { t, lang, setLang } = useT();
  const router = useRouter();
  return (
    <label className="language-control">
      <Languages size={17} aria-hidden />
      <span className="sr-only">{t("language.toggle")}</span>
      <select
        aria-label={t("language.toggle")}
        value={lang}
        onChange={(e) => {
          if (isLang(e.target.value)) {
            setLang(e.target.value);
            router.refresh();
          }
        }}
      >
        {languageOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
