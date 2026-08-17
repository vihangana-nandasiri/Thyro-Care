# Dependency Cleanup Recommendations

**Phase:** Recorded in Phase 1 — **do not remove packages in Phase 1** unless proven unused and build-safe.

The frontend originated as a Figma Make export (`@figma/my-make-file`) with a large dependency surface. Many packages are unused by application screens.

## Likely unused by current App / pages

| Package                                              | Notes                               |
| ---------------------------------------------------- | ----------------------------------- |
| `@mui/material`, `@mui/icons-material`, `@emotion/*` | Not imported by app screens         |
| `motion`                                             | Not used                            |
| `canvas-confetti`                                    | Not used                            |
| `react-dnd`, `react-dnd-html5-backend`               | Not used                            |
| `react-slick`                                        | Not used                            |
| `react-responsive-masonry`                           | Not used                            |
| `embla-carousel-react`                               | Only via unused shadcn carousel     |
| Most `@radix-ui/*`                                   | Present for unused shadcn `ui/` kit |

## Keep for now

| Package                    | Reason                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `react-router`             | Required in Phase 2                                              |
| `react-hook-form`          | Planned Phase 3 forms                                            |
| `recharts`, `lucide-react` | Actively used                                                    |
| `sonner`, `next-themes`    | Likely Phase 3 toast/theme                                       |
| shadcn / Radix tree        | Do not purge solely for unused status (Figma/Make compatibility) |

## Recommended Phase 3 action

1. Run dependency audit / unused import analysis.
2. Remove only packages with zero imports after Router + forms land.
3. Re-run `npm run build` after each removal batch.
