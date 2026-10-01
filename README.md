# ThyroCare AI

ThyroCare AI is a multilingual survivorship-support platform for people receiving post-thyroidectomy care. It combines personal medication, symptom, and report tracking with doctor oversight and an admin-managed medical knowledge workflow.# ThyroCare AI

ThyroCare AI is a multilingual survivorship-support platform for people receiving post-thyroidectomy care. It combines personal medication, symptom, and report tracking with doctor oversight and an admin-managed medical knowledge workflow.

## Main features

- Patient dashboard for medications, dose tracking, symptoms, reports, and profile management
- Doctor dashboard for assigned patients, medication plans, symptom history, reports, knowledge review, and patient alerts
- Admin dashboard for accounts, doctor assignments, audit events, patient alerts, and governed knowledge drafts
- Medication dose tracking restricted to today or earlier (never a future day), with an optional Web Audio reminder beep for unlogged due doses
- Emergency page with a direct `tel:1990` call button and an explicit "I'm having an emergency" toggle that shares optional location with the care team — opening the page alone never creates an alert
- Dedicated alerts section for doctors/admins covering emergency- and urgent-severity events (chat, symptom checks, and the emergency toggle), each with a status control (new/acknowledged/resolved) and a map link when location was shared. The dashboard banner shows only `new` alerts; acknowledging or resolving one removes it from the banner, while the alerts page keeps the full history
- Draft → review → approve/reject/request changes → retire/restore knowledge workflow, including editing and resubmitting a version after changes are requested
- Optional DeepSeek educational chat grounded in approved knowledge content and the patient's own medication/symptom record
- Hybrid RAG retrieval: PostgreSQL full-text search always on, plus multilingual Gemini embeddings (vector search via pgvector, fused with full-text via Reciprocal Rank Fusion) when configured. Retrieval searches all languages, so Sinhala and Tamil questions can use English articles
- JWT sessions, role-based access control, password hashing, and required authenticator enrollment for new accounts
- English, Sinhala (`si`), and Tamil (`ta`) interfaces across patient, doctor, and admin dashboards
- Compact, mobile-friendly dashboards with light-blue accents, searchable symptom tiles, and no progress dashboard
- Full-page patient chat with conversation history, language-aware replies, and medical-only scope checks
- Doctor-and-admin-reviewed news, articles, and videos discovered with Serper; patients see only resources approved by both roles

Language selection is stored in a `lang` cookie and shared by server and client components. Patient language preference, chat sessions, and knowledge documents also support all three languages.

## Tech stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Bun for package management, scripts, and tests
- PostgreSQL with Drizzle ORM and Drizzle Kit; pgvector for optional embedding storage/search
- S3-compatible object storage for medical reports
- Zod request validation

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or later
- PostgreSQL database with pgvector (the project is configured for Neon-compatible pooled and direct URLs). Choose a region close to where the app runs: from Sri Lanka, a `us-east-2` database takes about 3.7 s to open a connection and 0.6 s per query, while `aws-ap-southeast-1` (Singapore) is much faster. The app keeps its connections open so that cost is paid once per server start, not on every page.
- S3-compatible storage credentials if report uploads are required

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template and provide the required values:

   ```bash
   cp .env.example .env
   ```

   Required for the core app:

   - `DATABASE_URL` — direct PostgreSQL URL used by migrations
   - `DATABASE_URL_POOLED` — pooled PostgreSQL URL used by the app
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` — strong, independent secrets
   - `APP_URL` — normally `http://localhost:3000` locally

   Optional integrations:

   - `DEEPSEEK_API_KEY` — educational answers. Deterministic safety redirects still work without it.
   - `SERPER_API_KEY` — admin resource discovery.
   - `GOOGLE_AI_API_KEY` — Gemini embeddings for hybrid (full-text + vector) RAG retrieval. English questions work with full-text search alone; Sinhala and Tamil questions effectively need it, because full-text search is English-only.

   Missing integrations show an unavailable/unknown state, not fabricated results. S3 variables are required for medical-report uploads.

3. Apply database migrations:

   ```bash
   bunx drizzle-kit migrate
   ```

   Migration `0001_acoustic_malice.sql` adds Tamil (`ta`) to the shared PostgreSQL language enum.
   Migration `0002_fuzzy_jocasta.sql` adds the moderated resource library and structured chat cards (the cards were later removed).
   Migration `0003_opposite_titania.sql` adds doctor approval, resource revision numbers, and required MFA for new users. Existing users retain their current MFA requirement. Previously published resources return to pending until reviewed by a doctor.
   Migration `0004_drop_appointments.sql` removes the unused appointments feature and its table.
   Migration `0005_embedding_768_dims.sql` resizes the knowledge embedding column to Gemini's 768 dimensions (it was previously unused, so this is a no-data-loss change). If the column is still `vector(1536)`, every embedding write fails and RAG falls back to keyword search only; apply this migration, then run `bun run backfill:embeddings`.
   Migration `0006_drop_diet.sql` drops the removed diet feature's columns (`patient_profiles.diet_instructions`, `chat_messages.ui_spec`). This deletes any saved diet instructions.

4. Seed the first admin account:

   ```bash
   SEED_ADMIN_EMAIL=admin@example.com \
   SEED_ADMIN_PASSWORD='replace-with-a-strong-password' \
   bun run seed:admin
   ```

   For local role testing, create two development accounts for each role with:

   ```bash
   SEED_DEMO_PASSWORD='choose-a-development-password' bun run seed:demo
   ```

   The demo seed is idempotent and resets those demo accounts to the supplied password with MFA disabled.

5. Start the development server:

   ```bash
   bun run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Create a production build |
| `bun run start` | Run the production server |
| `bun run lint` | Run ESLint |
| `bun run test` | Run the Bun test suite |
| `bun run seed:admin` | Create the initial admin account |
| `bun run seed:demo` | Create development accounts for every role |
| `bun run cleanup:e2e` | Remove test data created by end-to-end runs |
| `bun run backfill:embeddings` | Embed approved knowledge versions that have no embedding yet (added before `GOOGLE_AI_API_KEY`, or the approval-time call failed) |

Some tests exercise the configured PostgreSQL database, so the test suite needs a reachable migrated database.

## Demo accounts

`bun run seed:demo` creates 6 development-only accounts, 2 per role. It is idempotent: rerunning it resets these same accounts to the password supplied in `SEED_DEMO_PASSWORD` rather than creating duplicates. The current local demo password is `ThyroCareDemo123!`. Never use this password or these accounts in production.

| Role | Account 1 | Account 2 |
| --- | --- | --- |
| Admin | `admin.demo1@thyrocare.local` | `admin.demo2@thyrocare.local` |
| Doctor | `doctor.demo1@thyrocare.local` — Dr. Anjali Perera, Endocrinology | `doctor.demo2@thyrocare.local` — Dr. Kavin Raj, Oncology |
| Patient | `patient.demo1@thyrocare.local` — Meena Sivarajah, Tamil interface | `patient.demo2@thyrocare.local` — Nimali Jayasinghe, Sinhala interface |

`patient.demo1` is assigned to `doctor.demo1`, and `patient.demo2` to `doctor.demo2`, so each demo doctor sees exactly one demo patient. Demo accounts deliberately skip mandatory MFA enrollment so role testing remains accessible. Use separate browser profiles or isolated contexts: normal tabs share authentication cookies.

These accounts, and every external credential in `.env` (database, S3-compatible storage, DeepSeek, Gemini, Serper), were verified working end to end on 28 September 2026: migrations applied cleanly to a fresh database, all 6 accounts signed in and reached their dashboards, and the full `bun run test` suite passed (55/55) against it.

## Account security and emergency contact details

Registration requires the patient's phone number and optionally collects another emergency contact's name and number. New patients, doctor accounts, and seeded non-demo admins must enroll in MFA before their first full session. Scan the locally generated QR code using Google Authenticator or another TOTP authenticator, then verify a code. QR generation does not send the secret to Google or any external QR service. Setup tokens expire after five minutes and cannot be used as session tokens; sign in again if setup expires.

Existing accounts keep their current enrollment policy after migration; existing enabled MFA remains enforced. There is no automated account-recovery flow for a lost authenticator yet, so establish a verified support/recovery procedure before production deployment.

Emergency navigation and `/emergency` are patient-only. The page provides guidance and a direct `tel:1990` call link, not a dispatch service. An explicit "I'm having an emergency" toggle — not simply opening the page — requests optional browser geolocation and records an alert event that assigned doctors and admins can see, with a status control and a map link when location was shared. There is still no ambulance dispatch, driver notification, SMS delivery, or guaranteed-response mechanism: a saved alert confirms storage, not that someone has read or acted on it. Do not rely on this app to summon emergency services.

## Chat and resource library

Patient chat is at `/patient/chat`. Switching the interface language starts a fresh conversation in that language; saved conversations retain their original messages. Answers are brief, ask only necessary follow-up questions, and refuse programming/unrelated requests. Medical answers use approved knowledge — retrieved via full-text search, plus a Gemini vector-similarity pass when `GOOGLE_AI_API_KEY` is set — and the patient's own medication (including the next unlogged dose) and symptom records. Retrieval is not filtered by language; the model answers in the selected language. Embeddings are created when an article is approved; failures are logged to the server console and can be retried with `bun run backfill:embeddings`.

There is no diet or food-check feature. Nutrition questions are answered only from approved knowledge articles.

Admins use `/admin/resources` to discover and save candidates. Doctors use `/doctor/resources` to review, edit, approve, or reject them. Publication requires both a doctor approval and an admin approval, in either order. Both roles can edit saved resources; edits clear both approvals and immediately hide the resource from patients. Admins can delete resources after confirmation. Revision checks reject stale edits or approvals. Reviewer views include pending/rejected content; the patient library and reader API only return fully approved entries in the selected language. Search results still require human verification of accuracy, relevance, and actual language.

Doctors may also edit the body of admin-submitted knowledge while it is pending review. Saving does not approve it. A changed content hash invalidates stale approval attempts; approved knowledge remains immutable and needs a new version for further edits. When a doctor requests changes, the author can edit that same version and resubmit it directly back to review — a rejected version, by contrast, is a dead end and needs a fresh version.

## Localization

Translations live in `src/lib/i18n/dictionaries/`:

- `en.json` — English
- `si.json` — Sinhala
- `ta.json` — Tamil

Shared dashboard, chat, and library copy also lives in `src/lib/i18n/experience.ts`. Public authentication, symptom tiles, and review controls use `src/lib/i18n/interface.ts`. Both include English, Sinhala, and Tamil records. Public form language switches immediately and persists across reloads.

The dictionaries intentionally share the same key set. `src/lib/i18n/config.test.ts` verifies this and confirms that Tamil is selectable. When adding another language:

1. Add a complete dictionary.
2. Register the language in `src/lib/i18n/config.ts`.
3. Extend the PostgreSQL `language` enum with a migration.
4. Update request validation for profile, chat, and knowledge APIs.

## Safety and data boundaries

- Patients cannot create or change medication plans; assigned doctors manage them.
- Symptom escalation is deterministic and rule-based, not generated by AI. Free-text notes never influence the classification — only the structured yes/no answers do.
- The assistant is limited to approved, active knowledge content plus the patient's own record, and is not allowed to diagnose or prescribe; it can state a dose already on record as fact but not recommend or change one.
- Prompt checks and output checks provide defense in depth, not a guarantee of clinical correctness.
- Search discovery is admin-only; the reader API returns approved resources only.
- Protected routes are role-gated, and patient access is derived from the authenticated session.
- Medical report objects are stored in a private bucket, never a public ACL, and are only ever accessed through short-lived signed URLs generated for the uploading patient or their assigned doctor(s).


Documentation lives in `docs/` as standalone HTML files that embed their diagrams and styles, so each opens in a browser and can be shared on its own:

- [Application guide](docs/app_guide/ThyroCare-App-Guide.html): every role, user journey, business rule, and the AI/RAG pipeline.
- [Thesis](docs/thesis/ThyroCare-Thesis.html): the seven-chapter research write-up.

The HTML files are the sources; edit them directly. Diagram sources are in `docs/app_guide/diagrams/` and `docs/thesis/diagrams/` as D2 files (render with `d2 --theme 0 --pad 24 file.d2 file.svg`).

> ThyroCare AI supports education and personal tracking. It does not diagnose conditions, interpret test results, or recommend treatment.

## Main features

- Patient dashboard for medications, dose tracking, symptoms, reports, and profile management
- Doctor dashboard for assigned patients, medication plans, symptom history, reports, knowledge review, and patient alerts
- Admin dashboard for accounts, doctor assignments, audit events, patient alerts, and governed knowledge drafts
- Medication dose tracking restricted to today or earlier (never a future day), with an optional Web Audio reminder beep for unlogged due doses
- Emergency page with a direct `tel:1990` call button and an explicit "I'm having an emergency" toggle that shares optional location with the care team — opening the page alone never creates an alert
- Dedicated alerts section for doctors/admins covering emergency- and urgent-severity events (chat, symptom checks, and the emergency toggle), each with a status control (new/acknowledged/resolved) and a map link when location was shared. The dashboard banner shows only `new` alerts; acknowledging or resolving one removes it from the banner, while the alerts page keeps the full history
- Draft → review → approve/reject/request changes → retire/restore knowledge workflow, including editing and resubmitting a version after changes are requested
- Optional DeepSeek educational chat grounded in approved knowledge content and the patient's own medication/symptom record
- Hybrid RAG retrieval: PostgreSQL full-text search always on, plus multilingual Gemini embeddings (vector search via pgvector, fused with full-text via Reciprocal Rank Fusion) when configured. Retrieval searches all languages, so Sinhala and Tamil questions can use English articles
- JWT sessions, role-based access control, password hashing, and required authenticator enrollment for new accounts
- English, Sinhala (`si`), and Tamil (`ta`) interfaces across patient, doctor, and admin dashboards
- Compact, mobile-friendly dashboards with light-blue accents, searchable symptom tiles, and no progress dashboard
- Full-page patient chat with conversation history, language-aware replies, and medical-only scope checks
- Doctor-and-admin-reviewed news, articles, and videos discovered with Serper; patients see only resources approved by both roles

Language selection is stored in a `lang` cookie and shared by server and client components. Patient language preference, chat sessions, and knowledge documents also support all three languages.

## Tech stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Bun for package management, scripts, and tests
- PostgreSQL with Drizzle ORM and Drizzle Kit; pgvector for optional embedding storage/search
- S3-compatible object storage for medical reports
- Zod request validation

## Prerequisites

- [Bun](https://bun.sh/) 1.3 or later
- PostgreSQL database with pgvector (the project is configured for Neon-compatible pooled and direct URLs). Choose a region close to where the app runs: from Sri Lanka, a `us-east-2` database takes about 3.7 s to open a connection and 0.6 s per query, while `aws-ap-southeast-1` (Singapore) is much faster. The app keeps its connections open so that cost is paid once per server start, not on every page.
- S3-compatible storage credentials if report uploads are required

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy the environment template and provide the required values:

   ```bash
   cp .env.example .env
   ```

   Required for the core app:

   - `DATABASE_URL` — direct PostgreSQL URL used by migrations
   - `DATABASE_URL_POOLED` — pooled PostgreSQL URL used by the app
   - `JWT_SECRET` and `JWT_REFRESH_SECRET` — strong, independent secrets
   - `APP_URL` — normally `http://localhost:3000` locally

   Optional integrations:

   - `DEEPSEEK_API_KEY` — educational answers. Deterministic safety redirects still work without it.
   - `SERPER_API_KEY` — admin resource discovery.
   - `GOOGLE_AI_API_KEY` — Gemini embeddings for hybrid (full-text + vector) RAG retrieval. English questions work with full-text search alone; Sinhala and Tamil questions effectively need it, because full-text search is English-only.

   Missing integrations show an unavailable/unknown state, not fabricated results. S3 variables are required for medical-report uploads.

3. Apply database migrations:

   ```bash
   bunx drizzle-kit migrate
   ```

   Migration `0001_acoustic_malice.sql` adds Tamil (`ta`) to the shared PostgreSQL language enum.
   Migration `0002_fuzzy_jocasta.sql` adds the moderated resource library and structured chat cards (the cards were later removed).
   Migration `0003_opposite_titania.sql` adds doctor approval, resource revision numbers, and required MFA for new users. Existing users retain their current MFA requirement. Previously published resources return to pending until reviewed by a doctor.
   Migration `0004_drop_appointments.sql` removes the unused appointments feature and its table.
   Migration `0005_embedding_768_dims.sql` resizes the knowledge embedding column to Gemini's 768 dimensions (it was previously unused, so this is a no-data-loss change). If the column is still `vector(1536)`, every embedding write fails and RAG falls back to keyword search only; apply this migration, then run `bun run backfill:embeddings`.
   Migration `0006_drop_diet.sql` drops the removed diet feature's columns (`patient_profiles.diet_instructions`, `chat_messages.ui_spec`). This deletes any saved diet instructions.

4. Seed the first admin account:

   ```bash
   SEED_ADMIN_EMAIL=admin@example.com \
   SEED_ADMIN_PASSWORD='replace-with-a-strong-password' \
   bun run seed:admin
   ```

   For local role testing, create two development accounts for each role with:

   ```bash
   SEED_DEMO_PASSWORD='choose-a-development-password' bun run seed:demo
   ```

   The demo seed is idempotent and resets those demo accounts to the supplied password with MFA disabled.

5. Start the development server:

   ```bash
   bun run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the development server |
| `bun run build` | Create a production build |
| `bun run start` | Run the production server |
| `bun run lint` | Run ESLint |
| `bun run test` | Run the Bun test suite |
| `bun run seed:admin` | Create the initial admin account |
| `bun run seed:demo` | Create development accounts for every role |
| `bun run cleanup:e2e` | Remove test data created by end-to-end runs |
| `bun run backfill:embeddings` | Embed approved knowledge versions that have no embedding yet (added before `GOOGLE_AI_API_KEY`, or the approval-time call failed) |

Some tests exercise the configured PostgreSQL database, so the test suite needs a reachable migrated database.

## Demo accounts

`bun run seed:demo` creates 6 development-only accounts, 2 per role. It is idempotent: rerunning it resets these same accounts to the password supplied in `SEED_DEMO_PASSWORD` rather than creating duplicates. The current local demo password is `ThyroCareDemo123!`. Never use this password or these accounts in production.

| Role | Account 1 | Account 2 |
| --- | --- | --- |
| Admin | `admin.demo1@thyrocare.local` | `admin.demo2@thyrocare.local` |
| Doctor | `doctor.demo1@thyrocare.local` — Dr. Anjali Perera, Endocrinology | `doctor.demo2@thyrocare.local` — Dr. Kavin Raj, Oncology |
| Patient | `patient.demo1@thyrocare.local` — Meena Sivarajah, Tamil interface | `patient.demo2@thyrocare.local` — Nimali Jayasinghe, Sinhala interface |

`patient.demo1` is assigned to `doctor.demo1`, and `patient.demo2` to `doctor.demo2`, so each demo doctor sees exactly one demo patient. Demo accounts deliberately skip mandatory MFA enrollment so role testing remains accessible. Use separate browser profiles or isolated contexts: normal tabs share authentication cookies.

These accounts, and every external credential in `.env` (database, S3-compatible storage, DeepSeek, Gemini, Serper), were verified working end to end on 28 September 2026: migrations applied cleanly to a fresh database, all 6 accounts signed in and reached their dashboards, and the full `bun run test` suite passed (55/55) against it.

## Account security and emergency contact details

Registration requires the patient's phone number and optionally collects another emergency contact's name and number. New patients, doctor accounts, and seeded non-demo admins must enroll in MFA before their first full session. Scan the locally generated QR code using Google Authenticator or another TOTP authenticator, then verify a code. QR generation does not send the secret to Google or any external QR service. Setup tokens expire after five minutes and cannot be used as session tokens; sign in again if setup expires.

Existing accounts keep their current enrollment policy after migration; existing enabled MFA remains enforced. There is no automated account-recovery flow for a lost authenticator yet, so establish a verified support/recovery procedure before production deployment.

Emergency navigation and `/emergency` are patient-only. The page provides guidance and a direct `tel:1990` call link, not a dispatch service. An explicit "I'm having an emergency" toggle — not simply opening the page — requests optional browser geolocation and records an alert event that assigned doctors and admins can see, with a status control and a map link when location was shared. There is still no ambulance dispatch, driver notification, SMS delivery, or guaranteed-response mechanism: a saved alert confirms storage, not that someone has read or acted on it. Do not rely on this app to summon emergency services.

## Chat and resource library

Patient chat is at `/patient/chat`. Switching the interface language starts a fresh conversation in that language; saved conversations retain their original messages. Answers are brief, ask only necessary follow-up questions, and refuse programming/unrelated requests. Medical answers use approved knowledge — retrieved via full-text search, plus a Gemini vector-similarity pass when `GOOGLE_AI_API_KEY` is set — and the patient's own medication (including the next unlogged dose) and symptom records. Retrieval is not filtered by language; the model answers in the selected language. Embeddings are created when an article is approved; failures are logged to the server console and can be retried with `bun run backfill:embeddings`.

There is no diet or food-check feature. Nutrition questions are answered only from approved knowledge articles.

Admins use `/admin/resources` to discover and save candidates. Doctors use `/doctor/resources` to review, edit, approve, or reject them. Publication requires both a doctor approval and an admin approval, in either order. Both roles can edit saved resources; edits clear both approvals and immediately hide the resource from patients. Admins can delete resources after confirmation. Revision checks reject stale edits or approvals. Reviewer views include pending/rejected content; the patient library and reader API only return fully approved entries in the selected language. Search results still require human verification of accuracy, relevance, and actual language.

Doctors may also edit the body of admin-submitted knowledge while it is pending review. Saving does not approve it. A changed content hash invalidates stale approval attempts; approved knowledge remains immutable and needs a new version for further edits. When a doctor requests changes, the author can edit that same version and resubmit it directly back to review — a rejected version, by contrast, is a dead end and needs a fresh version.

## Localization

Translations live in `src/lib/i18n/dictionaries/`:

- `en.json` — English
- `si.json` — Sinhala
- `ta.json` — Tamil

Shared dashboard, chat, and library copy also lives in `src/lib/i18n/experience.ts`. Public authentication, symptom tiles, and review controls use `src/lib/i18n/interface.ts`. Both include English, Sinhala, and Tamil records. Public form language switches immediately and persists across reloads.

The dictionaries intentionally share the same key set. `src/lib/i18n/config.test.ts` verifies this and confirms that Tamil is selectable. When adding another language:

1. Add a complete dictionary.
2. Register the language in `src/lib/i18n/config.ts`.
3. Extend the PostgreSQL `language` enum with a migration.
4. Update request validation for profile, chat, and knowledge APIs.

## Safety and data boundaries

- Patients cannot create or change medication plans; assigned doctors manage them.
- Symptom escalation is deterministic and rule-based, not generated by AI. Free-text notes never influence the classification — only the structured yes/no answers do.
- The assistant is limited to approved, active knowledge content plus the patient's own record, and is not allowed to diagnose or prescribe; it can state a dose already on record as fact but not recommend or change one.
- Prompt checks and output checks provide defense in depth, not a guarantee of clinical correctness.
- Search discovery is admin-only; the reader API returns approved resources only.
- Protected routes are role-gated, and patient access is derived from the authenticated session.
- Medical report objects are stored in a private bucket, never a public ACL, and are only ever accessed through short-lived signed URLs generated for the uploading patient or their assigned doctor(s).
