# Phase 2 — Routing Architecture

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Status:** Complete

---

## Routing library and version

| Package            | Version       | Notes                                                                                                                                               |
| ------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react-router`     | **7.13.0**    | Already installed in Phase 1. DOM APIs (`createBrowserRouter`, `RouterProvider`, `Link`, `NavLink`, `Outlet`, etc.) ship from `react-router` in v7. |
| `react-router-dom` | Not installed | Not required for RR v7.                                                                                                                             |

**API:** `createBrowserRouter` + `RouterProvider` (single approach; no `BrowserRouter` mix).

---

## Route hierarchy

```
AppProviders (mock AuthProvider)
└── RouterProvider
    └── RootLayout (ScrollToTop + Suspense)
        ├── PublicLayout
        │   ├── /              LandingPage
        │   └── /emergency     EmergencyPage
        ├── AuthLayout
        │   ├── /login         LoginPage
        │   └── /register      RegisterPage
        ├── ProtectedRoute
        │   └── DashboardLayout (Sidebar + TopBar + Outlet)
        │       ├── /dashboard
        │       ├── /chat
        │       ├── /medications
        │       ├── /diet
        │       ├── /symptoms
        │       ├── /follow-ups
        │       ├── /analytics
        │       ├── /resources
        │       └── /profile
        ├── /unauthorized
        └── * (NotFound)
```

Path constants: `src/constants/routes.ts` (`ROUTES`, `SCREEN_PATH`, `ROUTE_TITLES`).

---

## Public routes

| Path            | Page             |
| --------------- | ---------------- |
| `/`             | LandingPage      |
| `/login`        | LoginPage        |
| `/register`     | RegisterPage     |
| `/emergency`    | EmergencyPage    |
| `/unauthorized` | UnauthorizedPage |
| `*`             | NotFoundPage     |

---

## Protected routes (patient)

Require mock `isAuthenticated`. Otherwise redirect to `/login` with `state.from`.

| Path           | Page           |
| -------------- | -------------- |
| `/dashboard`   | DashboardPage  |
| `/chat`        | ChatPage       |
| `/medications` | MedicationPage |
| `/diet`        | DietPage       |
| `/symptoms`    | SymptomsPage   |
| `/follow-ups`  | FollowUpPage   |
| `/analytics`   | AnalyticsPage  |
| `/resources`   | ResourcesPage  |
| `/profile`     | ProfilePage    |

---

## Layout nesting

| Layout          | File                              | Behavior                                                |
| --------------- | --------------------------------- | ------------------------------------------------------- |
| PublicLayout    | `src/layouts/PublicLayout.tsx`    | Pass-through `Outlet` (pages keep own chrome)           |
| AuthLayout      | `src/layouts/AuthLayout.tsx`      | Pass-through `Outlet`                                   |
| DashboardLayout | `src/layouts/DashboardLayout.tsx` | Sidebar + TopBar + `Outlet`; titles from `ROUTE_TITLES` |

Patient pages no longer wrap themselves in `DashboardLayout` (duplication removed without visual change).

---

## Mock authentication behavior

**File:** `src/context/AuthContext.tsx`

> Temporary mock authentication for routing demonstration. Replace during Phase 6.

- Shape: `{ id, name, email, role, isAuthenticated }`
- Roles: `PATIENT` | `ADMIN` | `MEDICAL_EXPERT`
- Persistence: `sessionStorage` key `thyrocare_mock_auth` — `{ authenticated, role }` only (no PHI)
- Login / Register → mock PATIENT → navigate `/dashboard` (or `state.from` after protected redirect)
- Logout → clear storage → `/`
- Refresh-safe for protected URLs after mock login

**This is not real authentication.** No JWT, no API, no secure session.

---

## Role guard foundation

**File:** `src/components/common/RoleProtectedRoute.tsx`

- Accepts `allowedRoles`
- Unauthenticated → `/login`
- Wrong role → `/unauthorized`
- No admin pages mounted in Phase 2
- Constant `ROUTES.ADMIN_ROOT` (`/admin`) reserved for future use

---

## Lazy-loading strategy

All page components use `React.lazy` + root `Suspense` with `PageLoader`.

Shared chrome (Sidebar, TopBar, guards, common atoms) remains eagerly loaded.

---

## Navigation migration

| Before                     | After                              |
| -------------------------- | ---------------------------------- |
| `useState<Screen>` in App  | URL routes                         |
| `setScreen(...)`           | `useNavigate` / `NavLink` / `Link` |
| `SetScreen` props          | Removed                            |
| Sidebar `current` prop     | `NavLink` `isActive`               |
| Per-page `DashboardLayout` | Nested layout route                |

---

## Scroll restoration

`src/components/common/ScrollToTop.tsx` — `window.scrollTo(0, 0)` on pathname change. Does not manage chat message list scroll.

---

## Route error handling

Root `errorElement`: `RouteErrorPage` — user-safe message, stack traces only in console, return-home action.

---

## Direct URL / refresh / SPA hosting

Vite dev server provides SPA fallback automatically.

**Production note (deferred to deployment phase):** static hosts must rewrite all paths to `index.html`. Do not add Vercel/Render config in Phase 2.

---

## Future real-auth replacement (Phase 6)

Replace `AuthContext` mock with real JWT/session provider:

1. Swap `login`/`logout` to API calls
2. Keep `ProtectedRoute` / `RoleProtectedRoute` interfaces
3. Remove `sessionStorage` mock flag
4. Wire token refresh / expiry without changing route table
