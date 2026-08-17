"""Typed string enums for persistence (stable string values)."""

from __future__ import annotations

from enum import StrEnum


class UserRole(StrEnum):
    PATIENT = "patient"
    ADMIN = "admin"
    MEDICAL_EXPERT = "medical_expert"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class AuthActionPurpose(StrEnum):
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class AuthIdentityProvider(StrEnum):
    GOOGLE = "google"


class MedicationStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DISCONTINUED = "discontinued"


class MedicationLogStatus(StrEnum):
    TAKEN = "taken"
    MISSED = "missed"
    SKIPPED = "skipped"


class MedicationFrequency(StrEnum):
    ONCE_DAILY = "once_daily"
    TWICE_DAILY = "twice_daily"
    THREE_TIMES_DAILY = "three_times_daily"
    FOUR_TIMES_DAILY = "four_times_daily"
    WEEKLY = "weekly"
    AS_NEEDED = "as_needed"
    CUSTOM = "custom"


class AppointmentStatus(StrEnum):
    UPCOMING = "upcoming"
    COMPLETED = "completed"
    MISSED = "missed"
    CANCELLED = "cancelled"


class AppointmentType(StrEnum):
    TSH_TEST = "tsh_test"
    BLOOD_TEST = "blood_test"
    DOCTOR_CONSULTATION = "doctor_consultation"
    ULTRASOUND = "ultrasound"
    RAI_FOLLOW_UP = "rai_follow_up"
    MEDICATION_REVIEW = "medication_review"
    GENERAL_FOLLOW_UP = "general_follow_up"
    OTHER = "other"


class AppointmentLocationType(StrEnum):
    IN_PERSON = "in_person"
    TELEHEALTH = "telehealth"
    PHONE = "phone"
    OTHER = "other"


class SymptomGuidanceLevel(StrEnum):
    """Legacy symptom_log guidance levels (foundation). Prefer SafetyLevel for Phase 10."""

    SELF_CARE = "self_care"
    CONTACT_PROVIDER = "contact_provider"
    URGENT_MEDICAL_HELP = "urgent_medical_help"


class SymptomSeverity(StrEnum):
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


class SymptomStatus(StrEnum):
    ACTIVE = "active"
    IMPROVING = "improving"
    RESOLVED = "resolved"


class SymptomFrequency(StrEnum):
    ONCE = "once"
    OCCASIONAL = "occasional"
    DAILY = "daily"
    FREQUENT = "frequent"
    CONTINUOUS = "continuous"


class SymptomType(StrEnum):
    FATIGUE = "fatigue"
    NECK_PAIN = "neck_pain"
    NECK_SWELLING = "neck_swelling"
    VOICE_CHANGE = "voice_change"
    SWALLOWING_DIFFICULTY = "swallowing_difficulty"
    BREATHING_DIFFICULTY = "breathing_difficulty"
    PALPITATIONS = "palpitations"
    DIZZINESS = "dizziness"
    NUMBNESS_OR_TINGLING = "numbness_or_tingling"
    MUSCLE_CRAMPING = "muscle_cramping"
    TEMPERATURE_SENSITIVITY = "temperature_sensitivity"
    SLEEP_DIFFICULTY = "sleep_difficulty"
    MOOD_CHANGE = "mood_change"
    DIGESTIVE_CHANGE = "digestive_change"
    WEIGHT_CHANGE = "weight_change"
    OTHER = "other"


class SafetyLevel(StrEnum):
    ROUTINE_TRACKING = "routine_tracking"
    CONTACT_HEALTHCARE_TEAM = "contact_healthcare_team"
    URGENT_MEDICAL_REVIEW = "urgent_medical_review"
    EMERGENCY = "emergency"


class KnowledgeStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    PENDING_REVIEW = "pending_review"
    CHANGES_REQUESTED = "changes_requested"
    APPROVED = "approved"
    REJECTED = "rejected"
    ARCHIVED = "archived"
    RETIRED = "retired"


# Phase 12 unifies review + lifecycle status onto a single enum.
KnowledgeReviewStatus = KnowledgeStatus


class KnowledgeReviewDecision(StrEnum):
    APPROVE = "approve"
    REQUEST_CHANGES = "request_changes"
    REJECT = "reject"
    RETIRE = "retire"
    RESTORE = "restore"


class KnowledgeLanguage(StrEnum):
    ENGLISH = "english"
    SINHALA = "sinhala"
    TAMIL = "tamil"


class KnowledgeTopic(StrEnum):
    THYROIDECTOMY_RECOVERY = "thyroidectomy_recovery"
    THYROID_CANCER_SURVIVORSHIP = "thyroid_cancer_survivorship"
    MEDICATION_EDUCATION = "medication_education"
    FOLLOW_UP_EDUCATION = "follow_up_education"
    SYMPTOM_AWARENESS = "symptom_awareness"
    NUTRITION_EDUCATION = "nutrition_education"
    EMERGENCY_AWARENESS = "emergency_awareness"
    GENERAL_EDUCATION = "general_education"
    OTHER = "other"


class ChatMessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatSessionStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ChatResponseMode(StrEnum):
    GROUNDED_ANSWER = "grounded_answer"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    SAFETY_REDIRECT = "safety_redirect"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    POLICY_REFUSAL = "policy_refusal"


class FeedbackType(StrEnum):
    HELPFUL = "helpful"
    NOT_HELPFUL = "not_helpful"
    REPORT = "report"


class FeedbackRating(StrEnum):
    UP = "up"
    DOWN = "down"


class FeedbackReasonCode(StrEnum):
    HELPFUL = "HELPFUL"
    CLEAR = "CLEAR"
    SOURCE_HELPFUL = "SOURCE_HELPFUL"
    NOT_RELEVANT = "NOT_RELEVANT"
    UNCLEAR = "UNCLEAR"
    MISSING_SOURCE = "MISSING_SOURCE"
    TOO_GENERAL = "TOO_GENERAL"
    SAFETY_CONCERN = "SAFETY_CONCERN"
    OTHER = "OTHER"


class EvidenceCoverage(StrEnum):
    HIGH = "high"
    PARTIAL = "partial"
    INSUFFICIENT = "insufficient"


class StructuredResponseCategory(StrEnum):
    EDUCATION = "education"
    BOUNDARY = "boundary"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class EmergencyEventStatus(StrEnum):
    DETECTED = "detected"
    ACKNOWLEDGED = "acknowledged"
    REVIEWED = "reviewed"
    CLOSED = "closed"


class AssessmentSource(StrEnum):
    USER_FORM = "user_form"
    RULE_ENGINE = "rule_engine"
    SYSTEM = "system"


class AgeRange(StrEnum):
    UNDER_18 = "under_18"
    AGE_18_29 = "age_18_29"
    AGE_30_39 = "age_30_39"
    AGE_40_49 = "age_40_49"
    AGE_50_59 = "age_50_59"
    AGE_60_69 = "age_60_69"
    AGE_70_PLUS = "age_70_plus"
    PREFER_NOT_TO_SAY = "prefer_not_to_say"


class PreferredLanguage(StrEnum):
    ENGLISH = "english"
    SINHALA = "sinhala"
    TAMIL = "tamil"


class RAITreatmentStatus(StrEnum):
    NOT_PLANNED = "not_planned"
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NOT_APPLICABLE = "not_applicable"
    UNKNOWN = "unknown"


class TreatmentStage(StrEnum):
    POST_SURGERY = "post_surgery"
    PRE_RAI = "pre_rai"
    POST_RAI = "post_rai"
    FOLLOW_UP = "follow_up"
    LONG_TERM_SURVIVORSHIP = "long_term_survivorship"
    UNKNOWN = "unknown"
