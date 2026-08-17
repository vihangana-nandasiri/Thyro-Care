import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Edit2 } from "lucide-react";
import { Card, Badge, Btn, Input, LoadingState, ErrorState } from "@/components/common";
import { BLUE, TEAL } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthContext";
import { profileFormSchema, type ProfileFormSchemaValues } from "@/schemas/profileSchemas";
import { changePasswordSchema, type ChangePasswordFormValues } from "@/schemas/authSchemas";
import { getMyProfile, updateMyProfile } from "@/services/profileService";
import { changePassword, resendVerification } from "@/services/authService";
import { useToast } from "@/hooks/useToast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { AppError } from "@/types/api";
import {
  AGE_RANGE_OPTIONS,
  LANGUAGE_OPTIONS,
  RAI_OPTIONS,
  TREATMENT_STAGE_OPTIONS,
  type AgeRange,
  type PreferredLanguage,
  type RAITreatmentStatus,
  type TreatmentStage,
  type PatientProfileResponse,
  type ProfileFormValues,
} from "@/types/profile";

function toFormValues(data: PatientProfileResponse): ProfileFormValues {
  const p = data.profile;
  return {
    age_range: p.age_range ?? "",
    preferred_language: p.preferred_language ?? "",
    surgery_date: p.surgery_date ?? "",
    rai_treatment_status: p.rai_treatment_status ?? "",
    treatment_stage: p.treatment_stage ?? "",
    emergency_contact_name: p.emergency_contact_name ?? "",
    emergency_contact_phone: p.emergency_contact_phone ?? "",
    current_medication_summary: p.current_medication_summary ?? "",
  };
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  return value.trim();
}

function labelFor(
  options: { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

export function ProfilePage() {
  useDocumentTitle("Profile");
  const navigate = useNavigate();
  const { user: authUser, logout, refreshSession } = useAuth();
  const { success, error: showError } = useToast();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [weeklyReports, setWeeklyReports] = useState(true);
  const [tab, setTab] = useState<"personal" | "medical" | "settings">("personal");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [data, setData] = useState<PatientProfileResponse | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormSchemaValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      age_range: "",
      preferred_language: "",
      surgery_date: "",
      rai_treatment_status: "",
      treatment_stage: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      current_medication_summary: "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setConflict(false);
    try {
      const result = await getMyProfile();
      setData(result);
      reset(toFormValues(result));
    } catch (err) {
      const appErr = err as AppError;
      setLoadError(appErr?.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const onSave = async (values: ProfileFormSchemaValues) => {
    if (!data || saving) return;
    setSaving(true);
    setConflict(false);
    try {
      const result = await updateMyProfile({
        expected_version: data.profile.version,
        age_range: (emptyToNull(values.age_range ?? "") as AgeRange | null) ?? null,
        preferred_language:
          (emptyToNull(values.preferred_language ?? "") as PreferredLanguage | null) ?? null,
        surgery_date: emptyToNull(values.surgery_date),
        rai_treatment_status:
          (emptyToNull(values.rai_treatment_status ?? "") as RAITreatmentStatus | null) ?? null,
        treatment_stage:
          (emptyToNull(values.treatment_stage ?? "") as TreatmentStage | null) ?? null,
        emergency_contact_name: emptyToNull(values.emergency_contact_name),
        emergency_contact_phone: emptyToNull(values.emergency_contact_phone),
        current_medication_summary: emptyToNull(values.current_medication_summary),
      });
      setData(result);
      reset(toFormValues(result));
      setEditing(false);
      success("Profile saved");
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        setConflict(true);
        showError(
          "Your profile was updated elsewhere. Reload the latest profile before saving again.",
        );
      } else {
        showError(appErr?.message || "Unable to save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (values: ChangePasswordFormValues) => {
    if (passwordSubmitting) return;
    setPasswordSubmitting(true);
    setPasswordError(null);
    try {
      const result = await changePassword({
        current_password: values.currentPassword,
        new_password: values.newPassword,
        confirm_password: values.confirmPassword,
      });
      resetPasswordForm();
      success(result.message || "Password updated. Please sign in again.");
      try {
        await logout();
      } catch {
        // Session may already be revoked after password change.
      }
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 401) {
        showError("Your session expired. Please sign in again.");
        try {
          await logout();
        } catch {
          // ignore
        }
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }
      const message = appErr?.message || "Unable to change password.";
      setPasswordError(message);
      showError(message);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const onResendVerification = async () => {
    if (resendBusy) return;
    setResendBusy(true);
    try {
      const result = await resendVerification();
      success(result.message || "If verification is required, instructions will be sent.");
      await refreshSession();
      await loadProfile();
    } catch (err) {
      const appErr = err as AppError;
      showError(appErr?.message || "Unable to resend verification email.");
    } finally {
      setResendBusy(false);
    }
  };

  const settings = [
    {
      label: "Medication Reminders",
      sub: "Get notified when it's time for your medication",
      state: notifications,
      set: setNotifications,
    },
    {
      label: "Appointment Reminders",
      sub: "Receive alerts 24h before appointments",
      state: appointmentReminders,
      set: setAppointmentReminders,
    },
    {
      label: "Weekly Health Reports",
      sub: "Get your health summary every Sunday",
      state: weeklyReports,
      set: setWeeklyReports,
    },
    {
      label: "Dark Mode",
      sub: "Switch to a darker interface",
      state: darkMode,
      set: setDarkMode,
    },
  ];

  if (loading) {
    return <LoadingState message="Loading profile…" />;
  }

  if (loadError || !data) {
    return (
      <ErrorState
        title="Unable to load profile"
        message={loadError || "Something went wrong."}
        onRetry={() => void loadProfile()}
      />
    );
  }

  const account = data.account;
  const profile = data.profile;
  const displayName = account.full_name || authUser?.full_name || "Patient";

  const personalView = [
    { label: "Full Name", value: account.full_name },
    { label: "Email", value: account.email },
    { label: "Age range", value: labelFor(AGE_RANGE_OPTIONS, profile.age_range) },
    { label: "Language", value: labelFor(LANGUAGE_OPTIONS, profile.preferred_language) },
    { label: "Emergency contact", value: profile.emergency_contact_name || "—" },
    { label: "Emergency phone", value: profile.emergency_contact_phone || "—" },
  ];

  const medicalView = [
    { label: "Surgery date", value: profile.surgery_date || "—" },
    {
      label: "RAI treatment",
      value: labelFor(RAI_OPTIONS, profile.rai_treatment_status),
    },
    {
      label: "Treatment stage",
      value: labelFor(TREATMENT_STAGE_OPTIONS, profile.treatment_stage),
    },
    {
      label: "Medication summary",
      value: profile.current_medication_summary || "—",
    },
    {
      label: "Consent",
      value: profile.consent_accepted ? "Accepted" : "Not recorded",
    },
    {
      label: "Medical disclaimer",
      value: profile.disclaimer_accepted ? "Acknowledged" : "Not recorded",
    },
  ];

  return (
    <>
      <div className="max-w-3xl">
        <Card className="mb-5">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-xl"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
                aria-hidden="true"
              >
                {displayName
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Change profile photo"
                disabled
                title="Photo upload is not available yet"
              >
                <Camera className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h2
                className="text-2xl font-bold text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {displayName}
              </h2>
              <p className="text-muted-foreground text-sm break-all">{account.email}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge color="blue">{account.role}</Badge>
                <Badge color="teal">{profile.profile_completion_percentage}% complete</Badge>
                <Badge color={account.email_verified ? "green" : "amber"}>
                  {account.email_verified ? "Email verified" : "Email unverified"}
                </Badge>
                {profile.rai_treatment_status ? (
                  <Badge color="green">{labelFor(RAI_OPTIONS, profile.rai_treatment_status)}</Badge>
                ) : null}
              </div>
            </div>
            <Btn
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setTab("personal");
                setEditing(true);
                setConflict(false);
                reset(toFormValues(data));
              }}
            >
              <Edit2 className="w-4 h-4" aria-hidden="true" /> Edit Profile
            </Btn>
          </div>
        </Card>

        {conflict ? (
          <Card className="mb-5 border-amber-200 bg-amber-50">
            <p className="text-sm text-foreground" role="alert">
              Your profile was updated elsewhere. Reload the latest profile before saving again.
            </p>
            <Btn
              className="mt-3"
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => {
                setEditing(false);
                void loadProfile();
              }}
            >
              Reload Profile
            </Btn>
          </Card>
        ) : null}

        <div
          className="flex gap-2 mb-5 overflow-x-auto"
          role="tablist"
          aria-label="Profile sections"
        >
          {(["personal", "medical", "settings"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition cursor-pointer capitalize flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                tab === t ? "text-white" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
              style={tab === t ? { background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` } : {}}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "personal" && (
          <Card role="tabpanel">
            {editing ? (
              <form className="space-y-4" onSubmit={handleSubmit(onSave)} noValidate>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Full Name" value={account.full_name} disabled readOnly />
                  <Input label="Email" type="email" value={account.email} disabled readOnly />
                  <div className="space-y-1.5">
                    <label
                      htmlFor="age_range"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Age range
                    </label>
                    <select
                      id="age_range"
                      className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                      {...register("age_range")}
                    >
                      <option value="">Select…</option>
                      {AGE_RANGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {errors.age_range ? (
                      <p className="text-xs text-red-600" role="alert">
                        {errors.age_range.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="preferred_language"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Language
                    </label>
                    <select
                      id="preferred_language"
                      className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                      {...register("preferred_language")}
                    >
                      <option value="">Select…</option>
                      {LANGUAGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Emergency contact name"
                    error={errors.emergency_contact_name?.message}
                    {...register("emergency_contact_name")}
                  />
                  <Input
                    label="Emergency contact phone"
                    error={errors.emergency_contact_phone?.message}
                    {...register("emergency_contact_phone")}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn type="submit" size="sm" disabled={saving || !isDirty} aria-busy={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Btn>
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setEditing(false);
                      setConflict(false);
                      reset(toFormValues(data));
                    }}
                  >
                    Cancel
                  </Btn>
                </div>
              </form>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {personalView.map((f) => (
                  <div key={f.label}>
                    <div className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {f.label}
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm text-foreground font-medium">
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "medical" && (
          <Card role="tabpanel">
            {editing ? (
              <form className="space-y-4" onSubmit={handleSubmit(onSave)} noValidate>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Surgery date"
                    type="date"
                    error={errors.surgery_date?.message}
                    {...register("surgery_date")}
                  />
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rai_treatment_status"
                      className="block text-sm font-semibold text-foreground"
                    >
                      RAI treatment
                    </label>
                    <select
                      id="rai_treatment_status"
                      className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                      {...register("rai_treatment_status")}
                    >
                      <option value="">Select…</option>
                      {RAI_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="treatment_stage"
                      className="block text-sm font-semibold text-foreground"
                    >
                      Treatment stage
                    </label>
                    <select
                      id="treatment_stage"
                      className="w-full rounded-xl border border-border bg-input-background py-3 px-4 text-sm"
                      {...register("treatment_stage")}
                    >
                      <option value="">Select…</option>
                      {TREATMENT_STAGE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      label="Current medication summary"
                      error={errors.current_medication_summary?.message}
                      {...register("current_medication_summary")}
                    />
                  </div>
                  <div>
                    <div className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Consent
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm">
                      {profile.consent_accepted ? "Accepted" : "Not recorded"} (read-only)
                    </div>
                  </div>
                  <div>
                    <div className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Disclaimer
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm">
                      {profile.disclaimer_accepted ? "Acknowledged" : "Not recorded"} (read-only)
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn type="submit" size="sm" disabled={saving || !isDirty} aria-busy={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Btn>
                  <Btn
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setEditing(false);
                      reset(toFormValues(data));
                    }}
                  >
                    Cancel
                  </Btn>
                </div>
              </form>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {medicalView.map((f) => (
                  <div key={f.label}>
                    <div className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {f.label}
                    </div>
                    <div className="bg-muted rounded-xl px-4 py-3 text-sm text-foreground font-medium">
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "settings" && (
          <Card className="space-y-6" role="tabpanel">
            <div className="space-y-3">
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Email verification
              </h3>
              <p className="text-sm text-muted-foreground">
                Status:{" "}
                <span className="font-semibold text-foreground">
                  {account.email_verified ? "Verified" : "Not verified"}
                </span>
              </p>
              {!account.email_verified ? (
                <Btn
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={resendBusy}
                  aria-busy={resendBusy}
                  onClick={() => void onResendVerification()}
                >
                  {resendBusy ? "Sending…" : "Resend verification email"}
                </Btn>
              ) : null}
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <h3
                className="text-base font-bold text-foreground"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Change password
              </h3>
              <form
                className="space-y-4 max-w-md"
                onSubmit={handlePasswordSubmit(onChangePassword)}
                noValidate
              >
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  error={passwordErrors.currentPassword?.message}
                  {...registerPassword("currentPassword")}
                />
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  error={passwordErrors.newPassword?.message}
                  {...registerPassword("newPassword")}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  error={passwordErrors.confirmPassword?.message}
                  {...registerPassword("confirmPassword")}
                />
                {passwordError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {passwordError}
                  </p>
                ) : null}
                <Btn
                  type="submit"
                  size="sm"
                  disabled={passwordSubmitting}
                  aria-busy={passwordSubmitting}
                >
                  {passwordSubmitting ? "Updating…" : "Update password"}
                </Btn>
              </form>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              {settings.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-semibold text-sm text-foreground">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.sub}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.state}
                    aria-label={s.label}
                    onClick={() => s.set(!s.state)}
                    className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      s.state ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        s.state ? "translate-x-7" : "translate-x-1"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              ))}
              <div className="pt-2">
                <Btn
                  variant="danger"
                  size="sm"
                  type="button"
                  disabled
                  title="Coming in a later phase"
                >
                  Delete Account
                </Btn>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
