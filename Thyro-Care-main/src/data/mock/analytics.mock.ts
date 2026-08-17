import { BLUE, TEAL, GREEN, AMBER } from "@/constants/colors";

export const mockWeeklyHealthData = [
  { day: "Mon", score: 78, mood: 3, meds: 1 },
  { day: "Tue", score: 82, mood: 4, meds: 1 },
  { day: "Wed", score: 79, mood: 3, meds: 1 },
  { day: "Thu", score: 85, mood: 4, meds: 1 },
  { day: "Fri", score: 88, mood: 5, meds: 1 },
  { day: "Sat", score: 84, mood: 4, meds: 1 },
  { day: "Sun", score: 87, mood: 4, meds: 0 },
];

export const mockDashboardWeekData = [
  { day: "Mon", score: 78 },
  { day: "Tue", score: 82 },
  { day: "Wed", score: 79 },
  { day: "Thu", score: 85 },
  { day: "Fri", score: 88 },
  { day: "Sat", score: 84 },
  { day: "Sun", score: 87 },
];

export const mockWellnessBreakdown = [
  { name: "Medication", value: 94, color: BLUE },
  { name: "Diet", value: 78, color: TEAL },
  { name: "Exercise", value: 62, color: GREEN },
  { name: "Sleep", value: 85, color: AMBER },
];

export const mockMoodEmojis = ["😔", "😕", "😐", "🙂", "😊"];

export const mockProgressStats = [
  { label: "Streak", value: "12 days", icon: "🔥" },
  { label: "Chat Sessions", value: "12 this week", icon: "💬" },
  { label: "Symptoms Logged", value: "4 this week", icon: "📋" },
  { label: "Medications", value: "94% taken", icon: "💊" },
];

export const mockHealthScore = {
  value: 87,
  max: 100,
  deltaLabel: "↑ +5 points from last week · Excellent progress!",
};
