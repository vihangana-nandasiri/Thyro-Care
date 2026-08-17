import { useCallback, useEffect, useState } from "react";
import { getActiveSymptoms, listSymptoms } from "@/services/symptomService";
import type { Symptom } from "@/types/symptom";
import type { AppError } from "@/types/api";

export interface SymptomsSummary {
  loading: boolean;
  error: string | null;
  symptoms: Symptom[];
  active: Symptom[];
  refresh: () => Promise<void>;
}

export function useSymptoms(): SymptomsSummary {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [active, setActive] = useState<Symptom[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, act] = await Promise.all([
        listSymptoms({ page: 1, page_size: 50 }),
        getActiveSymptoms(),
      ]);
      setSymptoms(list.items);
      setActive(act);
    } catch (err) {
      const appErr = err as AppError;
      setError(appErr?.message || "Symptom information could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, symptoms, active, refresh };
}
