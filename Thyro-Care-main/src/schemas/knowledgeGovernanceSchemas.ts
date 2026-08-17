import { z } from "zod";
import { KNOWLEDGE_APPROVAL_CONFIRMATION_TEXT } from "@/constants/knowledgeMessages";

const SLUG_MAX = 200;
const TITLE_MAX = 300;
const SOURCE_NAME_MAX = 200;
const URL_MAX = 500;
const DISCLAIMER_MAX = 1000;
const BODY_MAX = 200_000;
const COMMENTS_MAX = 2_000;
const REASON_MAX = 1_000;

export const KNOWLEDGE_TOPIC_VALUES = [
  "thyroidectomy_recovery",
  "thyroid_cancer_survivorship",
  "medication_education",
  "follow_up_education",
  "symptom_awareness",
  "nutrition_education",
  "emergency_awareness",
  "general_education",
  "other",
] as const;

export const KNOWLEDGE_LANGUAGE_VALUES = ["english", "sinhala", "tamil"] as const;

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const sourceUrlSchema = z
  .string()
  .trim()
  .max(URL_MAX, `Source URL must be ${URL_MAX} characters or fewer`)
  .optional()
  .refine((value) => !value || isValidHttpUrl(value), {
    message: "Source URL must be a valid http or https URL",
  });

export const knowledgeDraftFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(SLUG_MAX, `Slug must be ${SLUG_MAX} characters or fewer`),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(TITLE_MAX, `Title must be ${TITLE_MAX} characters or fewer`),
  source_name: z
    .string()
    .trim()
    .min(1, "Source name is required")
    .max(SOURCE_NAME_MAX, `Source name must be ${SOURCE_NAME_MAX} characters or fewer`),
  source_url: sourceUrlSchema,
  topic: z.enum(KNOWLEDGE_TOPIC_VALUES),
  language: z.enum(KNOWLEDGE_LANGUAGE_VALUES),
  body: z
    .string()
    .trim()
    .min(1, "Body content is required")
    .max(BODY_MAX, `Body must be ${BODY_MAX} characters or fewer`),
  medical_disclaimer: z
    .string()
    .max(DISCLAIMER_MAX, `Disclaimer must be ${DISCLAIMER_MAX} characters or fewer`)
    .optional(),
});

export type KnowledgeDraftFormValues = z.infer<typeof knowledgeDraftFormSchema>;

export const knowledgeSubmitFormSchema = z.object({
  submission_note: z
    .string()
    .max(COMMENTS_MAX, `Submission note must be ${COMMENTS_MAX} characters or fewer`)
    .optional(),
});

export type KnowledgeSubmitFormValues = z.infer<typeof knowledgeSubmitFormSchema>;

export const knowledgeRetireFormSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "A retirement reason is required")
    .max(REASON_MAX, `Reason must be ${REASON_MAX} characters or fewer`),
});

export type KnowledgeRetireFormValues = z.infer<typeof knowledgeRetireFormSchema>;

export const knowledgeApproveFormSchema = z.object({
  confirmationText: z.string().refine((value) => value === KNOWLEDGE_APPROVAL_CONFIRMATION_TEXT, {
    message: "You must type the confirmation statement exactly as shown before approving.",
  }),
  comments: z
    .string()
    .max(COMMENTS_MAX, `Comments must be ${COMMENTS_MAX} characters or fewer`)
    .optional(),
});

export type KnowledgeApproveFormValues = z.infer<typeof knowledgeApproveFormSchema>;

export const knowledgeRequestChangesFormSchema = z.object({
  comments: z
    .string()
    .trim()
    .min(1, "Comments are required when requesting changes")
    .max(COMMENTS_MAX, `Comments must be ${COMMENTS_MAX} characters or fewer`),
});

export type KnowledgeRequestChangesFormValues = z.infer<typeof knowledgeRequestChangesFormSchema>;

export const knowledgeRejectFormSchema = z.object({
  comments: z
    .string()
    .trim()
    .min(1, "Comments are required when rejecting content")
    .max(COMMENTS_MAX, `Comments must be ${COMMENTS_MAX} characters or fewer`),
});

export type KnowledgeRejectFormValues = z.infer<typeof knowledgeRejectFormSchema>;
