# Symptom safety content review

**Status:** REVIEW_REQUIRED — medical-expert sign-off pending.

## Items requiring expert review

1. All structured safety question labels (aligned with Emergency page themes).
2. User-facing messaging per `SafetyLevel` in `symptom_safety_rules.py`.
3. Mapping of boolean fields to emergency vs urgent levels.
4. Whether additional CONTACT_HEALTHCARE_TEAM rules should be added in a future version.
5. Emergency page phone placeholders remain demo content (not clinical directory data).

## Already constrained (engineering)

- No diagnosis language in API responses.
- Routine messaging does not claim the user is medically safe.
- App cannot contact emergency services; Emergency page states this.
- Free-text notes never affect classification.

Until signed off, treat copy as **review-required support wording**, not clinically approved decision support.
