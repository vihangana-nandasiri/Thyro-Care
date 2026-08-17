# Frontend bundle review

Date: 2026-07-11  
Context: deployment-hardening patch (no UI redesign).

## Before (representative Vite build output)

| Chunk                  | Approx size |
| ---------------------- | ----------- |
| Main JS                | ~347 kB     |
| Recharts / chart chunk | ~384 kB     |
| CSS                    | ~107 kB     |

## Observations

1. **Recharts** dominates a large async chunk — expected for Dashboard / Analytics / Medication charts.
2. Chart pages are already **route-lazy-loaded** via the app router; Recharts is not required on the landing/login critical path.
3. `src/app/components/ui/chart.tsx` wraps Recharts but is **not imported** by current pages (pages import `recharts` directly). Removing it is out of scope for this patch (do not remove packages/files solely as unused cleanup without product decision).
4. Large Zod / schema chunks are associated with form-heavy routes; already code-split with pages.

## Changes applied in this patch

None that claim performance wins. No chart library replacement; no risky manual chunk graph changes.

## Allowed follow-ups (deferred)

- Recharts v3 migration (see `recharts-v3-migration-plan.md`) may change chunk size — measure before/after.
- Optional: lazy-load chart subcomponents inside pages if profiling shows benefit.
- Optional: decide whether to delete unused `chart.tsx` wrapper.

## Claim policy

No performance improvement is claimed without measured before/after build output from an intentional optimization PR.
