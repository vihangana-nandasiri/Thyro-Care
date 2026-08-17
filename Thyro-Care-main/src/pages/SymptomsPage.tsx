import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  type LucideIcon,
  AlertTriangle,
  Activity,
  CheckCircle,
  Droplets,
  Eye,
  Heart,
  Thermometer,
  Wind,
  Zap,
  Coffee,
  Trash2,
} from "lucide-react";
import { Card, Btn, LoadingState, ErrorState } from "@/components/common";
import { BLUE, TEAL, GREEN, AMBER, RED } from "@/constants/colors";
import { ROUTES } from "@/constants/routes";
import { MEDICAL_SAFETY_DISCLAIMER, safetyAnswersSchema } from "@/schemas/symptomSchemas";
import { useToast } from "@/hooks/useToast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSymptoms } from "@/hooks/useSymptoms";
import { createSymptom, deleteSymptom, updateSymptomStatus } from "@/services/symptomService";
import type {
  Symptom,
  SymptomFrequency,
  SymptomSafetyAnswers,
  SymptomSafetyAssessment,
  SymptomSeverity,
  SymptomType,
} from "@/types/symptom";
import type { AppError } from "@/types/api";

const SYMPTOM_OPTIONS: { id: SymptomType; label: string; icon: LucideIcon }[] = [
  { id: "digestive_change", label: "Digestive Change", icon: Droplets },
  { id: "mood_change", label: "Mood Change", icon: Coffee },
  { id: "temperature_sensitivity", label: "Temp. Sensitivity", icon: Eye },
  { id: "neck_swelling", label: "Neck Swelling", icon: Thermometer },
  { id: "fatigue", label: "Fatigue", icon: Zap },
  { id: "dizziness", label: "Dizziness", icon: Wind },
  { id: "neck_pain", label: "Neck Pain", icon: Activity },
  { id: "palpitations", label: "Palpitations", icon: Heart },
];

const SAFETY_QUESTIONS: { key: keyof SymptomSafetyAnswers; label: string }[] = [
  { key: "breathing_emergency", label: "Severe difficulty breathing right now?" },
  { key: "severe_chest_discomfort", label: "Severe chest pain or pressure?" },
  { key: "loss_of_consciousness", label: "Fainting or loss of consciousness?" },
  { key: "severe_or_rapid_neck_swelling", label: "Severe or rapidly increasing neck swelling?" },
  { key: "unable_to_swallow", label: "Unable to swallow safely?" },
  { key: "uncontrolled_bleeding", label: "Uncontrolled bleeding?" },
  { key: "severe_new_confusion", label: "Sudden severe confusion?" },
  { key: "rapidly_worsening_condition", label: "Symptoms rapidly getting much worse?" },
  { key: "feels_immediately_unsafe", label: "Do you feel you need emergency help now?" },
];

const FALSE_ANSWERS: SymptomSafetyAnswers = {
  breathing_emergency: false,
  severe_chest_discomfort: false,
  loss_of_consciousness: false,
  severe_or_rapid_neck_swelling: false,
  unable_to_swallow: false,
  uncontrolled_bleeding: false,
  severe_new_confusion: false,
  rapidly_worsening_condition: false,
  feels_immediately_unsafe: false,
};

function sliderToSeverity(value: number): SymptomSeverity {
  if (value <= 2) return "mild";
  if (value === 3) return "moderate";
  return "severe";
}

function severityLabel(severity: SymptomSeverity): string {
  if (severity === "mild") return "Mild";
  if (severity === "moderate") return "Moderate";
  return "Severe";
}

function severityColor(severity: SymptomSeverity): string {
  if (severity === "mild") return GREEN;
  if (severity === "moderate") return AMBER;
  return RED;
}

function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

export function SymptomsPage() {
  useDocumentTitle("Symptoms");
  const navigate = useNavigate();
  const { error: toastError, success, info } = useToast();
  const { loading, error, symptoms, active, refresh } = useSymptoms();

  const [selected, setSelected] = useState<SymptomType>("fatigue");
  const [severitySlider, setSeveritySlider] = useState(3);
  const [frequency, setFrequency] = useState<SymptomFrequency>("occasional");
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [safetyAnswers, setSafetyAnswers] = useState<SymptomSafetyAnswers>({ ...FALSE_ANSWERS });
  const [assessment, setAssessment] = useState<SymptomSafetyAssessment | null>(null);
  const [step, setStep] = useState<"form" | "safety" | "result">("form");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("all");

  const severity = sliderToSeverity(severitySlider);
  const displayed = useMemo(() => {
    if (filter === "active") return symptoms.filter((s) => s.status !== "resolved");
    if (filter === "resolved") return symptoms.filter((s) => s.status === "resolved");
    return symptoms;
  }, [symptoms, filter]);

  const toggleSafety = (key: keyof SymptomSafetyAnswers, value: boolean) => {
    setSafetyAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const goToSafety = () => {
    if (!startedAt) {
      setFormError("Start date and time is required");
      toastError("Start date and time is required");
      return;
    }
    setFormError(null);
    setStep("safety");
    setAssessment(null);
  };

  const handleSave = async () => {
    const parsed = safetyAnswersSchema.safeParse(safetyAnswers);
    if (!parsed.success) {
      const msg = "Please answer all safety questions with Yes or No";
      setFormError(msg);
      toastError(msg);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const result = await createSymptom({
        symptom_type: selected,
        severity,
        frequency,
        started_at: localInputToIso(startedAt),
        timezone: defaultTimezone(),
        status: "active",
        notes: notes.trim() || null,
        safety_answers: parsed.data,
      });
      setAssessment(result.safety_assessment);
      setStep("result");
      success("Symptom saved");
      await refresh();
      if (result.safety_assessment.emergency_page_required) {
        info("Emergency guidance available — open Emergency Support if needed");
      }
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        toastError(
          "Symptom information was updated elsewhere. Reload the latest record before saving.",
        );
      } else {
        toastError(
          appErr?.message ||
            "The safety check could not be completed. If you believe this is an emergency, contact emergency services immediately.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (item: Symptom) => {
    try {
      await updateSymptomStatus(item.id, {
        status: "resolved",
        expected_version: item.version,
      });
      success("Symptom marked resolved");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 409) {
        toastError(
          "Symptom information was updated elsewhere. Reload the latest record before saving.",
        );
        await refresh();
      } else if (appErr?.status === 404) {
        toastError("This symptom record is no longer available.");
        await refresh();
      } else {
        toastError(appErr?.message || "Could not update symptom status");
      }
    }
  };

  const handleDelete = async (item: Symptom) => {
    if (!window.confirm("Delete this symptom record? This cannot be undone from your list.")) {
      return;
    }
    try {
      await deleteSymptom(item.id);
      success("Symptom deleted");
      await refresh();
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.status === 404) {
        toastError("This symptom record is no longer available.");
        await refresh();
      } else {
        toastError(appErr?.message || "Could not delete symptom");
      }
    }
  };

  const resetForm = () => {
    setStep("form");
    setAssessment(null);
    setSafetyAnswers({ ...FALSE_ANSWERS });
    setNotes("");
  };

  if (loading) return <LoadingState message="Loading symptoms…" />;
  if (error) {
    return (
      <ErrorState title="Unable to load symptoms" message={error} onRetry={() => void refresh()} />
    );
  }

  return (
    <>
      <div className="max-w-3xl">
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed" role="note">
          {MEDICAL_SAFETY_DISCLAIMER}
        </p>

        {assessment?.emergency_page_required && (
          <div
            className="rounded-2xl p-4 mb-4 bg-red-50 border border-red-300 flex items-start gap-3"
            role="alert"
          >
            <AlertTriangle
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-red-800">{assessment.headline}</p>
              <p className="text-sm text-red-700 mt-0.5">{assessment.user_message}</p>
              <p className="text-sm text-red-700 mt-1 font-semibold">
                This application cannot contact emergency services for you.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTES.EMERGENCY)}
                className="mt-2 text-sm font-bold text-red-600 hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
              >
                Go to Emergency Support →
              </button>
            </div>
          </div>
        )}

        {step === "form" && (
          <>
            <Card className="mb-5">
              <h3
                className="font-bold text-foreground mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Select Your Symptoms
              </h3>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                role="group"
                aria-label="Symptoms"
              >
                {SYMPTOM_OPTIONS.map((s) => {
                  const Icon = s.icon;
                  const isSelected = selected === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelected(s.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        isSelected
                          ? "border-primary bg-blue-50"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                          isSelected ? "bg-primary" : "bg-muted"
                        }`}
                        aria-hidden="true"
                      >
                        <Icon
                          className={`w-5 h-5 ${isSelected ? "text-white" : "text-muted-foreground"}`}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground text-center">
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {formError ? (
                <p className="text-xs text-red-600 mt-3" role="alert">
                  {formError}
                </p>
              ) : null}
            </Card>

            <Card className="mb-5">
              <h3
                className="font-bold text-foreground mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Severity Level:{" "}
                <span style={{ color: severityColor(severity) }}>{severityLabel(severity)}</span>
              </h3>
              <label className="sr-only" htmlFor="severity-range">
                Severity from mild to severe
              </label>
              <input
                id="severity-range"
                type="range"
                min={1}
                max={5}
                value={severitySlider}
                onChange={(e) => setSeveritySlider(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={severitySlider}
                aria-valuetext={severityLabel(severity)}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </Card>

            <Card className="mb-5 space-y-3">
              <label className="block text-sm font-semibold text-foreground">
                Frequency
                <select
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm bg-background"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as SymptomFrequency)}
                >
                  <option value="once">Once</option>
                  <option value="occasional">Occasional</option>
                  <option value="daily">Daily</option>
                  <option value="frequent">Frequent</option>
                  <option value="continuous">Continuous</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Started
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm bg-background"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  required
                />
              </label>
              <label className="block text-sm font-semibold text-foreground">
                Notes (optional — not used for safety classification)
                <textarea
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm bg-background min-h-[80px]"
                  value={notes}
                  maxLength={1000}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </Card>

            <Btn size="lg" type="button" onClick={goToSafety}>
              <Heart className="w-5 h-5" aria-hidden="true" /> Continue to safety check
            </Btn>
          </>
        )}

        {step === "safety" && (
          <Card className="mb-5">
            <h3
              className="font-bold text-foreground mb-2"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Safety check questions
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Answer Yes or No only. These answers support safety awareness guidance — not a
              diagnosis.
            </p>
            <ul className="space-y-3">
              {SAFETY_QUESTIONS.map((q) => (
                <li
                  key={q.key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3"
                >
                  <span className="text-sm text-foreground" id={`safety-${q.key}`}>
                    {q.label}
                  </span>
                  <div className="flex gap-2" role="group" aria-labelledby={`safety-${q.key}`}>
                    <button
                      type="button"
                      aria-pressed={safetyAnswers[q.key] === true}
                      onClick={() => toggleSafety(q.key, true)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 cursor-pointer ${
                        safetyAnswers[q.key]
                          ? "border-red-400 bg-red-50 text-red-700"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      aria-pressed={safetyAnswers[q.key] === false}
                      onClick={() => toggleSafety(q.key, false)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 cursor-pointer ${
                        !safetyAnswers[q.key]
                          ? "border-primary bg-blue-50 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex gap-3 mt-5">
              <Btn
                type="button"
                variant="secondary"
                onClick={() => setStep("form")}
                disabled={saving}
              >
                Back
              </Btn>
              <Btn type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? "Saving…" : "Save symptom & review guidance"}
              </Btn>
            </div>
          </Card>
        )}

        {step === "result" && assessment && !assessment.emergency_page_required && (
          <Card
            className="mt-1 mb-5 border-l-4"
            style={{
              borderLeftColor:
                assessment.safety_level === "urgent_medical_review"
                  ? RED
                  : assessment.safety_level === "contact_healthcare_team"
                    ? AMBER
                    : GREEN,
            }}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${TEAL})` }}
                aria-hidden="true"
              >
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3
                  className="font-bold text-foreground"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {assessment.headline}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Rule version {assessment.rule_version} · tracking only
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{assessment.user_message}</p>
            <div className="space-y-1.5 bg-blue-50 rounded-xl p-3">
              <p className="font-semibold text-blue-800 text-xs uppercase tracking-wide">
                Recommended action
              </p>
              <p className="flex items-start gap-1.5 text-blue-700 text-xs">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {assessment.recommended_action}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-3">{assessment.disclaimer}</p>
            <Btn type="button" className="mt-4" onClick={resetForm}>
              Log another symptom
            </Btn>
          </Card>
        )}

        {step === "result" && assessment?.emergency_page_required && (
          <div className="mb-5">
            <Btn type="button" onClick={resetForm}>
              Log another symptom
            </Btn>
          </div>
        )}

        <Card className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3
              className="font-bold text-foreground"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Symptom history
            </h3>
            <div className="flex gap-2">
              {(["all", "active", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold border cursor-pointer ${
                    filter === f ? "border-primary bg-blue-50 text-primary" : "border-border"
                  }`}
                >
                  {f === "all" ? "All" : f === "active" ? `Active (${active.length})` : "Resolved"}
                </button>
              ))}
            </div>
          </div>
          {displayed.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No symptoms logged yet. Use the form above to add your first entry.
            </p>
          ) : (
            <ul className="space-y-3">
              {displayed.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                >
                  <div>
                    <p className="font-semibold text-sm text-foreground capitalize">
                      {item.symptom_type.replaceAll("_", " ")}
                      {item.custom_symptom_name ? ` · ${item.custom_symptom_name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {severityLabel(item.severity)} · {item.frequency} · {item.status}
                      {" · "}
                      {new Date(item.started_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.status !== "resolved" && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                        onClick={() => void handleResolve(item)}
                      >
                        Resolve
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                      onClick={() => void handleDelete(item)}
                      aria-label="Delete symptom"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
