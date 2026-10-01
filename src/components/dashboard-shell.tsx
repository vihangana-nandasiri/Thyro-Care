"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BellRing,
  BookOpen,
  ClipboardCheck,
  FileText,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { useT, type I18nKey } from "@/lib/i18n/context";
import { experience } from "@/lib/i18n/experience";
import { Brand } from "./brand";
import { LanguageSelect } from "./language-select";

export interface NavItem {
  href: string;
  labelKey: I18nKey;
}
const icons = {
  dashboard: LayoutDashboard,
  alerts: BellRing,
  medications: HeartPulse,
  symptoms: Activity,
  reports: FileText,
  profile: UserRound,
  patients: Users,
  accounts: Users,
  knowledge: BookOpen,
  audit: ShieldCheck,
  "review-queue": ClipboardCheck,
  chat: MessageCircle,
  resources: BookOpen,
};
export function DashboardShell({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const { t, lang } = useT();
  const x = (key: Parameters<typeof experience>[1]) => experience(lang, key);
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const role = pathname.split("/")[1] as "patient" | "doctor" | "admin";
  const items = navItems.map((i) => ({ ...i, label: t(i.labelKey) }));
  if (role === "patient")
    items.splice(1, 0, {
      href: "/patient/chat",
      labelKey: "nav.chat",
      label: x("assistant"),
    });
  items.splice(items.length - (role === "patient" ? 1 : 0), 0, {
    href: `/${role}/resources`,
    labelKey: "nav.knowledge",
    label: x(role === "admin" ? "curate" : "resources"),
  });
  const active = items.find(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/"),
  );
  return (
    <div className="app-frame">
      <a href="#main-content" className="skip-link">
        {x("explore")}
      </a>
      {open && (
        <button
          className="nav-scrim"
          aria-label={x("close")}
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`app-sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label={x("close")}
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="eyebrow sidebar-label">
          {x(role === "patient" ? "workspace" : "team")}
        </p>
        <nav aria-label={x("workspace")}>
          <ul className="nav-list">
            {items.map((item) => {
              const Icon =
                icons[item.href.split("/")[2] as keyof typeof icons] ||
                BookOpen;
              const selected = active?.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={selected ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`nav-item ${selected ? "selected" : ""}`}
                  >
                    <Icon size={19} strokeWidth={1.7} />
                    <span>{item.label}</span>
                    {selected && <span className="nav-dot" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="sidebar-bottom">
          {role === "patient" && <Link href="/emergency" className="emergency-link">
            <Activity size={17} />
            {x("emergency")}
            <ArrowUpRight size={15} />
          </Link>}
          <button
            className="nav-item logout"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut size={18} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <div className="topbar-title">
            <button
              className="mobile-only icon-button"
              onClick={() => setOpen(true)}
              aria-label={x("menu")}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb-brand">
              ThyroCare <span>/</span>
            </span>
            <span>{active?.label}</span>
          </div>
          <div className="topbar-controls">
            <LanguageSelect />
            <span className="role-avatar" title={t(`role.${role}`)}>
              <UserRound size={19} />
            </span>
            <span className="role-label">{t(`role.${role}`)}</span>
          </div>
        </header>
        <main
          id="main-content"
          className={`page-content ${pathname.endsWith("/chat") ? "chat-page-content" : ""}`}
        >
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} ThyroCare</span>
          <span>{x("chatNote")}</span>
        </footer>
      </div>
    </div>
  );
}
