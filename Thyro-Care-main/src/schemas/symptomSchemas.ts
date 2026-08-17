import { z } from "zod";

export const symptomTypeSchema = z.enum([
  "fatigue",
  "neck_pain",
  "neck_swelling",
  "voice_change",
  "swallowing_difficulty",
  "breathing_difficulty",
  "palpitations",
  "dizziness",
  "numbness_or_tingling",
  "muscle_cramping",
  "temperature_sensitivity",
  "sleep_difficulty",
  "mood_change",
  "digestive_change",
  "weight_change",
  "other",
]);

export const symptomSeveritySchema = z.enum(["mild", "moderate", "severe"]);
export const symptomFrequencySchema = z.enum([
  "once",
  "occasional",
  "daily",
  "frequent",
  "continuous",
]);
export const symptomStatusSchema = z.enum(["active", "improving", "resolved"]);

export const safetyAnswersSchema = z.object({
  breathing_emergency: z.boolean(),
  severe_chest_discomfort: z.boolean(),
  loss_of_consciousness: z.boolean(),
  severe_or_rapid_neck_swelling: z.boolean(),
  unable_to_swallow: z.boolean(),
  uncontrolled_bleeding: z.boolean(),
  severe_new_confusion: z.boolean(),
  rapidly_worsening_condition: z.boolean(),
  feels_immediately_unsafe: z.boolean(),
});

export const symptomFormSchema = z
  .object({
    symptom_type: symptomTypeSchema,
    custom_symptom_name: z.string().trim().max(120).optional().or(z.literal("")),
    severity: symptomSeveritySchema,
    frequency: symptomFrequencySchema,
    started_at: z.string().min(1, "Start date and time is required"),
    ended_at: z.string().optional().or(z.literal("")),
    timezone: z.string().min(1, "Timezone is required").max(64),
    status: symptomStatusSchema,
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    safety_answers: safetyAnswersSchema,
  })
  .superRefine((data, ctx) => {
    if (data.symptom_type === "other" && !data.custom_symptom_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_symptom_name"],
        message: "Custom name is required for Other",
      });
    }
    if (data.symptom_type !== "other" && data.custom_symptom_name?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_symptom_name"],
        message: "Custom name is only allowed for Other",
      });
    }
    if (data.ended_at && data.started_at && data.ended_at < data.started_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ended_at"],
        message: "End cannot precede start",
      });
    }
  });

export type SymptomFormSchemaValues = z.infer<typeof symptomFormSchema>;

export const MEDICAL_SAFETY_DISCLAIMER =
  "This tool supports symptom tracking and safety awareness only. It does not provide a diagnosis or replace professional medical advice. If you believe you are experiencing a medical emergency, contact local emergency services immediately.";
