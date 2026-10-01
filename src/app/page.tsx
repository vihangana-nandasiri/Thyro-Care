import Link from "next/link";
import {
  ArrowRight,
  HeartPulse,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LanguageSelect } from "@/components/language-select";
import { getServerT } from "@/lib/i18n/server";
import { experience } from "@/lib/i18n/experience";
export default async function Home() {
  const { lang, t } = await getServerT();
  const x = (key: Parameters<typeof experience>[1]) => experience(lang, key);
  return (
    <main className="landing">
      <header className="landing-header">
        <Brand />
        <div className="landing-actions">
          <LanguageSelect />
          <Link className="button button-secondary" href="/login">
            {x("signIn")}
            <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <section className="landing-hero">
        <div>
          <span className="eyebrow">{x("tagline")}</span>
          <h1>{x("landingTitle")}</h1>
          <p>{x("landingText")}</p>
          <div className="flex gap-3 flex-wrap">
            <Link className="button button-primary" href="/register">
              {x("getStarted")}
              <ArrowRight size={16} />
            </Link>
            <Link className="button button-secondary" href="/login">
              {x("signIn")}
            </Link>
          </div>
          <div className="mt-7 flex gap-2 items-center text-xs text-slate-600">
            <ShieldCheck size={15} />
            {x("secure")}
          </div>
        </div>
        <div className="landing-art">
          <div className="panel">
            <HeartPulse size={27} />
            <div>
              <strong>{t("nav.medications")}</strong>
              <small>{x("medicationsHint")}</small>
            </div>
          </div>
          <div className="panel">
            <MessageCircle size={27} />
            <div>
              <strong>{x("assistant")}</strong>
              <small>{x("care")}</small>
            </div>
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        <span>{x("chatNote")}</span>
      </footer>
    </main>
  );
}
