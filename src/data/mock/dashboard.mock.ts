/** Demo landing/dashboard/emergency datasets — not production clinical data. */
import {
  MessageCircle,
  Pill,
  Salad,
  Activity,
  Calendar,
  TrendingUp,
  BookOpen,
  User,
  Heart,
  Phone,
  Stethoscope,
} from "lucide-react";
import { BLUE, TEAL, GREEN, AMBER, RED, GRAY } from "@/constants/colors";
import type { Screen } from "@/types";

export const mockLandingFeatures = [
  {
    icon: MessageCircle,
    title: "AI Chat Support",
    desc: "24/7 intelligent guidance tailored to your recovery journey",
    color: BLUE,
  },
  {
    icon: Pill,
    title: "Medication Reminders",
    desc: "Never miss your Levothyroxine with smart, timely alerts",
    color: TEAL,
  },
  {
    icon: Salad,
    title: "Low-Iodine Diet Guide",
    desc: "Curated meal plans and food guidance for RAI therapy",
    color: GREEN,
  },
  {
    icon: Activity,
    title: "Symptom Checker",
    desc: "Track symptoms with structured safety awareness guidance",
    color: AMBER,
  },
  {
    icon: Calendar,
    title: "Follow-up Tracker",
    desc: "TSH tests, appointments, and blood work reminders",
    color: "#A78BFA",
  },
  {
    icon: TrendingUp,
    title: "Health Analytics",
    desc: "Track your progress with beautiful, intuitive dashboards",
    color: RED,
  },
];

export const mockLandingStats = [
  ["2,400+", "Patients Supported"],
  ["98%", "Satisfaction Rate"],
  ["24/7", "AI Availability"],
] as const;

export const mockDashboardCards: {
  id: Screen;
  label: string;
  icon: typeof MessageCircle;
  color: string;
  bg: string;
  value: string;
  sub: string;
}[] = [
  {
    id: "chat",
    label: "AI Chat",
    icon: MessageCircle,
    color: BLUE,
    bg: "#EFF6FF",
    value: "Ask anything",
    sub: "Available 24/7",
  },
  {
    id: "medication",
    label: "Medication",
    icon: Pill,
    color: TEAL,
    bg: "#F0FDFA",
    value: "100mcg due",
    sub: "in 2 hours",
  },
  {
    id: "diet",
    label: "Diet Guide",
    icon: Salad,
    color: GREEN,
    bg: "#F0FDF4",
    value: "Day 4 of RAI diet",
    sub: "3 meals planned",
  },
  {
    id: "symptoms",
    label: "Symptom Check",
    icon: Activity,
    color: AMBER,
    bg: "#FFFBEB",
    value: "No entries yet",
    sub: "Open Symptoms",
  },
  {
    id: "followup",
    label: "Follow-up",
    icon: Calendar,
    color: "#A78BFA",
    bg: "#F5F3FF",
    value: "TSH Test",
    sub: "in 8 days",
  },
  {
    id: "progress",
    label: "Health Progress",
    icon: TrendingUp,
    color: "#F472B6",
    bg: "#FDF2F8",
    value: "Score: 87/100",
    sub: "+5 this week",
  },
  {
    id: "education",
    label: "Resources",
    icon: BookOpen,
    color: "#F97316",
    bg: "#FFF7ED",
    value: "12 new articles",
    sub: "Updated today",
  },
  {
    id: "profile",
    label: "My Profile",
    icon: User,
    color: GRAY,
    bg: "#F9FAFB",
    value: "Sarah Johnson",
    sub: "9 months post-op",
  },
];

export const mockDashboardQuickStats = [
  { label: "Health Score", value: "87", unit: "/100", color: GREEN, icon: Heart },
  { label: "Medication Adherence", value: "94%", color: BLUE, icon: Pill },
  { label: "Days Post-Surgery", value: "271", color: TEAL, icon: Calendar },
  { label: "Chats This Week", value: "12", color: AMBER, icon: MessageCircle },
];

export const mockEmergencyCallOptions = [
  { label: "Call 911", sub: "Emergency Services", icon: Phone, color: "#DC2626" },
  {
    label: "Call Hospital",
    sub: "Seattle Medical Center\n+1 (206) 555-0101",
    icon: Stethoscope,
    color: "#B91C1C",
  },
  { label: "Call Doctor", sub: "Dr. Emily Chen\n+1 (206) 555-0202", icon: User, color: "#991B1B" },
];

export const mockEmergencyWarningSigns = [
  "Chest pain or pressure",
  "Severe difficulty breathing",
  "High fever above 103°F (39.4°C)",
  "Severe neck swelling or tightening",
  "Rapid or irregular heartbeat",
  "Sudden severe dizziness or fainting",
  "Signs of hypocalcemia (muscle spasms, tingling)",
  "Wound infection or excessive bleeding",
];

export const mockEmergencyContacts = [
  { name: "Michael Johnson", relation: "Spouse", phone: "+1 (555) 234-0001" },
  { name: "Dr. Emily Chen", relation: "Endocrinologist", phone: "+1 (206) 555-0202" },
  { name: "Anna Johnson", relation: "Sister", phone: "+1 (555) 234-0003" },
];
