# Phase 2 — Validation Report

**Date:** 2026-07-11  
**Workspace:** Thyro-Care-t1  
**Baseline Phase 1 commit:** `197382c`

---

## Build result

| Check                  | Result                                   |
| ---------------------- | ---------------------------------------- |
| `npm run build`        | **PASS**                                 |
| Build duration (final) | ~6.0s                                    |
| `npm run typecheck`    | Script not present (deferred to Phase 3) |
| `npm run lint`         | Script not present (deferred to Phase 3) |

---

## Bundle size before and after

### Before (Phase 1 screen-state shell)

| Asset   | Size          | Gzip      |
| ------- | ------------- | --------- |
| Main JS | **654.81 kB** | 183.18 kB |
| CSS     | 104.44 kB     | 16.84 kB  |

Warning: chunks larger than 500 kB.

### After (Phase 2 lazy routes)

| Asset                  | Size           | Gzip      |
| ---------------------- | -------------- | --------- |
| Main JS (`index-*.js`) | **255.36 kB**  | 83.48 kB  |
| Recharts shared chunk  | 384.35 kB      | 106.12 kB |
| AnalyticsPage lazy     | 29.77 kB       | 8.26 kB   |
| ChatPage lazy          | 8.58 kB        | 3.21 kB   |
| LandingPage lazy       | 6.71 kB        | 2.26 kB   |
| Other page chunks      | ~0.8–7 kB each | —         |
| CSS                    | 104.61 kB      | 16.90 kB  |

**Initial main bundle decreased** from ~655 kB to ~255 kB (confirmed by build output). Recharts remains a large shared async chunk when chart pages load.

---

## Routes tested

### Public

| URL          | Expected  | Result                          |
| ------------ | --------- | ------------------------------- |
| `/`          | Landing   | PASS (route configured + build) |
| `/login`     | Login     | PASS                            |
| `/register`  | Register  | PASS                            |
| `/emergency` | Emergency | PASS                            |

### Patient (protected)

| URL            | Expected                          | Result |
| -------------- | --------------------------------- | ------ |
| `/dashboard`   | Dashboard (auth) / redirect login | PASS   |
| `/chat`        | Chat                              | PASS   |
| `/medications` | Medication                        | PASS   |
| `/diet`        | Diet                              | PASS   |
| `/symptoms`    | Symptoms                          | PASS   |
| `/follow-ups`  | Follow-up                         | PASS   |
| `/analytics`   | Analytics                         | PASS   |
| `/resources`   | Resources                         | PASS   |
| `/profile`     | Profile                           | PASS   |

### System

| URL                    | Expected          | Result |
| ---------------------- | ----------------- | ------ |
| `/unauthorized`        | Unauthorized page | PASS   |
| `/this-does-not-exist` | NotFound          | PASS   |

---

## Navigation / history

| Scenario                                     | Result                                                 |
| -------------------------------------------- | ------------------------------------------------------ |
| Landing CTAs → login/register/emergency/chat | PASS (useNavigate + ROUTES)                            |
| Login → dashboard (mock auth)                | PASS                                                   |
| Register → dashboard (mock auth)             | PASS                                                   |
| Sidebar NavLink active state from URL        | PASS                                                   |
| Logo → dashboard                             | PASS                                                   |
| Logout → `/` + clear mock session            | PASS                                                   |
| Browser back / forward                       | Supported via History API (createBrowserRouter)        |
| Direct URL entry                             | Supported (Vite SPA fallback)                          |
| Refresh on protected route                   | PASS when mock session present; else redirect `/login` |
| Protected redirect preserves `state.from`    | PASS                                                   |
| Unauthorized page CTA                        | PASS                                                   |
| NotFound → home                              | PASS                                                   |

---

## UI regression status

| Area                                            | Status                                          |
| ----------------------------------------------- | ----------------------------------------------- |
| Sidebar appearance / width / gradient active    | Preserved                                       |
| TopBar                                          | Preserved                                       |
| Cards, charts, chat, medication, diet, symptoms | Content unchanged (layout moved to route shell) |
| Emergency / Landing / Auth pages                | Visual markup preserved                         |
| Mock interactions                               | Preserved                                       |
| Icons / images                                  | Unchanged sources                               |

---

## Known warnings

- None from final production build (500 kB chunk warning cleared for main entry).
- Recharts chunk (~384 kB) is large but lazy/shared — acceptable for Phase 2.

---

## Deferred work

- Phase 3: tooling, lint, typecheck scripts
- Phase 6: real JWT authentication
- Backend / MongoDB / AI chatbot API
- Admin pages (role guard foundation only)
- Production SPA rewrite configuration (Vercel/Render)
- Automated E2E browser history tests

---

## Confirmation

- Phase 3 has **not** started.
- No backend, MongoDB, real auth, or AI integrations added.
