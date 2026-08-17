# Phase 3 — Frontend Quality Foundation

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Status:** Complete

---

## TypeScript configuration

| File                 | Role                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`      | Solution references                                                                                                                                |
| `tsconfig.app.json`  | App sources: `strict`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, path alias `@/*` |
| `tsconfig.node.json` | Vite config typing                                                                                                                                 |

`noUncheckedIndexedAccess` deferred to avoid mass unsafe workarounds.

Script: `npm run typecheck` → `tsc -b`

---

## ESLint configuration

Flat config: `eslint.config.js`

- `@eslint/js` + `typescript-eslint` recommended
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `eslint-plugin-jsx-a11y`
- `eslint-config-prettier` (no style conflicts)

Ignores: `dist`, `node_modules`, `coverage`, `backups`, `scripts`, vendored `src/app/components/ui/**` and `figma/**`

Script: `npm run lint`

---

## Prettier configuration

- `.prettierrc` — semi, double quotes, trailing commas, width 100, LF
- `.prettierignore` — node_modules, dist, lockfiles, vendored UI

Scripts: `format`, `format:check`

---

## Package scripts

| Script         | Command                 |
| -------------- | ----------------------- |
| `dev`          | `vite`                  |
| `build`        | `vite build`            |
| `preview`      | `vite preview`          |
| `typecheck`    | `tsc -b --pretty false` |
| `lint`         | `eslint .`              |
| `format`       | `prettier --write .`    |
| `format:check` | `prettier --check .`    |

Tests deferred to Phase 17.

---

## Environment strategy

- `.env.example` — safe `VITE_*` examples only
- `src/config/env.ts` — typed immutable `env` object (`apiBaseUrl`, `appName`, `appEnvironment`, `isDevelopment`, `isProduction`)
- `src/vite-env.d.ts` — `ImportMetaEnv` declarations
- Components must not read `import.meta.env` directly

---

## Axios client foundation

- `src/services/api.ts` — baseURL from env, 15s timeout, JSON headers, stub interceptors
- `src/types/api.ts` — `ApiResponse`, `ApiErrorResponse`, `PaginatedResponse`, `AppError`, field errors
- `src/utils/apiError.ts` — `toAppError()` safe converter (no stack traces)

**No real API calls in Phase 3.** Mock UI behavior preserved.

---

## Error handling

| Layer       | Implementation                                                    |
| ----------- | ----------------------------------------------------------------- |
| Global      | `ErrorBoundary` in `AppProviders`                                 |
| Route       | Phase 2 `RouteErrorPage` / `errorElement`                         |
| Reusable UI | `LoadingState`, `EmptyState`, `ErrorState`, improved `PageLoader` |

---

## Toast architecture

- Existing `sonner` (no second library)
- `ToastProvider` in providers
- `useToast()` hook: success / error / warning / info
- Used sparingly: login, register, profile save, medication toggle, appointment create, symptom assess

---

## Form validation architecture

| Schema                  | Used by                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `authSchemas.ts`        | Login, Register (RHF + Zod)                                 |
| `profileSchemas.ts`     | Profile edit form                                           |
| `appointmentSchemas.ts` | Add Appointment dialog                                      |
| `symptomSchemas.ts`     | Symptom assessment gate                                     |
| `medicationSchemas.ts`  | Ready for medication forms (page uses toggle + toast today) |

Field errors use `aria-invalid` / `aria-describedby`. Focus moves to first invalid field on login/register.

---

## Responsive / mobile improvements

- Desktop sidebar unchanged (width / spacing / collapse)
- Mobile: hamburger in TopBar, overlay drawer, Escape close, body scroll lock, close on navigate
- Landing nav wraps on small screens
- Main content `p-4 sm:p-6`, truncated titles, chat/medication min-width guards

---

## Accessibility highlights

- Skip link → `#main-content`
- Icon button labels
- Switch roles on profile settings
- Tablist/tab roles on profile
- Chat `role="log"` + `aria-live`
- Focus-visible rings on interactive controls

Toward WCAG 2.1 AA practices — **not** a formal certification.

---

## Deferred backend work

- FastAPI / MongoDB / real JWT (Phases 4–6)
- Refresh-token interceptors
- AI chatbot API
- Admin pages
- Automated a11y / E2E tests (Phase 17)
- Production SPA hosting rewrites
