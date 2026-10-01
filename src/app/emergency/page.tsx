import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelect } from "@/components/language-select";
import { EmergencyActions } from "@/components/emergency-actions";
import { getServerT } from "@/lib/i18n/server";
import { experience } from "@/lib/i18n/experience";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "patient") redirect(`/${session.role}/dashboard`);
  const { lang, t } = await getServerT();
  return (
    <main className="landing">
      <header className="landing-header">
        <Brand />
        <LanguageSelect />
      </header>
      <section className="panel mx-auto my-20 max-w-2xl">
        <Activity size={35} className="text-red-800" />
        <h1 className="text-3xl mt-5 mb-5">{t("emergency.title")}</h1>
        <p>{t("emergency.body")}</p>
        <div className="my-6">
          <EmergencyActions />
        </div>
        <Link href="/patient/dashboard" className="button button-secondary">
          <ArrowLeft size={16} />
          {experience(lang, "back")}
        </Link>
      </section>
    </main>
  );
}
