import { cookies } from "next/headers";
import { dictionaries, isLang, type I18nKey, type Lang } from "./config";

/** Server-component equivalent of useT() — reads the same `lang` cookie
 * that the client-side toggle writes, so SSR'd pages and the client shell
 * stay in sync without a hydration mismatch. */
export async function getServerT(): Promise<{ lang: Lang; t: (key: I18nKey) => string }> {
  const store = await cookies();
  const cookieLang = store.get("lang")?.value;
  const lang: Lang = isLang(cookieLang) ? cookieLang : "en";
  const dict = dictionaries[lang];
  return { lang, t: (key: I18nKey) => dict[key] ?? dictionaries.en[key] };
}
