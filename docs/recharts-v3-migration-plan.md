# Recharts v3 migration plan (deferred)

Date: 2026-07-11

## Current state

- Dependency: `recharts@2.15.2` (npm reports deprecated / not actively maintained)
- Latest line: `recharts@3.9.2`
- Direct imports in:
  - `src/pages/DashboardPage.tsx`
  - `src/pages/AnalyticsPage.tsx`
  - `src/pages/MedicationPage.tsx`
  - `src/app/components/ui/chart.tsx` (shadcn-style wrapper; unused by pages today)

## Decision for this patch

**Do not upgrade in the deployment-hardening patch.**

## Blockers / risk

1. Major version jump (2 → 3) with API and typing changes.
2. Chart wrapper (`chart.tsx`) imports `recharts` as a namespace and assumes v2 primitives.
3. Requirement: no UI redesign; visual parity must be validated across Dashboard, Analytics, Medication, mobile layouts.
4. Uncontrolled major upgrades are forbidden in this patch without proven equivalence.

## Proposed future migration steps

1. Branch / dedicated PR (not mixed with deploy config).
2. Upgrade to `recharts@3.9.2` + install `react-is` if required by peers.
3. Fix type errors in pages and `chart.tsx`.
4. Visual QA for all chart routes desktop + mobile.
5. Compare bundle size before/after.
6. Remove deprecation warning only after upgrade is verified.

## Status

Deferred technical debt. Deprecation warning remains until a dedicated migration PR lands.
