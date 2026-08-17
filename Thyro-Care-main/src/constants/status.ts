export const severityLabels = [
  "",
  "Mild",
  "Mild-Moderate",
  "Moderate",
  "Severe",
  "Critical",
] as const;

export const moodLabels = ["Very Low", "Low", "Neutral", "Good", "Great"] as const;

export const appointmentStatusLabels = {
  upcoming: "upcoming",
  scheduled: "scheduled",
  completed: "completed",
} as const;

export const tshStatusLabels = {
  optimal: "optimal",
  normal: "normal",
  high: "high",
} as const;

export const iodineSeverityLabels = {
  high: "High iodine",
  medium: "Moderate",
  low: "Low risk",
} as const;
