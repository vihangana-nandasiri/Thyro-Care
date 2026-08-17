import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, CheckCircle, Calendar, AlertTriangle, X } from "lucide-react";
import { Card, Badge, Btn, Input, LoadingState, ErrorState } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import { mockTshHistory } from "@/data/mock";
import {
  appointmentFormSchema,
  type AppointmentFormSchemaValues,
} from "@/schemas/appointmentSchemas";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  updateAppointmentStatus,
} from "@/services/appointmentService";
import {
  APPOINTMENT_TYPE_OPTIONS,
  LOCATION_TYPE_OPTIONS,
  type Appointment,
  type AppointmentStatus,
} from "@/types/appointment";
import type { AppError } from "@/types/api";
import { useToast } from "@/hooks/useToast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAppointments } from "@/hooks/useAppointments";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultForm(): AppointmentFormSchemaValues {
  return {
    appointment_type: "general_follow_up",
    title: "",
    date: todayISO(),
    start_time: "09:00",
    end_time: "10:00",
    timezone: browserTimezone(),
    location: "",
    location_type: "in_person",
    provider_name: "",
    notes: "",
    status: "upcoming",
    reminder_offsets: "60, 1440",
  };
}

function toIsoLocal(date: string, time: string, _timezone: string): string {
  // Browser Date interprets as local wall time, then converts to UTC ISO for the API.
  const local = new Date(`${date}T${time}:00`);
  return local.toISOString();
}

function formatDisplay(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function typeLabel(value: string): string {
  return APPOINTMENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function FollowUpPage() {
  useDocumentTitle("Follow-ups");
  const { success, error: showError } = useToast();
  const { loading, error: loadError, appointments, upcoming, refresh } = useAppointments();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AppointmentFormSchemaValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: defaultForm(),
  });

  const closeModal = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setConflict(false);
    reset(defaultForm());
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeModal]);

  const nextAppointment = upcoming[0] ?? null;

  const timeline = useMemo(() => {
    return [...appointments].sort(
      (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
    );
  }, [appointments]);

  const openCreate = () => {
    setEditing(null);
    setConflict(false);
    reset(defaultForm());
    setOpen(true);
  };

  const openEdit = (appt: Appointment) => {
    setEditing(appt);
    setConflict(false);
    const start = new Date(appt.scheduled_start);
    const end = appt.scheduled_end ? new Date(appt.scheduled_end) : null;
    const datePart = start.toISOString().slice(0, 10);
    const startTime = start.toISOString().slice(11, 16);
    const endTime = end ? end.toISOString().slice(11, 16) : "";
    reset({
      appointment_type: appt.appointment_type,
      title: appt.title,
      date: datePart,
      start_time: startTime,
      end_time: endTime,
      timezone: appt.timezone,
      location: appt.location ?? "",
      location_type: appt.location_type ?? "",
      provider_name: appt.provider_name ?? "",
      notes: appt.notes ?? "",
      status: appt.status,
      reminder_offsets: appt.reminder_offsets_minutes.join(", "),
    });
    setOpen(true);
  };

  const onSave = async (values: AppointmentFormSchemaValues) => {
    if (saving) return;
    setSaving(true);
    setConflict(false);
    try {
      const offsets = (values.reminder_offsets || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => Number(v));
      const payload = {
        appointment_type: values.appointment_type,
        title: values.title,
        scheduled_start: toIsoLocal(values.date, values.start_time, values.timezone),
        scheduled_end:
          values.end_time && values.end_time.trim()
            ? toIsoLocal(values.date, values.end_time, values.timezone)
            : null,
        timezone: values.timezone,
        location: values.location || null,
        location_type: values.location_type || null,
        provider_name: values.provider_name || null,
        notes: values.notes || null,
        status: values.status,
        reminder_offsets_minutes: offsets,
      };
      if (editing) {
        await updateAppointment(editing.id, {
          ...payload,
          expected_version: editing.version,
        });
        success("Appointment updated");
      } else {
        await createAppointment(payload);
        success("Appointment saved");
      }
      closeModal();
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        setConflict(true);
        showError(
          "Appointment information was updated elsewhere. Reload the latest record before saving.",
        );
      } else if (appErr?.status === 404) {
        showError("This appointment is no longer available.");
        closeModal();
        await refresh();
      } else {
        showError(appErr?.message || "Unable to save appointment.");
      }
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (appt: Appointment, status: AppointmentStatus) => {
    if (busyId) return;
    if (status === "cancelled" && !window.confirm("Cancel this appointment?")) return;
    setBusyId(appt.id);
    try {
      await updateAppointmentStatus(appt.id, {
        status,
        expected_version: appt.version,
      });
      success(status === "cancelled" ? "Appointment cancelled." : "Appointment status updated.");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        showError(
          "Appointment information was updated elsewhere. Reload the latest record before saving.",
        );
        await refresh();
      } else if (appErr?.status === 422) {
        showError("This appointment status change is not available.");
      } else if (appErr?.status === 404) {
        showError("This appointment is no longer available.");
        await refresh();
      } else {
        showError(appErr?.message || "Unable to update appointment status.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (appt: Appointment) => {
    if (!window.confirm("Remove this appointment from your list?")) return;
    try {
      await deleteAppointment(appt.id);
      success("Appointment removed");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      showError(appErr?.message || "Unable to remove appointment.");
    }
  };

  if (loading) return <LoadingState message="Loading appointments…" />;
  if (loadError) {
    return (
      <ErrorState
        title="Unable to load appointments"
        message={loadError}
        onRetry={() => void refresh()}
      />
    );
  }

  return (
    <>
      <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Appointment information is for personal organization only. Follow the schedule and
        instructions provided by your healthcare team.
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2
              className="text-lg font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Care Timeline
            </h2>
            <Btn ref={triggerRef} size="sm" variant="ghost" type="button" onClick={openCreate}>
              <Plus className="w-4 h-4" aria-hidden="true" /> Add Appointment
            </Btn>
          </div>
          <div className="relative">
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-4">
              {timeline.length === 0 ? (
                <Card>
                  <p className="text-sm text-muted-foreground">
                    No appointments yet. Add your first follow-up to start tracking.
                  </p>
                </Card>
              ) : (
                timeline.map((a) => (
                  <div key={a.id} className="flex gap-4 relative">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border-2 border-background z-10 ${
                        a.status === "completed"
                          ? "bg-green-500"
                          : a.status === "upcoming"
                            ? "bg-primary"
                            : "bg-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {a.status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <Calendar className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <Card
                      className={`flex-1 min-w-0 ${a.status === "upcoming" ? "border-primary/30 bg-blue-50/50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className="font-bold text-foreground text-sm"
                              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                            >
                              {a.title}
                            </h3>
                            <Badge
                              color={
                                a.status === "completed"
                                  ? "green"
                                  : a.status === "upcoming"
                                    ? "blue"
                                    : a.status === "missed"
                                      ? "amber"
                                      : "purple"
                              }
                            >
                              {a.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {typeLabel(a.appointment_type)}
                            {a.provider_name ? ` · ${a.provider_name}` : ""} ·{" "}
                            {formatDisplay(a.scheduled_start, a.timezone)} ({a.timezone})
                          </p>
                          {a.notes ? (
                            <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {a.status === "upcoming" ? (
                            <>
                              <Btn
                                size="sm"
                                variant="ghost"
                                type="button"
                                disabled={busyId === a.id}
                                onClick={() => void setStatus(a, "completed")}
                              >
                                Complete
                              </Btn>
                              <Btn
                                size="sm"
                                variant="ghost"
                                type="button"
                                disabled={busyId === a.id}
                                onClick={() => void setStatus(a, "missed")}
                              >
                                Missed
                              </Btn>
                              <Btn
                                size="sm"
                                variant="ghost"
                                type="button"
                                disabled={busyId === a.id}
                                onClick={() => void setStatus(a, "cancelled")}
                              >
                                Cancel
                              </Btn>
                            </>
                          ) : null}
                          {a.status === "cancelled" ||
                          a.status === "missed" ||
                          a.status === "completed" ? (
                            <Btn
                              size="sm"
                              variant="ghost"
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => void setStatus(a, "upcoming")}
                            >
                              Restore
                            </Btn>
                          ) : null}
                          <Btn size="sm" variant="ghost" type="button" onClick={() => openEdit(a)}>
                            Edit
                          </Btn>
                          <Btn
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => void onDelete(a)}
                          >
                            Remove
                          </Btn>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Next Appointment
            </h3>
            {nextAppointment ? (
              <div
                className="rounded-xl p-4"
                style={{ background: `linear-gradient(135deg, ${BLUE}18, ${TEAL}18)` }}
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {typeLabel(nextAppointment.appointment_type)}
                </p>
                <p
                  className="text-2xl font-extrabold text-foreground mt-1"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {formatDisplay(nextAppointment.scheduled_start, nextAppointment.timezone)}
                </p>
                <p className="text-sm text-muted-foreground">{nextAppointment.title}</p>
                <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 font-semibold">
                    <AlertTriangle className="w-3 h-3 inline mr-1" aria-hidden="true" />
                    Tracking only — follow your healthcare team’s instructions.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
            )}
          </Card>

          <Card>
            <h3
              className="font-bold text-foreground mb-3"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              TSH History
            </h3>
            <div className="space-y-2 text-sm">
              {mockTshHistory.map((t) => (
                <div key={t.date} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-muted-foreground">{t.date}</span>
                  <span className="font-bold text-foreground">
                    {t.value} <span className="text-xs font-normal">mIU/L</span>
                  </span>
                  <Badge
                    color={
                      t.status === "optimal" ? "green" : t.status === "normal" ? "blue" : "red"
                    }
                  >
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 border-0"
            aria-label="Close dialog"
            onClick={closeModal}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-2xl border border-border shadow-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                id={titleId}
                className="text-lg font-bold text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {editing ? "Edit Appointment" : "Add Appointment"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-accent text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {conflict ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Appointment information was updated elsewhere. Reload the latest record before
                saving.
              </div>
            ) : null}
            <form className="space-y-3" onSubmit={handleSubmit(onSave)} noValidate>
              <div className="space-y-1.5">
                <label htmlFor="appointment_type" className="block text-sm font-semibold">
                  Appointment type
                </label>
                <select
                  id="appointment_type"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                  {...register("appointment_type")}
                >
                  {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Title" error={errors.title?.message} {...register("title")} />
              <Input label="Date" type="date" error={errors.date?.message} {...register("date")} />
              <Input
                label="Start time"
                type="time"
                error={errors.start_time?.message}
                {...register("start_time")}
              />
              <Input
                label="End time (optional)"
                type="time"
                error={errors.end_time?.message}
                {...register("end_time")}
              />
              <Input
                label="Timezone (IANA)"
                error={errors.timezone?.message}
                {...register("timezone")}
              />
              <Input label="Location" {...register("location")} />
              <div className="space-y-1.5">
                <label htmlFor="location_type" className="block text-sm font-semibold">
                  Location type
                </label>
                <select
                  id="location_type"
                  className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                  {...register("location_type")}
                >
                  <option value="">—</option>
                  {LOCATION_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Provider name" {...register("provider_name")} />
              <Input
                label="Reminder offsets (minutes, comma-separated)"
                error={errors.reminder_offsets?.message}
                {...register("reminder_offsets")}
              />
              <Input label="Notes" {...register("notes")} />
              <div className="flex gap-2 pt-2">
                <Btn
                  type="submit"
                  className="flex-1 justify-center"
                  disabled={saving || conflict}
                  aria-busy={saving}
                >
                  {saving ? "Saving…" : "Save"}
                </Btn>
                <Btn type="button" variant="ghost" disabled={saving} onClick={closeModal}>
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
