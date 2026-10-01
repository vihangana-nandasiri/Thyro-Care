import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/admin/dashboard", labelKey: "nav.dashboard" },
  { href: "/admin/alerts", labelKey: "nav.alerts" },
  { href: "/admin/accounts", labelKey: "nav.accounts" },
  { href: "/admin/knowledge", labelKey: "nav.knowledge" },
  { href: "/admin/audit", labelKey: "nav.audit" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  return <DashboardShell navItems={navItems}>{children}</DashboardShell>;
}
