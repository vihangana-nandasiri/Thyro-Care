# Medication adherence calculation

## Formula

\[
\text{adherence_percentage} = \frac{\text{taken_count}}{\text{total_eligible}} \times 100
\]

When `total_eligible` is 0, `adherence_percentage` is **null** (not 0).

## Eligible scheduled doses (denominator)

Past scheduled occurrences within the requested date range that:

- Belong to non-deleted medications owned by the patient
- Are not `as_needed`
- Fall within the medication’s `start_date`–`end_date`
- Have medication `status` appropriate for scheduling (`active`)
- Are not in the future (relative to “now” UTC)
- Are not SKIPPED (see below)

## Status treatment

| Status        | Effect                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------- |
| TAKEN         | Counts toward numerator and eligible                                                      |
| MISSED        | Eligible, not taken                                                                       |
| SKIPPED       | Counted in `skipped_count`; **excluded from denominator** (intentional non-clinical skip) |
| Unlogged past | Eligible, not taken (`unlogged_count`)                                                    |

## AS_NEEDED

Excluded from automatic schedule generation and from adherence eligible doses. Explicit patient logs for AS_NEEDED are allowed but do not enter the Phase 8 adherence denominator.

## Future doses

Future occurrences are excluded from eligible counts.

## Response fields

- `adherence_percentage`
- `total_eligible`
- `taken_count`
- `missed_count`
- `skipped_count`
- `unlogged_count`
- `date_from` / `date_to`

## Limitations

- Tracking metric only.
- Does not assess clinical safety or treatment success.
- Does not advise catch-up dosing.
- Date ranges are bounded (same max window as schedule service).
- Chart UI may show status composition for the selected period; it is not a clinical score.

## No clinical interpretation

API and UI must not describe percentages as safe/unsafe or prescribe behavior.
