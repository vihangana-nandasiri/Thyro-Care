import { api } from "@/services/api";
import type {
  Symptom,
  SymptomCreateRequest,
  SymptomCreateResponse,
  SymptomFilters,
  SymptomListResponse,
  SymptomSafetyAnswers,
  SymptomSafetyAssessment,
  SymptomStatusUpdateRequest,
  SymptomUpdateRequest,
} from "@/types/symptom";
import { toAppError } from "@/utils/apiError";

export async function listSymptoms(params?: SymptomFilters): Promise<SymptomListResponse> {
  try {
    const { data } = await api.get<SymptomListResponse>("/symptoms", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getSymptom(id: string): Promise<Symptom> {
  try {
    const { data } = await api.get<Symptom>(`/symptoms/${id}`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createSymptom(payload: SymptomCreateRequest): Promise<SymptomCreateResponse> {
  try {
    const { data } = await api.post<SymptomCreateResponse>("/symptoms", payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateSymptom(
  id: string,
  payload: SymptomUpdateRequest,
): Promise<Symptom | SymptomCreateResponse> {
  try {
    const { data } = await api.patch<Symptom | SymptomCreateResponse>(`/symptoms/${id}`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateSymptomStatus(
  id: string,
  payload: SymptomStatusUpdateRequest,
): Promise<Symptom> {
  try {
    const { data } = await api.patch<Symptom>(`/symptoms/${id}/status`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteSymptom(id: string): Promise<void> {
  try {
    await api.delete(`/symptoms/${id}`);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getActiveSymptoms(): Promise<Symptom[]> {
  try {
    const { data } = await api.get<Symptom[]>("/symptoms/active");
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function runSafetyCheck(
  answers: SymptomSafetyAnswers,
): Promise<SymptomSafetyAssessment> {
  try {
    const { data } = await api.post<SymptomSafetyAssessment>("/symptoms/safety-check", answers);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
