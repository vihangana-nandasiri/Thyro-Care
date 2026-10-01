"use client";
import { useT } from "@/lib/i18n/context";
import { interfaceText } from "@/lib/i18n/interface";
export function AuthStory() {
  const { lang } = useT();
  return (
    <div>
      <h2>{interfaceText(lang, "authTitle")}</h2>
      <p>{interfaceText(lang, "authText")}</p>
    </div>
  );
}
