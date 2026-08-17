# Phase 2 — Routing Plan

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Prerequisite:** Phase 1 complete (`App.tsx` ~50 lines, 13 pages, screen-state navigation)

---

## 1. Current navigation architecture

- Root `App.tsx` holds `useState<Screen>("landing")` and a `Record<Screen, ReactNode>` switch.
- Every page receives `setScreen: SetScreen` and calls it for navigation.
- Patient pages each wrap content in `DashboardLayout` (Sidebar + TopBar), passing `screen` + `setScreen`.
- `Sidebar` highlights via `current === item.id`; logout calls `setScreen("landing")`.
- `TopBar` avatar navigates to profile via `setScreen("profile")`.
- No `BrowserRouter` is mounted. `src/app/router.tsx` is a Phase 2 placeholder.
- `AppProviders` is a pass-through (no Auth/Router yet).

### Screen → page mapping (Phase 1)

| Screen id    | Page component | Layout today     | Access      |
| ------------ | -------------- | ---------------- | ----------- |
| `landing`    | LandingPage    | Full-page (self) | Public      |
| `login`      | LoginPage      | Full-page (self) | Public      |
| `register`   | RegisterPage   | Full-page (self) | Public      |
| `emergency`  | EmergencyPage  | Full-page (self) | Public      |
| `dashboard`  | DashboardPage  | DashboardLayout  | Patient app |
| `chat`       | ChatPage       | DashboardLayout  | Patient app |
| `medication` | MedicationPage | DashboardLayout  | Patient app |
| `diet`       | DietPage       | DashboardLayout  | Patient app |
| `symptoms`   | SymptomsPage   | DashboardLayout  | Patient app |
| `followup`   | FollowUpPage   | DashboardLayout  | Patient app |
| `progress`   | AnalyticsPage  | DashboardLayout  | Patient app |
| `education`  | ResourcesPage  | DashboardLayout  | Patient app |
| `profile`    | ProfilePage    | DashboardLayout  | Patient app |

### Callbacks to replace

- Landing: Sign In, Get Started, Emergency, Start Journey, Try AI Chat, CTA buttons
- Login: Sign In → dashboard, Create one → register
- Register: Back → landing, Create Account → dashboard, Sign in → login
- Sidebar: nav items, Emergency, Logout
- TopBar: avatar → profile
- Dashboard: feature card clicks
- ChatSafetyBanner / Symptoms: Emergency Help
- Emergency: back → dashboard

---

## 2. Router dependency

| Package        | Version                        | Notes                                                                                         |
| -------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `react-router` | **7.13.0** (already installed) | Includes DOM APIs (`BrowserRouter`, `createBrowserRouter`, `Link`, `NavLink`, `Outlet`, etc.) |

**Decision:** Use existing `react-router@7.13.0`. Do **not** install `react-router-dom` — React Router v7 ships DOM exports from `react-router`.

**API choice:** `createBrowserRouter` + `RouterProvider` (supports `errorElement`, nested layouts, lazy routes cleanly). Do not also mount `BrowserRouter`.

**Package change:** None expected.

---

## 3. Target route hierarchy

```
RouterProvider (createBrowserRouter)
└── App shell (providers + ScrollToTop)
    ├── PublicLayout
    │   ├── /              → LandingPage
    │   └── /emergency     → EmergencyPage
    ├── AuthLayout
    │   ├── /login         → LoginPage
    │   └── /register      → RegisterPage
    ├── ProtectedRoute (mock auth)
    │   └── DashboardLayout (Outlet)
    │       ├── /dashboard     → DashboardPage
    │       ├── /chat          → ChatPage
    │       ├── /medications   → MedicationPage
    │       ├── /diet          → DietPage
    │       ├── /symptoms      → SymptomsPage
    │       ├── /follow-ups    → FollowUpPage
    │       ├── /analytics     → AnalyticsPage
    │       ├── /resources     → ResourcesPage
    │       └── /profile       → ProfilePage
    ├── /unauthorized      → UnauthorizedPage
    └── *                  → NotFoundPage
```

Future (constants only, no pages): `ADMIN_ROOT: "/admin"` for role-guard typing.

---

## 4. Public routes

- `/` — Landing
- `/login` — Login
- `/register` — Register
- `/emergency` — Emergency
- `/unauthorized` — Unauthorized (system)
- `*` — Not Found (system)

---

## 5. Protected routes (patient)

All require mock `isAuthenticated === true`; otherwise redirect to `/login` with `state.from`.

- `/dashboard`, `/chat`, `/medications`, `/diet`, `/symptoms`
- `/follow-ups`, `/analytics`, `/resources`, `/profile`

---

## 6. Layout nesting strategy

| Layout            | Role                                    | Visual change                                                       |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `PublicLayout`    | Outlet wrapper; minimal (no chrome)     | None — pages keep their own chrome                                  |
| `AuthLayout`      | Outlet wrapper for login/register       | None — pages keep existing two-panel / form UI                      |
| `DashboardLayout` | Sidebar + TopBar + `<Outlet />`         | Same chrome; **removed from individual pages** to avoid duplication |
| Title             | Derived from pathname map inside layout | Same title strings as Phase 1                                       |

---

## 7. Temporary mock authentication strategy

- File: `src/context/AuthContext.tsx`
- Comment: _Temporary mock authentication for routing demonstration. Replace during Phase 6._
- Shape: `{ id, name, email, role, isAuthenticated }`
- Roles: `PATIENT` | `ADMIN` | `MEDICAL_EXPERT`
- Persistence: `sessionStorage` key `thyrocare_mock_auth` storing only `{ authenticated: boolean, role: string }` — no PHI
- Default: unauthenticated on first visit
- `login()` → set PATIENT + navigate `/dashboard` (or `state.from`)
- `register()` → same as login (matches current Create Account → dashboard)
- `logout()` → clear session → `/`
- Refresh: read sessionStorage so protected URLs stay reachable after mock login

---

## 8. Role-protection foundation

- `RoleProtectedRoute` accepts `allowedRoles: UserRole[]`
- Unauthenticated → `/login`
- Authenticated but wrong role → `/unauthorized`
- No admin pages created in Phase 2
- Patient routes use `ProtectedRoute` (auth only); role guard ready for future `/admin`

---

## 9. Lazy-loading strategy

- All page components via `React.lazy(() => import(...))`
- Shared Suspense fallback: minimal neutral centered spinner (no new design system)
- Do not lazy-load Sidebar, TopBar, guards, or tiny common components
- Goal: shrink initial JS vs Phase 1 monolithic ~655 kB main chunk

---

## 10. Risks

| Risk                                                            | Mitigation                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Visual regression from layout move                              | Keep DashboardLayout markup identical; only swap `children` → `Outlet`        |
| Redirect loops (login ↔ protected)                             | Guards skip redirect when already on auth routes; logout clears storage first |
| “Try AI Chat Free” hits protected `/chat`                       | Redirect to login with `from`; after mock login resume intended path          |
| Emergency back to dashboard while logged out                    | Navigate to `/dashboard` if authed else `/`                                   |
| Nested interactive elements                                     | Use `NavLink`/`Link` with existing button classes; no button-in-button        |
| Screen id vs URL path mismatch (`medication` vs `/medications`) | Central `ROUTES` + path map in navigation constants                           |
| Chat internal scroll vs scroll-to-top                           | `ScrollToTop` only on pathname change; does not touch chat message list       |

---

## 11. Validation strategy

1. `npm run build` after major routing milestones
2. Manual URL matrix (public + patient + system)
3. Browser back/forward, refresh, direct entry
4. Protected redirect + unauthorized + 404
5. UI spot-check: sidebar, top bar, charts, chat, cards
6. Record bundle sizes before/after in `docs/phase-2-validation.md`

**Baseline build (pre-Phase 2):** PASS in ~6.45s — main JS `654.81 kB` / gzip `183.18 kB`; CSS `104.44 kB`.

---

## 12. Out of scope (do not start)

- Phase 3 tooling/lint
- Real JWT auth, MongoDB, backend, AI chatbot API
- Admin pages, deployment SPA rewrites (document only)
- UI redesign
