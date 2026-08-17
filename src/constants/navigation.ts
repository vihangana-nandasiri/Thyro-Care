import {
  Home,
  MessageCircle,
  Pill,
  Salad,
  Activity,
  Calendar,
  TrendingUp,
  BookOpen,
  User,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import type { UserRole } from "@/types/auth";
import { ROUTES } from "./routes";

export type NavItem = {
  path: string;
  label: string;
  icon: typeof Home;
};

/** Patient clinical navigation — unchanged from earlier phases. */
export const navItems: NavItem[] = [
  { path: ROUTES.DASHBOARD, label: "Dashboard", icon: Home },
  { path: ROUTES.CHAT, label: "AI Chat", icon: MessageCircle },
  { path: ROUTES.MEDICATIONS, label: "Medication", icon: Pill },
  { path: ROUTES.DIET, label: "Diet Guide", icon: Salad },
  { path: ROUTES.SYMPTOMS, label: "Symptoms", icon: Activity },
  { path: ROUTES.FOLLOW_UPS, label: "Follow-up", icon: Calendar },
  { path: ROUTES.ANALYTICS, label: "Progress", icon: TrendingUp },
  { path: ROUTES.RESOURCES, label: "Resources", icon: BookOpen },
  { path: ROUTES.PROFILE, label: "Profile", icon: User },
];

/** Patient navigation alias — kept for readability at call sites. */
export const patientNavItems: NavItem[] = navItems;

/** Admin navigation (Phase 12) — knowledge governance only; no patient clinical nav. */
export const adminNavItems: NavItem[] = [
  { path: ROUTES.ADMIN_KNOWLEDGE, label: "Knowledge Management", icon: ClipboardList },
  { path: ROUTES.PROFILE, label: "Profile", icon: User },
];

/** Medical expert navigation (Phase 12) — review queue + library for restore/retire. */
export const medicalNavItems: NavItem[] = [
  { path: ROUTES.MEDICAL_REVIEW, label: "Review Queue", icon: ShieldCheck },
  { path: ROUTES.MEDICAL_KNOWLEDGE, label: "Knowledge Library", icon: ClipboardList },
  { path: ROUTES.PROFILE, label: "Profile", icon: User },
];

/** Returns the correct nav item set for a given authenticated role. */
export function getNavItemsForRole(role: UserRole | null | undefined): NavItem[] {
  if (role === "admin") return adminNavItems;
  if (role === "medical_expert") return medicalNavItems;
  return patientNavItems;
}
