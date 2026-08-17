# Symptom safety rules (`safety-rules-v1`)

Deterministic boolean rules only. Highest level wins.

## Emergency (`EMERGENCY`)

| Code           | Field                         |
| -------------- | ----------------------------- |
| SR-E-BREATHING | breathing_emergency           |
| SR-E-CHEST     | severe_chest_discomfort       |
| SR-E-LOC       | loss_of_consciousness         |
| SR-E-NECK      | severe_or_rapid_neck_swelling |
| SR-E-SWALLOW   | unable_to_swallow             |
| SR-E-BLEED     | uncontrolled_bleeding         |
| SR-E-CONFUSION | severe_new_confusion          |
| SR-E-UNSAFE    | feels_immediately_unsafe      |

## Urgent (`URGENT_MEDICAL_REVIEW`)

| Code           | Field                       |
| -------------- | --------------------------- |
| SR-U-WORSENING | rapidly_worsening_condition |

## Contact / routine

No CONTACT rules in v1. All-false → `ROUTINE_TRACKING` with non-reassuring wording (never “you are safe”).

## Prohibitions

- No free-text matching
- No diagnosis or treatment advice
- No DB-executable rules / eval
- Symptom type alone does not set EMERGENCY in v1
