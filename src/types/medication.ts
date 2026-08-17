/** Medication types aligned with backend enums. */

export type MedicationStatus = "active" | "completed" | "discontinued";

export type MedicationLogStatus = "taken" | "missed" | "skipped";

export type MedicationFrequency =
  | "once_daily"
  | "twice_daily"
  | "three_times_daily"
  | "four_times_daily"
  | "weekly"
  | "as_needed"
  | "custom";

export interface Medication {
  id: string;
  name: string;
  dosage_text: string;
  frequency: MedicationFrequency;
  reminder_times: string[];
  instructions: string | null;
  start_date: string;
  end_date: string | null;
  status: MedicationStatus;
  prescribed_by_text: string | null;
  notes: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface MedicationCreateRequest {
  name: string;
  dosage_text: string;
  frequency: MedicationFrequency;
  reminder_times: string[];
  instructions?: string | null;
  start_date: string;
  end_date?: string | null;
  status?: MedicationStatus;
  prescribed_by_text?: string | null;
  notes?: string | null;
  timezone: string;
}

export interface MedicationUpdateRequest extends Partial<MedicationCreateRequest> {
  expected_version: number;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_for: string;
  recorded_at: string;
  status: MedicationLogStatus;
  note: string | null;
  created_at: string;
}

export interface MedicationLogRequest {
  scheduled_for: string;
  status: MedicationLogStatus;
  note?: string | null;
}

export interface MedicationScheduleItem {
  medication_id: string;
  medication_name: string;
  dosage_text: string;
  scheduled_for: string;
  scheduled_local_time: string;
  timezone: string;
  log_status: MedicationLogStatus | null;
  log_id: string | null;
}

export interface MedicationAdherence {
  adherence_percentage: number | null;
  total_eligible: number;
  taken_count: number;
  missed_count: number;
  skipped_count: number;
  unlogged_count: number;
  date_from: string;
  date_to: string;
}

export interface MedicationListResponse {
  items: Medication[];
  total: number;
  page: number;
  page_size: number;
}

export interface MedicationFormValues {
  name: string;
  dosage_text: string;
  frequency: MedicationFrequency;
  reminder_times: string;
  instructions: string;
  start_date: string;
  end_date: string;
  status: MedicationStatus;
  prescribed_by_text: string;
  notes: string;
  timezone: string;
}

export const FREQUENCY_OPTIONS: { value: MedicationFrequency; label: string }[] = [
  { value: "once_daily", label: "Once daily" },
  { value: "twice_daily", label: "Twice daily" },
  { value: "three_times_daily", label: "Three times daily" },
  { value: "four_times_daily", label: "Four times daily" },
  { value: "weekly", label: "Weekly" },
  { value: "as_needed", label: "As needed" },
  { value: "custom", label: "Custom" },
];
