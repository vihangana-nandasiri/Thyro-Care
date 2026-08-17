import { useCallback, useEffect, useState } from "react";
import { getUpcomingAppointments, listAppointments } from "@/services/appointmentService";
import type { Appointment } from "@/types/appointment";
import type { AppError } from "@/types/api";

export interface AppointmentsSummary {
  loading: boolean;
  error: string | null;
  appointments: Appointment[];
  upcoming: Appointment[];
  refresh: () => Promise<void>;
}

export function useAppointments(): AppointmentsSummary {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, next] = await Promise.all([
        listAppointments({ page: 1, page_size: 50 }),
        getUpcomingAppointments(5),
      ]);
      setAppointments(list.items);
      setUpcoming(next);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr?.message || "Appointment information could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, appointments, upcoming, refresh };
}
