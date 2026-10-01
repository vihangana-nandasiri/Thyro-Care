import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/doctor/dashboard", labelKey: "nav.dashboard" },
  { href: "/doctor/alerts", labelKey: "nav.alerts" },
  { href: "/doctor/patients", labelKey: "nav.patients" },
  { href: "/doctor/review-queue", labelKey: "nav.reviewQueue" },
];

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "doctor") redirect("/login");

  return <DashboardShell navItems={navItems}>{children}</DashboardShell>;
}
