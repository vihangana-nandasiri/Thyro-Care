import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm format");

export const appointmentFormSchema = z
  .object({
    appointment_type: z.enum([
      "tsh_test",
      "blood_test",
      "doctor_consultation",
      "ultrasound",
      "rai_follow_up",
      "medication_review",
      "general_follow_up",
      "other",
    ]),
    title: z.string().trim().min(1, "Title is required").max(200),
    date: z.string().min(1, "Date is required"),
    start_time: hhmm,
    end_time: z.string().optional(),
    timezone: z.string().trim().min(1, "Timezone is required").max(64),
    location: z.string().max(300).optional(),
    location_type: z.enum(["in_person", "telehealth", "phone", "other", ""]).optional(),
    provider_name: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    status: z.enum(["upcoming", "completed", "missed", "cancelled"]),
    reminder_offsets: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.end_time && data.end_time.trim()) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.end_time)) {
        ctx.addIssue({
          code: "custom",
          path: ["end_time"],
          message: "Use HH:mm format",
        });
      } else if (data.end_time <= data.start_time) {
        ctx.addIssue({
          code: "custom",
          path: ["end_time"],
          message: "End time must be after start time",
        });
      }
    }
    const offsets = (data.reminder_offsets || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    for (const raw of offsets) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 43200) {
        ctx.addIssue({
          code: "custom",
          path: ["reminder_offsets"],
          message: "Reminder offsets must be integers from 0 to 43200 minutes",
        });
        break;
      }
    }
  });

export type AppointmentFormSchemaValues = z.infer<typeof appointmentFormSchema>;

/** Legacy alias */
export const appointmentSchema = appointmentFormSchema;
export type AppointmentFormValues = AppointmentFormSchemaValues;
