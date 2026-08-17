import { api } from "@/services/api";
import type {
  Appointment,
  AppointmentCalendarItem,
  AppointmentCreateRequest,
  AppointmentFilters,
  AppointmentListResponse,
  AppointmentStatusUpdateRequest,
  AppointmentUpdateRequest,
} from "@/types/appointment";
import { toAppError } from "@/utils/apiError";

export async function listAppointments(
  params?: AppointmentFilters,
): Promise<AppointmentListResponse> {
  try {
    const { data } = await api.get<AppointmentListResponse>("/appointments", { params });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getAppointment(id: string): Promise<Appointment> {
  try {
    const { data } = await api.get<Appointment>(`/appointments/${id}`);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function createAppointment(payload: AppointmentCreateRequest): Promise<Appointment> {
  try {
    const { data } = await api.post<Appointment>("/appointments", payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateAppointment(
  id: string,
  payload: AppointmentUpdateRequest,
): Promise<Appointment> {
  try {
    const { data } = await api.patch<Appointment>(`/appointments/${id}`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function updateAppointmentStatus(
  id: string,
  payload: AppointmentStatusUpdateRequest,
): Promise<Appointment> {
  try {
    const { data } = await api.patch<Appointment>(`/appointments/${id}/status`, payload);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  try {
    await api.delete(`/appointments/${id}`);
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getAppointmentCalendar(params: {
  date_from: string;
  date_to: string;
}): Promise<AppointmentCalendarItem[]> {
  try {
    const { data } = await api.get<AppointmentCalendarItem[]>("/appointments/calendar", {
      params,
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getUpcomingAppointments(limit = 5): Promise<Appointment[]> {
  try {
    const { data } = await api.get<Appointment[]>("/appointments/upcoming", {
      params: { limit },
    });
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}
