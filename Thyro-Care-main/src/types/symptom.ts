/** Symptom types aligned with backend enums. */

export type SymptomSeverity = "mild" | "moderate" | "severe";
export type SymptomStatus = "active" | "improving" | "resolved";
export type SymptomFrequency = "once" | "occasional" | "daily" | "frequent" | "continuous";

export type SymptomType =
  | "fatigue"
  | "neck_pain"
  | "neck_swelling"
  | "voice_change"
  | "swallowing_difficulty"
  | "breathing_difficulty"
  | "palpitations"
  | "dizziness"
  | "numbness_or_tingling"
  | "muscle_cramping"
  | "temperature_sensitivity"
  | "sleep_difficulty"
  | "mood_change"
  | "digestive_change"
  | "weight_change"
  | "other";

export type SafetyLevel =
  | "routine_tracking"
  | "contact_healthcare_team"
  | "urgent_medical_review"
  | "emergency";

export interface SymptomSafetyAnswers {
  breathing_emergency: boolean;
  severe_chest_discomfort: boolean;
  loss_of_consciousness: boolean;
  severe_or_rapid_neck_swelling: boolean;
  unable_to_swallow: boolean;
  uncontrolled_bleeding: boolean;
  severe_new_confusion: boolean;
  rapidly_worsening_condition: boolean;
  feels_immediately_unsafe: boolean;
}

export interface SymptomSafetyAssessment {
  safety_level: SafetyLevel;
  matched_rule_codes: string[];
  headline: string;
  user_message: string;
  recommended_action: string;
  emergency_page_required: boolean;
  rule_version: string;
  evaluated_at: string;
  disclaimer: string;
}

export interface Symptom {
  id: string;
  symptom_type: SymptomType;
  custom_symptom_name: string | null;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  started_at: string;
  ended_at: string | null;
  timezone: string;
  status: SymptomStatus;
  description: string | null;
  notes: string | null;
  safety_level: SafetyLevel;
  safety_rule_version: string;
  safety_checked_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface SymptomCreateRequest {
  symptom_type: SymptomType;
  custom_symptom_name?: string | null;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  started_at: string;
  ended_at?: string | null;
  timezone: string;
  status?: SymptomStatus;
  description?: string | null;
  notes?: string | null;
  safety_answers: SymptomSafetyAnswers;
}

export interface SymptomUpdateRequest {
  symptom_type?: SymptomType;
  custom_symptom_name?: string | null;
  severity?: SymptomSeverity;
  frequency?: SymptomFrequency;
  started_at?: string;
  ended_at?: string | null;
  timezone?: string;
  status?: SymptomStatus;
  description?: string | null;
  notes?: string | null;
  safety_answers?: SymptomSafetyAnswers;
  expected_version: number;
}

export interface SymptomStatusUpdateRequest {
  status: SymptomStatus;
  ended_at?: string | null;
  expected_version: number;
}

export interface SymptomCreateResponse {
  symptom: Symptom;
  safety_assessment: SymptomSafetyAssessment;
}

export interface SymptomListResponse {
  items: Symptom[];
  page: number;
  page_size: number;
  total: number;
}

export interface SymptomFilters {
  status?: SymptomStatus;
  severity?: SymptomSeverity;
  symptom_type?: SymptomType;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface SymptomFormValues {
  symptom_type: SymptomType;
  custom_symptom_name: string;
  severity: SymptomSeverity;
  frequency: SymptomFrequency;
  started_at: string;
  ended_at: string;
  timezone: string;
  status: SymptomStatus;
  description: string;
  notes: string;
  safety_answers: SymptomSafetyAnswers;
}
