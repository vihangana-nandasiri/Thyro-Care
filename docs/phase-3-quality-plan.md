# Phase 3 — Frontend Quality Plan

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Baseline:** Phase 2 commit `2175a82`  
**Pre-change build:** PASS (~5.6s)

---

## 1. Current tooling state

| Item                                | Status                                                        |
| ----------------------------------- | ------------------------------------------------------------- |
| `tsconfig.json`                     | Exists; `strict: true`; `noUnusedLocals/Parameters: false`    |
| `typescript` package                | **Not installed** (npx tsc fails)                             |
| `@types/react` / `@types/react-dom` | Not in package.json                                           |
| ESLint                              | **None**                                                      |
| Prettier                            | **None**                                                      |
| Scripts                             | Only `dev`, `build`                                           |
| `.env` / `.env.example`             | **None**                                                      |
| `src/vite-env.d.ts`                 | Vite client reference only                                    |
| Axios                               | **Not installed**                                             |
| Zod / `@hookform/resolvers`         | **Not installed**                                             |
| `react-hook-form`                   | Installed `7.55.0` (unused in app pages)                      |
| `sonner`                            | Installed `2.0.3` (UI wrapper exists; not wired in providers) |
| Document titles                     | Not set per route                                             |
| Global ErrorBoundary                | None (route `errorElement` only)                              |
| Skip link / `main-content` id       | Missing                                                       |
| Mobile sidebar drawer               | Missing (desktop collapse only)                               |

---

## 2. TypeScript risks

- No CLI `tsc` without installing `typescript`.
- Unused locals/parameters not enforced.
- `Input` / layout props use ambient `React` namespace without explicit import (works via JSX runtime but fragile under stricter checks).
- Forms use loosely typed `useState` strings with no schema.
- No centralized env typing for `ImportMetaEnv`.
- `noUncheckedIndexedAccess` deferred unless easy wins only (avoid mass unsafe workarounds).

**Plan:** Split/enhance `tsconfig` for Vite; enable unused checks; add `typecheck` script; fix all errors properly.

---

## 3. Linting risks

- Zero ESLint coverage today.
- Icon-only buttons lack `aria-label` (TopBar bell, chat attach/mic, sidebar collapse, profile camera).
- Custom toggles on Profile settings lack `role="switch"` / `aria-checked`.
- Unused imports may surface once rules enable.

**Plan:** Flat ESLint config (TS + React Hooks + jsx-a11y), ignore `dist`/`node_modules`/`src/app/components/ui` generated shadcn noise only if rules are too noisy — prefer fixing app code; keep shadcn ignored for stylistic noise if needed while still linting `src/pages`, `src/layouts`, `src/components/common`.

---

## 4. Accessibility risks

- No skip-to-main link.
- Main regions lack stable `id="main-content"`.
- Icon buttons without accessible names.
- Settings toggles not announced as switches.
- Form errors not associated (`aria-invalid` / `aria-describedby`).
- Tabs (Profile, Diet, Resources) are buttons without tablist semantics.
- Chat region not marked as log/live for new messages.
- Collapsed sidebar shows icons only — need labels via `aria-label` on NavLinks when collapsed.
- Focus-visible may rely on browser defaults inconsistently.

---

## 5. Form-validation requirements

| Form        | Current                                | Action                                               |
| ----------- | -------------------------------------- | ---------------------------------------------------- |
| Login       | Controlled state, no validation        | RHF + Zod                                            |
| Register    | Uncontrolled-ish Inputs, no validation | RHF + Zod                                            |
| Profile     | Read-only fields + settings toggles    | Editable personal form + Zod; switch a11y            |
| Medication  | Toggle taken only — **no create form** | Schema ready; toast on mark taken; optional note N/A |
| Appointment | “Add Appointment” button only          | Lightweight modal form + Zod                         |
| Symptoms    | Selection + severity slider            | Validate selection required before assess            |

Schemas under `src/schemas/` for existing flows only.

---

## 6. Mobile-navigation risks

- Sidebar always visible with fixed width — on ~320–375px it consumes most of the viewport.
- No hamburger / overlay drawer.
- TopBar has no menu control.

**Plan:** `md+` keep current sidebar; `<md` off-canvas drawer with overlay, Escape close, body scroll lock, close on navigate. Desktop width/spacing unchanged.

---

## 7. Environment configuration strategy

- `.env.example` with safe Vite vars only.
- `src/config/env.ts` typed immutable config with defaults for development.
- Extend `vite-env.d.ts` for `ImportMetaEnv`.
- No secrets; no scattered `import.meta.env` in components.

---

## 8. API-client foundation strategy

- Install `axios`.
- `src/services/api.ts` — baseURL from env, timeout, JSON headers, stub interceptors.
- `src/types/api.ts` + `src/utils/apiError.ts` — typed safe errors.
- **No real API calls**; mocks remain.

---

## 9. Error-handling strategy

- Global `ErrorBoundary` around providers/shell.
- Keep Phase 2 route `errorElement`.
- Reusable `LoadingState`, `EmptyState`, `ErrorState`.
- Improve `PageLoader` (aria-live).
- Toasts via existing `sonner` (avoid second toast library).

---

## 10. Validation strategy

After each major step:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run format:check`
4. `npm run build`

Manual: routes, forms, keyboard, mobile drawer, responsive widths, UI regression.

**Complete Phase 3 only if all scripts pass.**

---

## Out of scope

- Phase 4 backend / FastAPI / MongoDB
- Real JWT auth
- AI services
- Admin pages
- Dependency purge of Figma/Radix
- Frontend test suite (Phase 17)
