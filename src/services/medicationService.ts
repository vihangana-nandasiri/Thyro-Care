import { api } from "@/services/api";
import type {
  Medication,
  MedicationAdherence,
  MedicationCreateRequest,
  MedicationListResponse,
  MedicationLog,
  MedicationLogRequest,
  MedicationScheduleItem,
  MedicationUpdateRequest,
} from "@/types/medication";
import { toAppError } from "@/utils/apiError";

export async function listMedications(params?: {
  status?: string;
  page?: number;
  page_size?: number;
}): Promise<MedicationListResponse> {
  try {
    const { data } = await api.get<MedicationListResponse>("/medications", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getMedication(id: string): Promise<Medication> {
  try {
    const { data } = await api.get<Medication>(`/medications/${id}`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createMedication(payload: MedicationCreateRequest): Promise<Medication> {
  try {
    const { data } = await api.post<Medication>("/medications", payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateMedication(
  id: string,
  payload: MedicationUpdateRequest,
): Promise<Medication> {
  try {
    const { data } = await api.patch<Medication>(`/medications/${id}`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteMedication(id: string): Promise<void> {
  try {
    await api.delete(`/medications/${id}`);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function logMedicationDose(
  medicationId: string,
  payload: MedicationLogRequest,
): Promise<MedicationLog> {
  try {
    const { data } = await api.post<MedicationLog>(`/medications/${medicationId}/logs`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function listMedicationLogs(medicationId: string): Promise<MedicationLog[]> {
  try {
    const { data } = await api.get<MedicationLog[]>(`/medications/${medicationId}/logs`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getMedicationSchedule(params: {
  date_from: string;
  date_to: string;
}): Promise<MedicationScheduleItem[]> {
  try {
    const { data } = await api.get<MedicationScheduleItem[]>("/medications/schedule", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getMedicationAdherence(params: {
  date_from: string;
  date_to: string;
}): Promise<MedicationAdherence> {
  try {
    const { data } = await api.get<MedicationAdherence>("/medications/adherence", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
