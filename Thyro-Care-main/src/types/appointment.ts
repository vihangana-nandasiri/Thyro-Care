/** Appointment types aligned with backend enums. */

export type AppointmentStatus = "upcoming" | "completed" | "missed" | "cancelled";

export type AppointmentType =
  | "tsh_test"
  | "blood_test"
  | "doctor_consultation"
  | "ultrasound"
  | "rai_follow_up"
  | "medication_review"
  | "general_follow_up"
  | "other";

export type AppointmentLocationType = "in_person" | "telehealth" | "phone" | "other";

export interface Appointment {
  id: string;
  appointment_type: AppointmentType;
  title: string;
  scheduled_start: string;
  scheduled_end: string | null;
  timezone: string;
  location: string | null;
  location_type: AppointmentLocationType | null;
  provider_name: string | null;
  notes: string | null;
  status: AppointmentStatus;
  completed_at: string | null;
  cancelled_at: string | null;
  reminder_offsets_minutes: number[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface AppointmentCreateRequest {
  appointment_type: AppointmentType;
  title: string;
  scheduled_start: string;
  scheduled_end?: string | null;
  timezone: string;
  location?: string | null;
  location_type?: AppointmentLocationType | null;
  provider_name?: string | null;
  notes?: string | null;
  status?: AppointmentStatus;
  reminder_offsets_minutes?: number[];
}

export interface AppointmentUpdateRequest extends Partial<AppointmentCreateRequest> {
  expected_version: number;
}

export interface AppointmentStatusUpdateRequest {
  status: AppointmentStatus;
  expected_version: number;
}

export interface AppointmentCalendarItem {
  appointment_id: string;
  appointment_type: AppointmentType;
  title: string;
  scheduled_start: string;
  scheduled_end: string | null;
  local_date: string;
  local_start_time: string;
  local_end_time: string | null;
  timezone: string;
  status: AppointmentStatus;
  location: string | null;
  provider_name: string | null;
}

export interface AppointmentListResponse {
  items: Appointment[];
  page: number;
  page_size: number;
  total: number;
}

export interface AppointmentFormValues {
  appointment_type: AppointmentType;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location: string;
  location_type: AppointmentLocationType | "";
  provider_name: string;
  notes: string;
  status: AppointmentStatus;
  reminder_offsets: string;
}

export interface AppointmentFilters {
  status?: AppointmentStatus;
  appointment_type?: AppointmentType;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export const APPOINTMENT_TYPE_OPTIONS: { value: AppointmentType; label: string }[] = [
  { value: "tsh_test", label: "TSH test" },
  { value: "blood_test", label: "Blood test" },
  { value: "doctor_consultation", label: "Doctor consultation" },
  { value: "ultrasound", label: "Ultrasound" },
  { value: "rai_follow_up", label: "RAI follow-up" },
  { value: "medication_review", label: "Medication review" },
  { value: "general_follow_up", label: "General follow-up" },
  { value: "other", label: "Other" },
];

export const LOCATION_TYPE_OPTIONS: { value: AppointmentLocationType; label: string }[] = [
  { value: "in_person", label: "In person" },
  { value: "telehealth", label: "Telehealth" },
  { value: "phone", label: "Phone" },
  { value: "other", label: "Other" },
];
