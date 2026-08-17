# ThyroCare AI — Baseline Audit (Phase 0)

**Date:** 2026-07-11  
**Auditor role:** Project discovery & safety baseline  
**Workspace:** `C:\Users\chint\OneDrive\Desktop\nivesha akka tec\Thyro-Care-t1`  
**Original sibling source:** `C:\Users\chint\OneDrive\Desktop\nivesha akka`  
**Status:** Frontend builds and runs successfully. Phase 0 complete.

---

## 1. Discovery summary

| Location                    | Role                       | App.tsx size | Notes                                                  |
| --------------------------- | -------------------------- | ------------ | ------------------------------------------------------ |
| `Thyro-Care-t1` (workspace) | Active working copy        | ~1,378 lines | Migrated + early structural extraction already present |
| `nivesha akka` (sibling)    | Original Figma Make export | ~1,749 lines | Untouched; preserved as source archive                 |
| `backups/`                  | Safety copies              | —            | Timestamped copies of both trees                       |

### Backups created (Phase 0)

- `backups/ThyroCare-AI-original-sibling-20260711-125220` — full copy of original sibling (excluding `node_modules` / `.git` / `dist`)
- `backups/ThyroCare-t1-workspace-pre-phase0-20260711-125220` — workspace snapshot before Phase 0 commit
- `backups/BACKUP-MANIFEST-20260711-125220.txt`

**The original sibling folder was not modified or deleted.**

---

## 2. Current architecture

```
Thyro-Care-t1/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx              # All 13 screens still live here
│   │   └── components/
│   │       ├── figma/           # ImageWithFallback
│   │       └── ui/              # 48 shadcn/ui primitives (mostly unused by App)
│   ├── components/common/       # Card, Badge, Button(Btn), Input, Avatar
│   ├── layouts/                 # Sidebar, TopBar, DashboardLayout
│   ├── constants/               # colors, navigation, status
│   ├── data/mock/               # user, meds, chat, diet, analytics, etc.
│   ├── types/
│   ├── pages/ hooks/ context/ services/ utils/  # placeholders
│   └── styles/                  # Tailwind v4 + theme tokens
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── README.md
```

**Navigation model:** In-memory `useState<Screen>` switcher in `App.tsx` (no React Router wiring yet).  
**State:** Local React state only. No backend.  
**Data:** Explicit mock modules under `src/data/mock/` (not claimed as live clinical data).

---

## 3. Existing screens (13)

| Screen                | Function in App.tsx | Intended future route |
| --------------------- | ------------------- | --------------------- |
| Landing               | `LandingScreen`     | `/`                   |
| Login                 | `LoginScreen`       | `/login`              |
| Register              | `RegisterScreen`    | `/register`           |
| Patient Dashboard     | `DashboardScreen`   | `/dashboard`          |
| AI Chat               | `ChatScreen`        | `/chat`               |
| Medication Management | `MedicationScreen`  | `/medications`        |
| Low-Iodine Diet Guide | `DietScreen`        | `/diet`               |
| Symptom Checker       | `SymptomsScreen`    | `/symptoms`           |
| Follow-up Tracker     | `FollowupScreen`    | `/follow-ups`         |
| Progress / Analytics  | `ProgressScreen`    | `/analytics`          |
| Educational Resources | `EducationScreen`   | `/resources`          |
| Profile               | `ProfileScreen`     | `/profile`            |
| Emergency Support     | `EmergencyScreen`   | `/emergency`          |

**Not yet present:** Admin dashboard, Admin knowledge, Admin feedback pages.

---

## 4. Current dependencies

### Runtime (selected)

- React 18.3.1 / React DOM 18.3.1
- Vite 6.3.5
- Tailwind CSS 4.1.12 (`@tailwindcss/vite`)
- lucide-react, recharts
- react-router 7.13.0 (**installed, not used**)
- react-hook-form (**installed, not used by App screens**)
- Large unused surface: MUI, Emotion, motion, react-dnd, react-slick, canvas-confetti, most Radix/shadcn packages

### Tooling gaps

- No `lint` / `typecheck` / `test` scripts
- TypeScript present via `tsconfig.json` but `typescript` package not installed as a direct dependency
- No ESLint / Prettier configuration yet
- Package name still `@figma/my-make-file` (Figma Make export)

### Styling

- Tailwind v4 via Vite plugin
- Design tokens in `src/styles/theme.css` (primary `#4F8EF7`, secondary `#63C7B2`, background `#F8FAFC`)
- Fonts: Plus Jakarta Sans + Inter (Google Fonts CSS import)

---

## 5. Build & run status (Phase 0 validation)

| Check           | Result                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `npm install`   | Dependencies present / OK                                              |
| `npm run build` | **SUCCESS** (~5.8s)                                                    |
| `npm run dev`   | **SUCCESS** — Vite ready on `http://localhost:5173/`                   |
| HTTP GET `/`    | **200** — `#root` mount present                                        |
| Bundle warning  | Main JS chunk **654.71 kB** (gzip 182.05 kB) — exceeds 500 kB advisory |

### Existing warnings

1. Vite chunk-size warning (>500 kB) — expected until route-based code splitting.
2. Dual UI systems: custom common components vs unused shadcn `ui/` kit.
3. Many unused npm packages inflate install size and future audit surface.
4. Dynamic Tailwind classes on `Avatar` (`w-${size}`) are fragile under JIT (known technical debt).

---

## 6. Existing technical debt

1. **Monolithic screens:** All page UIs remain inside `App.tsx` (~1.4k lines).
2. **No URL routing:** Refresh / deep links / browser history not supported.
3. **Fake auth UX:** Login/register navigate to dashboard without credentials.
4. **Fake chatbot:** Fixed `setTimeout` reply; not retrieval-based or safety-gated.
5. **Mock clinical content:** Demo patient “Sarah Johnson”, meds, labs, diet — must stay labeled as mock until backend + governed knowledge.
6. **Dark mode toggle** does not apply `.dark` theme class.
7. **Mobile sidebar** not drawer-based; desktop sidebar may crowd small viewports.
8. **Accessibility gaps:** icon-only controls, custom switches without ARIA, focus consistency.
9. **No backend / env secrets management** yet (correct for Phase 0).
10. **Medical safety:** Disclaimers exist in UI copy, but no deterministic emergency pipeline or approved-knowledge gate yet.

---

## 7. Current screenshots checklist

Capture these for documentation / viva (manual; not automated in Phase 0):

- [ ] Landing (hero + features)
- [ ] Login
- [ ] Register
- [ ] Dashboard (stats + feature cards + chart)
- [ ] AI Chat (messages + emergency banner)
- [ ] Medication list + adherence chart
- [ ] Diet (Eat / Avoid / Meals tabs)
- [ ] Symptom checker + assessment panel
- [ ] Follow-up timeline
- [ ] Progress / analytics
- [ ] Resources (articles / videos / FAQs)
- [ ] Profile (personal / medical / settings)
- [ ] Emergency support (call actions + warning signs)
- [ ] Mobile viewport samples (≤375px) for Landing, Dashboard, Chat, Emergency

---

## 8. Migration risk

| Risk                                         | Level                     | Mitigation                                                                                           |
| -------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Losing original Figma export                 | Medium                    | Sibling left intact + timestamped backup                                                             |
| Accidental UI redesign during refactor       | High if uncontrolled      | Phase rules: preserve classes/colors; extract only                                                   |
| Overwriting workspace with stale sibling     | Medium                    | Workspace is newer (partial modularization); treat workspace as active source of truth going forward |
| Committing secrets / `dist` / `node_modules` | Medium                    | Expanded `.gitignore` before baseline commit                                                         |
| Claiming mock AI as clinical AI              | High (research integrity) | Keep mocks separated; document limitations                                                           |
| Large uncontrolled multi-phase change        | High                      | Strict phase gates; validate + commit per phase                                                      |

---

## 9. Baseline decision

**Active source of truth for development:**  
`C:\Users\chint\OneDrive\Desktop\nivesha akka tec\Thyro-Care-t1`

**Original preserved at:**  
`C:\Users\chint\OneDrive\Desktop\nivesha akka`  
and  
`...\backups\ThyroCare-AI-original-sibling-20260711-125220`

**Phase 0 gate:** Frontend production build **PASSED**. Dev server **PASSED**. Safe to proceed to Phase 1 (full modular page split + routing prep) only after explicit continuation.

---

## 10. Safety reminder (project-wide)

ThyroCare AI provides **educational support only**. It must not diagnose, prescribe, change medication doses, interpret labs as a clinician, or make emergency treatment decisions. Emergency escalation and governed medical knowledge are required before any chatbot is presented as clinically assisted.
