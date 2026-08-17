import { useCallback, useEffect, useState } from "react";
import {
  getMedicationAdherence,
  getMedicationSchedule,
  listMedications,
} from "@/services/medicationService";
import type { Medication, MedicationAdherence, MedicationScheduleItem } from "@/types/medication";
import type { AppError } from "@/types/api";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export interface MedicationsSummary {
  loading: boolean;
  error: string | null;
  medications: Medication[];
  todaySchedule: MedicationScheduleItem[];
  adherence: MedicationAdherence | null;
  refresh: () => Promise<void>;
}

/** Lightweight shared loader for Medication page and Dashboard medication widgets. */
export function useMedications(): MedicationsSummary {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<MedicationScheduleItem[]>([]);
  const [adherence, setAdherence] = useState<MedicationAdherence | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const today = todayISO();
      const from = daysAgoISO(29);
      const [sched, list, adh] = await Promise.all([
        getMedicationSchedule({ date_from: today, date_to: today }),
        listMedications({ page: 1, page_size: 50 }),
        getMedicationAdherence({ date_from: from, date_to: today }),
      ]);
      setTodaySchedule(sched);
      setMedications(list.items);
      setAdherence(adh);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr?.message || "Medication information could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, medications, todaySchedule, adherence, refresh };
}
