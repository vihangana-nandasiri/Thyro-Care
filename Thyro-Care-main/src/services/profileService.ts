import { api } from "@/services/api";
import type { PatientProfileResponse, PatientProfileUpdateRequest } from "@/types/profile";
import { toAppError } from "@/utils/apiError";

export async function getMyProfile(): Promise<PatientProfileResponse> {
  try {
    const { data } = await api.get<PatientProfileResponse>("/profiles/me");
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateMyProfile(
  payload: PatientProfileUpdateRequest,
): Promise<PatientProfileResponse> {
  try {
    const { data } = await api.patch<PatientProfileResponse>("/profiles/me", payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
