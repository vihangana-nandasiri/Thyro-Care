import type { Metadata } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/lib/i18n/context";
import { isLang } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThyroCare AI",
  description:
    "Post-thyroidectomy survivorship support: medication tracking, symptom safety checks, and medically reviewed education.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const store = await cookies();
  const cookieLang = store.get("lang")?.value;
  const initialLang = isLang(cookieLang) ? cookieLang : "en";

  return (
    <html
      lang={initialLang}
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider initialLang={initialLang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
