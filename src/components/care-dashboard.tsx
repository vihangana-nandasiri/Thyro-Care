"use client";
import Link from "next/link";
import {
  ArrowRight,
  Activity,
  Pill,
  FileText,
  MessageCircle,
  BookOpen,
  Users,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import { useT } from "@/lib/i18n/context";
import { experience } from "@/lib/i18n/experience";
export function CareDashboard({
  role,
  name,
}: {
  role: "patient" | "doctor" | "admin";
  name?: string;
}) {
  const { lang, t } = useT();
  const x = (key: Parameters<typeof experience>[1]) => experience(lang, key);
  const cards =
    role === "patient"
      ? [
          { href: "chat", icon: MessageCircle, title: x("assistant") },
          { href: "medications", icon: Pill, title: t("nav.medications") },
          { href: "symptoms/new", icon: Activity, title: t("nav.symptoms") },
          { href: "reports", icon: FileText, title: t("nav.reports") },
          { href: "resources", icon: BookOpen, title: x("resources") },
        ]
      : role === "doctor"
        ? [
            { href: "patients", icon: Users, title: t("nav.patients") },
            {
              href: "review-queue",
              icon: ClipboardCheck,
              title: t("nav.reviewQueue"),
            },
            { href: "resources", icon: BookOpen, title: x("resources") },
          ]
        : [
            { href: "accounts", icon: Users, title: t("nav.accounts") },
            { href: "knowledge", icon: BookOpen, title: t("nav.knowledge") },
            { href: "resources", icon: ClipboardCheck, title: x("curate") },
            { href: "audit", icon: ShieldCheck, title: t("nav.audit") },
          ];
  return (
    <div className="compact-dashboard">
      <div className="page-heading">
        <h1>
          {x("welcome")}
          {name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
      </div>
      <div className="compact-actions">
        {cards.map((c) => (
          <Link
            href={`/${role}/${c.href}`}
            className="compact-action"
            key={c.href}
          >
            <span className="shortcut-icon">
              <c.icon size={23} />
            </span>
            <strong>{c.title}</strong>
            <ArrowRight size={17} />
          </Link>
        ))}
      </div>
    </div>
  );
}
