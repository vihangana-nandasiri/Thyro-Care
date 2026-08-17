/** Patient profile types aligned with backend enums (lowercase snake values). */

export type AgeRange =
  | "under_18"
  | "age_18_29"
  | "age_30_39"
  | "age_40_49"
  | "age_50_59"
  | "age_60_69"
  | "age_70_plus"
  | "prefer_not_to_say";

export type PreferredLanguage = "english" | "sinhala" | "tamil";

export type RAITreatmentStatus =
  | "not_planned"
  | "planned"
  | "in_progress"
  | "completed"
  | "not_applicable"
  | "unknown";

export type TreatmentStage =
  | "post_surgery"
  | "pre_rai"
  | "post_rai"
  | "follow_up"
  | "long_term_survivorship"
  | "unknown";

export interface PatientProfile {
  id: string;
  age_range: AgeRange | null;
  preferred_language: PreferredLanguage | null;
  surgery_date: string | null;
  rai_treatment_status: RAITreatmentStatus | null;
  treatment_stage: TreatmentStage | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  current_medication_summary: string | null;
  consent_accepted: boolean;
  consent_accepted_at: string | null;
  disclaimer_accepted: boolean;
  disclaimer_accepted_at: string | null;
  profile_completion_percentage: number;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface PatientProfileAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  account_status: string;
  email_verified: boolean;
  created_at: string;
}

export interface PatientProfileResponse {
  profile: PatientProfile;
  account: PatientProfileAccount;
}

export interface PatientProfileUpdateRequest {
  age_range?: AgeRange | null;
  preferred_language?: PreferredLanguage | null;
  surgery_date?: string | null;
  rai_treatment_status?: RAITreatmentStatus | null;
  treatment_stage?: TreatmentStage | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  current_medication_summary?: string | null;
  expected_version: number;
}

export interface ProfileFormValues {
  age_range: AgeRange | "";
  preferred_language: PreferredLanguage | "";
  surgery_date: string;
  rai_treatment_status: RAITreatmentStatus | "";
  treatment_stage: TreatmentStage | "";
  emergency_contact_name: string;
  emergency_contact_phone: string;
  current_medication_summary: string;
}

export const AGE_RANGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: "under_18", label: "Under 18" },
  { value: "age_18_29", label: "18–29" },
  { value: "age_30_39", label: "30–39" },
  { value: "age_40_49", label: "40–49" },
  { value: "age_50_59", label: "50–59" },
  { value: "age_60_69", label: "60–69" },
  { value: "age_70_plus", label: "70+" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const LANGUAGE_OPTIONS: { value: PreferredLanguage; label: string }[] = [
  { value: "english", label: "English" },
  { value: "sinhala", label: "Sinhala" },
  { value: "tamil", label: "Tamil" },
];

export const RAI_OPTIONS: { value: RAITreatmentStatus; label: string }[] = [
  { value: "not_planned", label: "Not planned" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "unknown", label: "Unknown" },
];

export const TREATMENT_STAGE_OPTIONS: { value: TreatmentStage; label: string }[] = [
  { value: "post_surgery", label: "Post-surgery" },
  { value: "pre_rai", label: "Pre-RAI" },
  { value: "post_rai", label: "Post-RAI" },
  { value: "follow_up", label: "Follow-up" },
  { value: "long_term_survivorship", label: "Long-term survivorship" },
  { value: "unknown", label: "Unknown" },
];
