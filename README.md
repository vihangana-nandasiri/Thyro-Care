# ThyroCare AI

**ThyroCare AI – Development of an AI-Powered Personalized Healthcare Assistant for Post-Thyroidectomy Thyroid Cancer Survivorship.**

Educational patient-support prototype for differentiated thyroid cancer survivors after thyroidectomy and radioactive iodine (RAI) treatment.

> **Medical safety:** This system provides informational support only. It does **not** diagnose disease, prescribe medication, change dosages, interpret laboratory results as a clinician, or make emergency treatment decisions. Always consult a qualified healthcare professional. In an emergency, contact local emergency services immediately.

---

## Current status

- **Phase 0:** Complete (baseline + backups + build verified)
- **Phase 1:** Complete (modular pages/components; UI preserved)
- **Phase 2:** Complete (React Router, protected layouts, lazy pages)
- **Phase 3:** Complete (TypeScript strictness, ESLint/Prettier, env, Axios foundation, forms, a11y)
- **Phase 4:** Complete (FastAPI backend foundation — health/infra only)
- **Phase 5:** Complete (PyMongo Async models, repositories, indexes — no public CRUD)
- **Phase 6:** Complete (secure auth: JWT access + HttpOnly refresh + CSRF + RBAC)
- **Phase 7:** Complete (patient self-profile GET/PATCH + Profile page integration)
- **Phase 8:** Complete (medication CRUD, dose logs, schedule, adherence + Medication page)
- **Phase 9:** Complete (appointment/follow-up management + Follow-Up page)
- **Phase 10:** Complete (symptom tracking + deterministic safety escalation)
- **Phase 11:** Complete (safe knowledge-grounded assistant foundation)
- **Phase 12:** Complete (knowledge governance + medical-expert review console)
- **Phase 13+:** Not started

Mock clinical UI data remains under `src/data/mock/` for diet, resources, analytics, etc. Auth, profile, medications, appointments, symptoms, chat, and knowledge governance use the real API.

**Chat / educational assistant** uses `/api/v1/chat` with approved-source grounding when content is APPROVED and a provider is configured. Default: assistant disabled (`AI_ASSISTANT_ENABLED=false`). Seed knowledge remains **PENDING_REVIEW** until a medical expert approves it — it is never auto-approved.

**Knowledge governance & medical review (Phase 12):** ADMIN authors and submits knowledge drafts at `/admin/knowledge*`; only **MEDICAL_EXPERT** (never ADMIN) can approve, request changes, reject, or restore content at `/medical-review*`. There is no auto-approve and no LLM approval. See [`docs/knowledge-governance-architecture.md`](docs/knowledge-governance-architecture.md) · [`docs/knowledge-content-lifecycle.md`](docs/knowledge-content-lifecycle.md) · [`docs/medical-review-workflow.md`](docs/medical-review-workflow.md) · [`docs/knowledge-versioning-and-hashing.md`](docs/knowledge-versioning-and-hashing.md) · [`docs/knowledge-publication-and-ingestion.md`](docs/knowledge-publication-and-ingestion.md) · [`docs/knowledge-governance-rbac.md`](docs/knowledge-governance-rbac.md) · [`docs/phase-12-knowledge-governance.md`](docs/phase-12-knowledge-governance.md) · [`docs/phase-12-validation.md`](docs/phase-12-validation.md)

See [`docs/safe-assistant-architecture.md`](docs/safe-assistant-architecture.md) · [`docs/phase-11-validation.md`](docs/phase-11-validation.md) · [`PROJECT_PROGRESS.md`](PROJECT_PROGRESS.md)

### Cloudflare frontend deployment

- Live static SPA: https://thyrot1.chinthakajayaweera1.workers.dev (Worker `thyrot1`)
- Committed config: `wrangler.jsonc`; Wrangler pinned as `devDependency`
- Build: `npm run ci:build` · Deploy: `npm run cf:deploy` (no second Vite build)
- **Does not deploy FastAPI** — see [`docs/cloudflare-frontend-deployment.md`](docs/cloudflare-frontend-deployment.md) and [`docs/backend-production-deployment-checklist.md`](docs/backend-production-deployment-checklist.md)
- Phase 12 added frontend-only admin/medical-review pages; the deployed Worker build is otherwise unchanged for this phase. Redeploying it to pick up those new pages is a separate action (not required to complete Phase 12) — the FastAPI backend remains not publicly deployed.

Accessibility improvements move toward WCAG 2.1 AA practices; formal certification has not been performed. See [`docs/accessibility-improvements.md`](docs/accessibility-improvements.md).

---

## Tech stack

| Layer    | Technology                              |
| -------- | --------------------------------------- |
| UI       | React 18.3                              |
| Language | TypeScript (strict)                     |
| Bundler  | Vite 6                                  |
| Routing  | react-router 7                          |
| Forms    | react-hook-form + Zod                   |
| HTTP     | Axios (Bearer + single-flight refresh)  |
| Toasts   | sonner                                  |
| Styling  | Tailwind CSS 4                          |
| Charts   | Recharts                                |
| Icons    | lucide-react                            |
| Backend  | FastAPI + Uvicorn                       |
| Auth     | pwdlib Argon2 + PyJWT + refresh cookies |
| Database | MongoDB via PyMongo AsyncMongoClient    |

---

## Local setup

### Frontend

```bash
npm install
cp .env.example .env   # optional local overrides
npm run dev
```

Open `http://localhost:5173/`.

### Backend (Phases 4–6)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
# Set JWT_SECRET_KEY to a long random value (see backend/.env.example)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `http://localhost:8000/health`
- Detailed health: `http://localhost:8000/api/v1/health`
- Auth: `/api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/me`
- OpenAPI: `http://localhost:8000/docs`

See [`backend/README.md`](backend/README.md).

**Local auth notes:** Frontend at `http://localhost:5173` must match `ALLOWED_ORIGINS`. Access tokens stay in memory; refresh uses an HttpOnly cookie. Production requires `COOKIE_SECURE=true` and a strong `JWT_SECRET_KEY` (never commit secrets).

**Still deferred:** password-reset email, email verification, MFA, production LLM enablement, Atlas Vector Search ops, medication/appointment SMS reminders. FastAPI backend is not publicly deployed.

### Developer scripts (frontend)

```bash
npm run dev            # Vite dev server
npm run build          # Production build
npm run preview        # Preview production build
npm run typecheck      # TypeScript project build check
npm run lint           # ESLint
npm run format         # Prettier write
npm run format:check   # Prettier check
npm run ci:build       # typecheck + lint + format:check + vite build
npm run cf:dry-run     # Wrangler deploy dry-run (uses dist; no Vite)
npm run cf:deploy      # Wrangler deploy --autoconfig=false
```

Environment variables (browser-safe `VITE_*` only) are documented in `.env.example` and read via `src/config/env.ts`.

---

## Frontend routes

### Public

| URL          | Screen    |
| ------------ | --------- |
| `/`          | Landing   |
| `/login`     | Login     |
| `/register`  | Register  |
| `/emergency` | Emergency |

### Patient (authenticated)

| URL            | Screen               |
| -------------- | -------------------- |
| `/dashboard`   | Dashboard            |
| `/chat`        | AI Chat              |
| `/medications` | Medication           |
| `/diet`        | Diet                 |
| `/symptoms`    | Symptoms             |
| `/follow-ups`  | Follow-up            |
| `/analytics`   | Progress / Analytics |
| `/resources`   | Resources            |
| `/profile`     | Profile              |

### Admin (role `admin`, Phase 12)

| URL                                                | Screen                    |
| -------------------------------------------------- | ------------------------- |
| `/admin/knowledge`                                 | Knowledge management list |
| `/admin/knowledge/new`                             | New knowledge draft       |
| `/admin/knowledge/:documentId`                     | Draft editor              |
| `/admin/knowledge/:documentId/versions/:versionId` | Version detail            |

### Medical expert (role `medical_expert`, Phase 12)

| URL                                      | Screen                                             |
| ---------------------------------------- | -------------------------------------------------- |
| `/medical-review`                        | Review queue                                       |
| `/medical-review/:documentId/:versionId` | Review detail (approve / request changes / reject) |

Only `medical_expert` can approve, request changes, reject, or restore; `admin` can author/submit drafts but cannot review. See [`docs/knowledge-governance-rbac.md`](docs/knowledge-governance-rbac.md).

### System

| URL             | Screen       |
| --------------- | ------------ |
| `/unauthorized` | Unauthorized |
| unknown paths   | Not Found    |

Sign in / register call the FastAPI auth API. Access tokens are memory-only; refresh uses an HttpOnly cookie.

---

## Project structure

```
backend/                   # FastAPI + Mongo + auth (Phases 4–6)
src/
  app/App.tsx              # Providers + RouterProvider shell
  app/providers.tsx        # ErrorBoundary, Auth, Toast
  app/router.tsx           # createBrowserRouter route table
  config/env.ts            # Typed Vite env
  services/api.ts          # Axios + Bearer + refresh interceptors
  services/authService.ts  # Register/login/refresh/logout/me
  services/tokenStore.ts   # In-memory access token
  schemas/                 # Zod validation schemas
  hooks/                   # useDocumentTitle, useToast
  pages/                   # Lazy-loaded route pages
  layouts/                 # Public, Auth, Dashboard (+ mobile drawer)
  context/AuthContext.tsx  # Real auth provider (refresh bootstrap)
  components/common/       # Guards, states, ErrorBoundary, UI atoms
  data/mock/               # Explicit demo datasets (*.mock.ts)
```

---

## Roadmap (high level)

1. Modular frontend + routing ← done (Phases 1–2)
2. Quality / accessibility foundation ← done (Phase 3)
3. FastAPI backend foundation ← done (Phase 4)
4. MongoDB models & repositories ← done (Phase 5)
5. Secure authentication & RBAC ← done (Phase 6)
6. Patient self-profile management ← **done (Phase 7)**
7. Medication management & adherence ← **done (Phase 8)**
8. Appointment / follow-up management ← **done (Phase 9)**
9. Symptom tracking + safety escalation ← **done (Phase 10)**
10. Safe knowledge-grounded assistant ← **done (Phase 11)**
11. Admin / medical expert knowledge governance workflows ← **done (Phase 12)**
12. Tests, security, Docker Compose, deployment docs (Phase 13+, not started)

See `PROJECT_PROGRESS.md` for phase tracking.

---

## License / attributions

See `ATTRIBUTIONS.md` (shadcn/ui MIT; Unsplash imagery).
