# Phase 1 — Frontend Structural Refactor Plan

**Date:** 2026-07-11  
**Workspace:** `Thyro-Care-t1`  
**Baseline commit:** `2d69852`  
**App.tsx before Phase 1:** 1,378 lines

---

## 1. Existing App.tsx responsibilities

`src/app/App.tsx` currently owns:

| Responsibility                                  | Status               |
| ----------------------------------------------- | -------------------- |
| All 13 screen UI implementations                | **Still inline**     |
| Root `screen` state + screen map                | Inline               |
| Imports of common UI, layouts, mocks, constants | Already wired        |
| Chat local state (`msgs`, `typing`, `input`)    | Inline in ChatScreen |
| Medication taken-state                          | Inline               |
| Diet / symptoms / profile tab state             | Inline               |

Navigation remains `setScreen(Screen)` — **no React Router in Phase 1**.

---

## 2. Already extracted (pre–Phase 1)

### Common UI — `src/components/common/`

- `Card`, `Badge`, `Button` (`Btn`), `Input`, `Avatar`

### Layouts — `src/layouts/`

- `Sidebar`, `TopBar`, `DashboardLayout`

### Constants — `src/constants/`

- `colors.ts`, `navigation.ts`, `status.ts`

### Mock data — `src/data/mock/`

- `user`, `medications`, `appointments`, `analytics`, `diet`, `chat`, `articles`, `notifications`, `dashboard` (+ barrel `index.ts`)

### Types — `src/types/`

- `Screen`, `ChatMsg`

### Placeholders

- `pages/`, `hooks/`, `context/`, `services/`, `utils/` (`.gitkeep` only)

---

## 3. Remaining inline pages (to extract)

1. `LandingScreen` → `LandingPage.tsx`
2. `LoginScreen` → `LoginPage.tsx`
3. `RegisterScreen` → `RegisterPage.tsx`
4. `EmergencyScreen` → `EmergencyPage.tsx`
5. `DashboardScreen` → `DashboardPage.tsx`
6. `MedicationScreen` → `MedicationPage.tsx`
7. `FollowupScreen` → `FollowUpPage.tsx`
8. `DietScreen` → `DietPage.tsx`
9. `SymptomsScreen` → `SymptomsPage.tsx`
10. `EducationScreen` → `ResourcesPage.tsx`
11. `ProgressScreen` → `AnalyticsPage.tsx`
12. `ProfileScreen` → `ProfilePage.tsx`
13. `ChatScreen` → `ChatPage.tsx` (last)

**Admin pages:** Not present in UI → **deferred to Phase 16** (do not invent).

---

## 4. Remaining inline / missing components

| Candidate                                                | Action                                                   |
| -------------------------------------------------------- | -------------------------------------------------------- |
| BrandLogo (Heart + gradient mark, repeated)              | Extract if used ≥2 places                                |
| StatCard / quick-action patterns                         | Extract only clear repeated blocks                       |
| ChatBubble, TypingIndicator, ChatInput, ChatSafetyBanner | Extract from Chat                                        |
| Medication card row                                      | Extract `MedicationCard`                                 |
| Appointment timeline item                                | Extract `AppointmentCard` / `TimelineItem`               |
| Avatar `w-${size}` dynamic classes                       | Fix with size map (same pixels)                          |
| Modal / Select / LoadingState / etc.                     | **Skip** if not already in UI                            |
| PublicLayout / AuthLayout                                | Optional thin wrappers only if they match current markup |

---

## 5. Planned extraction order

1. Write this plan (no code)
2. Ensure folder structure
3. Expand shared types
4. Confirm/align constants + mock file naming
5. Fix Avatar size map + BrandLogo
6. Extract feature components (conservative)
7. Split pages in order: Landing → Login → Register → Emergency → Dashboard → Medication → Follow-up → Diet → Symptoms → Resources → Analytics → Profile → Chat
8. Shrink `App.tsx` to screen switcher
9. Cleanup + docs + commit

Build after: types/constants/mocks, Avatar fix, every 2–3 pages, final App.tsx.

---

## 6. Risk areas

| Risk               | Mitigation                   |
| ------------------ | ---------------------------- |
| Visual drift       | Copy JSX/classNames verbatim |
| Broken imports     | Build after each batch       |
| Chat state loss    | Keep hooks inside `ChatPage` |
| Over-fragmentation | No one-line wrappers         |
| Accidental Router  | Explicitly forbidden         |
| Admin invention    | Skip; document deferred      |

---

## 7. Validation strategy

- `npm run build` after each major batch
- Manual screen checklist in `docs/phase-1-validation.md`
- Compare App.tsx line count before/after
- No typecheck/lint scripts yet → defer to Phase 3 (do not claim pass)
- UI regression status: must remain **unchanged**

---

## 8. Out of scope (Phase 1)

React Router · Auth · Backend · AI · MongoDB · Admin UI · Package purge · Mobile drawer (unless already present)
