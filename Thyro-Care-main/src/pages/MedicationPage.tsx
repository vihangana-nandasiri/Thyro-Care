import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, Badge, Btn, Input, LoadingState, ErrorState } from "@/components/common";
import { MedicationCard } from "@/components/medication";
import { TEAL, GREEN, GRAY } from "@/constants/colors";
import { medicationFormSchema, type MedicationFormSchemaValues } from "@/schemas/medicationSchemas";
import {
  createMedication,
  deleteMedication,
  getMedication,
  logMedicationDose,
  updateMedication,
} from "@/services/medicationService";
import {
  FREQUENCY_OPTIONS,
  type Medication,
  type MedicationScheduleItem,
} from "@/types/medication";
import type { AppError } from "@/types/api";
import { useToast } from "@/hooks/useToast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useMedications } from "@/hooks/useMedications";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function defaultFormValues(): MedicationFormSchemaValues {
  return {
    name: "",
    dosage_text: "",
    frequency: "once_daily",
    reminder_times: "07:00",
    instructions: "",
    start_date: todayISO(),
    end_date: "",
    status: "active",
    prescribed_by_text: "",
    notes: "",
    timezone: browserTimezone(),
  };
}

function medicationToForm(med: Medication): MedicationFormSchemaValues {
  return {
    name: med.name,
    dosage_text: med.dosage_text,
    frequency: med.frequency,
    reminder_times: med.reminder_times.join(", "),
    instructions: med.instructions ?? "",
    start_date: med.start_date,
    end_date: med.end_date ?? "",
    status: med.status,
    prescribed_by_text: med.prescribed_by_text ?? "",
    notes: med.notes ?? "",
    timezone: med.timezone,
  };
}

export function MedicationPage() {
  useDocumentTitle("Medications");
  const { success, error: showError } = useToast();
  const {
    loading,
    error: loadError,
    medications,
    todaySchedule,
    adherence,
    refresh,
  } = useMedications();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MedicationFormSchemaValues>({
    resolver: zodResolver(medicationFormSchema),
    defaultValues: defaultFormValues(),
  });

  const { ref: nameRegisterRef, ...nameRegisterRest } = register("name");

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    setConflict(false);
    reset(defaultFormValues());
    window.setTimeout(() => addTriggerRef.current?.focus(), 0);
  }, [reset]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [modalOpen, closeModal]);

  const openCreate = () => {
    setEditing(null);
    setConflict(false);
    reset(defaultFormValues());
    setModalOpen(true);
  };

  const openEdit = (med: Medication) => {
    setEditing(med);
    setConflict(false);
    reset(medicationToForm(med));
    setModalOpen(true);
  };

  const takenCount = useMemo(
    () => todaySchedule.filter((s) => s.log_status === "taken").length,
    [todaySchedule],
  );

  const adherenceChart = useMemo(() => {
    if (!adherence || adherence.total_eligible === 0) {
      return [
        { label: "Taken", pct: 0 },
        { label: "Missed", pct: 0 },
        { label: "Skipped", pct: 0 },
        { label: "Pending", pct: 0 },
      ];
    }
    const base = adherence.total_eligible + adherence.skipped_count;
    const denom = base > 0 ? base : 1;
    return [
      { label: "Taken", pct: Math.round((adherence.taken_count / denom) * 100) },
      { label: "Missed", pct: Math.round((adherence.missed_count / denom) * 100) },
      { label: "Skipped", pct: Math.round((adherence.skipped_count / denom) * 100) },
      { label: "Pending", pct: Math.round((adherence.unlogged_count / denom) * 100) },
    ];
  }, [adherence]);

  const recordDose = async (
    item: MedicationScheduleItem,
    status: "taken" | "missed" | "skipped",
  ) => {
    const key = `${item.medication_id}:${item.scheduled_for}`;
    if (busyKey) return;
    setBusyKey(key);
    try {
      await logMedicationDose(item.medication_id, {
        scheduled_for: item.scheduled_for,
        status,
        note: null,
      });
      success("Dose status recorded.");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(
          "This dose status has already been recorded. Refresh the schedule to view the latest status.",
        );
        await refresh();
      } else if (appErr?.status === 404) {
        showError("This medication is no longer available.");
      } else {
        showError(appErr?.message || "Unable to record dose status.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const onSave = async (values: MedicationFormSchemaValues) => {
    if (saving) return;
    setSaving(true);
    setConflict(false);
    try {
      const times = (values.reminder_times || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        name: values.name,
        dosage_text: values.dosage_text,
        frequency: values.frequency,
        reminder_times: times,
        instructions: values.instructions || null,
        start_date: values.start_date,
        end_date: values.end_date || null,
        status: values.status,
        prescribed_by_text: values.prescribed_by_text || null,
        notes: values.notes || null,
        timezone: values.timezone,
      };
      if (editing) {
        await updateMedication(editing.id, {
          ...payload,
          expected_version: editing.version,
        });
        success("Medication updated");
      } else {
        await createMedication(payload);
        success("Medication saved");
      }
      closeModal();
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        setConflict(true);
        showError(
          "Medication information was updated elsewhere. Reload the latest record before saving.",
        );
      } else if (appErr?.status === 404) {
        showError("This medication is no longer available.");
        closeModal();
        await refresh();
      } else {
        showError(appErr?.message || "Unable to save medication.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (med: Medication) => {
    if (!window.confirm("Remove this medication from your list?")) return;
    try {
      await deleteMedication(med.id);
      success("Medication removed");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 404) {
        showError("This medication is no longer available.");
        await refresh();
      } else {
        showError(appErr?.message || "Unable to remove medication.");
      }
    }
  };

  if (loading) return <LoadingState message="Loading medications…" />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load medications"
        message={loadError}
        onRetry={() => void refresh()}
      />
    );
  }

  const adherencePct = adherence?.adherence_percentage ?? null;

  return (
    <>
      <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Medication information is for tracking purposes only. Follow your healthcare provider’s
        instructions. Do not change or stop medication without professional advice.
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2
              className="text-lg font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Today&apos;s Medications
            </h2>
            <div className="flex items-center gap-2">
              <Badge color="green">
                {takenCount} of {todaySchedule.length} taken
              </Badge>
              <Btn ref={addTriggerRef} size="sm" type="button" onClick={openCreate}>
                <Plus className="w-4 h-4" aria-hidden="true" /> Add
              </Btn>
            </div>
          </div>

          {todaySchedule.length === 0 ? (
            <Card>
              <p className="text-sm text-muted-foreground">
                No scheduled doses for today. Add a medication with reminder times, or check
                as-needed medications in your list.
              </p>
            </Card>
          ) : (
            todaySchedule.map((item) => (
              <MedicationCard
                key={`${item.medication_id}-${item.scheduled_for}`}
                name={item.medication_name}
                dose={item.dosage_text}
                time={item.scheduled_local_time}
                instruction={null}
                logStatus={item.log_status}
                busy={busyKey === `${item.medication_id}:${item.scheduled_for}`}
                onTaken={() => void recordDose(item, "taken")}
                onMissed={() => void recordDose(item, "missed")}
                onSkipped={() => void recordDose(item, "skipped")}
              />
            ))
          )}

          {todaySchedule.some((s) => s.log_status === "missed") ? (
            <div className="rounded-2xl p-4 border border-amber-200 bg-amber-50 flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-amber-800">Missed dose recorded</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  A missed dose was logged for tracking only. Follow your healthcare provider’s
                  guidance about what to do next — this app does not provide dosing advice.
                </p>
              </div>
            </div>
          ) : null}

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Your medications
            </h3>
            {medications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No medications saved yet.</p>
            ) : (
              <ul className="space-y-3">
                {medications.map((med) => (
                  <li
                    key={med.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-sm text-foreground">{med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.dosage_text} · {med.frequency.replaceAll("_", " ")} · {med.status}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Btn type="button" size="sm" variant="ghost" onClick={() => openEdit(med)}>
                        Edit
                      </Btn>
                      <Btn
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void onDelete(med)}
                      >
                        Remove
                      </Btn>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3
              className="font-bold text-foreground mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Adherence Rate
            </h3>
            <div
              className="text-4xl font-extrabold mb-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: GREEN }}
            >
              {adherencePct === null ? "—" : `${Math.round(adherencePct)}%`}
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Last 30 days — tracking metric only, not a clinical assessment.
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={adherenceChart} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: GRAY }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar dataKey="pct" fill={TEAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Tracking tips
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Log doses as Taken, Missed, or Skipped for your own records.</p>
              <p>As-needed medications do not generate automatic schedules.</p>
              <p>Refills and pharmacy requests are not available in this phase.</p>
            </div>
          </Card>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 border-0"
            aria-label="Close dialog"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit medication" : "Add medication"}
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border p-5 shadow-xl"
          >
            <h3
              className="text-lg font-bold text-foreground mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {editing ? "Edit medication" : "Add medication"}
            </h3>
            {conflict ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Medication information was updated elsewhere. Reload the latest record before
                saving.
                <div className="mt-2">
                  <Btn
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await refresh();
                        if (editing) {
                          const latest = await getMedication(editing.id);
                          openEdit(latest);
                        }
                      } catch {
                        showError("This medication is no longer available.");
                        closeModal();
                        await refresh();
                      }
                    }}
                  >
                    Reload
                  </Btn>
                </div>
              </div>
            ) : null}
            <form className="space-y-3" onSubmit={handleSubmit(onSave)} noValidate>
              <Input
                label="Medication name"
                error={errors.name?.message}
                {...nameRegisterRest}
                ref={(el) => {
                  nameRegisterRef(el);
                  firstFieldRef.current = el;
                }}
              />
              <Input
                label="Dosage text"
                error={errors.dosage_text?.message}
                {...register("dosage_text")}
              />
              <div className="space-y-1.5">
                <label htmlFor="frequency" className="block text-sm font-semibold">
                  Frequency
                </label>
                <select
                  id="frequency"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                  {...register("frequency")}
                >
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Reminder times (HH:mm, comma-separated)"
                error={errors.reminder_times?.message}
                {...register("reminder_times")}
              />
              <Input
                label="Start date"
                type="date"
                error={errors.start_date?.message}
                {...register("start_date")}
              />
              <Input
                label="End date (optional)"
                type="date"
                error={errors.end_date?.message}
                {...register("end_date")}
              />
              <div className="space-y-1.5">
                <label htmlFor="status" className="block text-sm font-semibold">
                  Status
                </label>
                <select
                  id="status"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                  {...register("status")}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <Input
                label="Timezone (IANA)"
                error={errors.timezone?.message}
                {...register("timezone")}
              />
              <Input label="Instructions" {...register("instructions")} />
              <Input label="Prescribed by" {...register("prescribed_by_text")} />
              <Input label="Notes" {...register("notes")} />
              <div className="flex gap-2 pt-2">
                <Btn type="submit" size="sm" disabled={saving || conflict} aria-busy={saving}>
                  {saving ? "Saving…" : "Save"}
                </Btn>
                <Btn type="button" variant="ghost" size="sm" disabled={saving} onClick={closeModal}>
                  Cancel
                </Btn>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
