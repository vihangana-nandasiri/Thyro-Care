import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

export const medicationFormSchema = z
  .object({
    name: z.string().trim().min(1, "Medication name is required").max(200),
    dosage_text: z.string().trim().min(1, "Dosage is required").max(200),
    frequency: z.enum([
      "once_daily",
      "twice_daily",
      "three_times_daily",
      "four_times_daily",
      "weekly",
      "as_needed",
      "custom",
    ]),
    reminder_times: z.string().optional(),
    instructions: z.string().max(1000).optional(),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().optional(),
    status: z.enum(["active", "completed", "discontinued"]),
    prescribed_by_text: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    timezone: z.string().trim().min(1, "Timezone is required").max(64),
  })
  .superRefine((data, ctx) => {
    if (data.end_date && data.end_date < data.start_date) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "End date cannot precede start date",
      });
    }
    const times = (data.reminder_times || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const t of times) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) {
        ctx.addIssue({
          code: "custom",
          path: ["reminder_times"],
          message: "Reminder times must be HH:mm, comma-separated",
        });
        break;
      }
    }
    if (data.frequency === "custom" && times.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["reminder_times"],
        message: "Custom frequency requires at least one reminder time",
      });
    }
  });

export type MedicationFormSchemaValues = z.infer<typeof medicationFormSchema>;

/** Legacy alias */
export const medicationSchema = medicationFormSchema;
export type MedicationFormValues = MedicationFormSchemaValues;

void hhmm;
