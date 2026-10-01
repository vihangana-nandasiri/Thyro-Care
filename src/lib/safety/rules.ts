export const SAFETY_RULE_VERSION = 1;

export type SafetyLevel = "routine" | "monitor" | "urgent" | "emergency";

/**
 * Structured yes/no flags only. `notes` exists so a patient can add
 * context, but assessSafety below never reads it — free text must never
 * drive the safety classification (FR-05.7).
 */
export interface SafetyAnswers {
  severeBreathingDifficulty?: boolean;
  suddenNeckSwelling?: boolean;
  severeUncontrolledBleeding?: boolean;
  chestPainOrPalpitations?: boolean;
  severeMuscleCrampsOrTingling?: boolean;
  moderateSwallowingDifficulty?: boolean;
  feverOver38?: boolean;
  persistentHoarsenessOrVoiceChange?: boolean;
  woundRednessOrDischarge?: boolean;
  notes?: string;
}

const EMERGENCY_KEYS = [
  "severeBreathingDifficulty",
  "suddenNeckSwelling",
  "severeUncontrolledBleeding",
  "chestPainOrPalpitations",
] as const satisfies readonly (keyof SafetyAnswers)[];

const URGENT_KEYS = [
  "severeMuscleCrampsOrTingling",
  "moderateSwallowingDifficulty",
  "feverOver38",
] as const satisfies readonly (keyof SafetyAnswers)[];

const MONITOR_KEYS = [
  "persistentHoarsenessOrVoiceChange",
  "woundRednessOrDischarge",
] as const satisfies readonly (keyof SafetyAnswers)[];

/**
 * Deterministic, versioned lookup — no AI/LLM call, no string matching on
 * `notes`. Emergency always wins over lower levels (FR-05.4).
 */
export function assessSafety(answers: SafetyAnswers): SafetyLevel {
  if (EMERGENCY_KEYS.some((k) => answers[k] === true)) return "emergency";
  if (URGENT_KEYS.some((k) => answers[k] === true)) return "urgent";
  if (MONITOR_KEYS.some((k) => answers[k] === true)) return "monitor";
  return "routine";
}

export const SAFETY_QUESTIONS: { key: keyof SafetyAnswers; label: string; level: SafetyLevel }[] = [
  { key: "severeBreathingDifficulty", label: "Severe difficulty breathing", level: "emergency" },
  { key: "suddenNeckSwelling", label: "Sudden or rapidly worsening neck swelling", level: "emergency" },
  { key: "severeUncontrolledBleeding", label: "Severe bleeding that won't stop", level: "emergency" },
  { key: "chestPainOrPalpitations", label: "Chest pain or a racing/irregular heartbeat", level: "emergency" },
  { key: "severeMuscleCrampsOrTingling", label: "Severe muscle cramps, spasms, or tingling around your mouth or fingers", level: "urgent" },
  { key: "moderateSwallowingDifficulty", label: "Noticeable difficulty swallowing", level: "urgent" },
  { key: "feverOver38", label: "Fever over 38°C (100.4°F)", level: "urgent" },
  { key: "persistentHoarsenessOrVoiceChange", label: "Persistent hoarseness or voice change", level: "monitor" },
  { key: "woundRednessOrDischarge", label: "Redness, warmth, or discharge at the incision site", level: "monitor" },
];
