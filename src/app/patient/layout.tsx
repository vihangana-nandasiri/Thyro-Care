import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";

const navItems: NavItem[] = [
  { href: "/patient/dashboard", labelKey: "nav.dashboard" },
  { href: "/patient/medications", labelKey: "nav.medications" },
  { href: "/patient/symptoms", labelKey: "nav.symptoms" },
  { href: "/patient/reports", labelKey: "nav.reports" },
  { href: "/patient/profile", labelKey: "nav.profile" },
];

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "patient") redirect("/login");

  return (
    <DashboardShell navItems={navItems}>
      {children}
    </DashboardShell>
  );
}
