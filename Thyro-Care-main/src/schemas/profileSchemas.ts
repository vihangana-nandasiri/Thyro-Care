import { z } from "zod";

const optionalEnum = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.literal("")]).optional();

export const profileFormSchema = z.object({
  age_range: optionalEnum(
    z.enum([
      "under_18",
      "age_18_29",
      "age_30_39",
      "age_40_49",
      "age_50_59",
      "age_60_69",
      "age_70_plus",
      "prefer_not_to_say",
    ]),
  ),
  preferred_language: optionalEnum(z.enum(["english", "sinhala", "tamil"])),
  surgery_date: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date"),
  rai_treatment_status: optionalEnum(
    z.enum(["not_planned", "planned", "in_progress", "completed", "not_applicable", "unknown"]),
  ),
  treatment_stage: optionalEnum(
    z.enum([
      "post_surgery",
      "pre_rai",
      "post_rai",
      "follow_up",
      "long_term_survivorship",
      "unknown",
    ]),
  ),
  emergency_contact_name: z.string().max(120, "Name is too long").optional(),
  emergency_contact_phone: z
    .string()
    .max(32, "Phone is too long")
    .optional()
    .refine(
      (v) => !v || v.trim() === "" || /^[+\d\s\-()]+$/.test(v),
      "Phone may only contain digits, spaces, hyphens, parentheses, and an optional +",
    ),
  current_medication_summary: z.string().max(500, "Summary is too long").optional(),
});

export type ProfileFormSchemaValues = z.infer<typeof profileFormSchema>;

/** @deprecated Use profileFormSchema — kept for any legacy imports during Phase 7. */
export const profilePersonalSchema = profileFormSchema;
export type ProfilePersonalValues = ProfileFormSchemaValues;
