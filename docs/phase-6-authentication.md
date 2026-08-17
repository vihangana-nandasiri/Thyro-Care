# Phase 6 — Secure Authentication and Role-Based Authorization

## Summary

Phase 6 delivers end-to-end patient authentication: Argon2 password hashing, JWT access tokens, opaque HttpOnly refresh cookies with rotation and reuse detection, CSRF protection, logout, `/auth/me`, account lockout, RBAC dependencies, audit events, and frontend real-auth integration (mock auth removed).

## Delivered

- `POST /api/v1/auth/register|login|refresh|logout`
- `GET /api/v1/auth/me`
- Password service (`pwdlib` Argon2)
- JWT access tokens (PyJWT, HS256)
- Refresh-token repository + family rotation/reuse detection
- CSRF double-submit for cookie operations
- Auth audit events
- Frontend memory token store, Axios single-flight refresh, AuthContext bootstrap
- Login/Register wired to backend; protected routes wait for bootstrap

## Explicitly not delivered

- Password-reset email, email verification, MFA, social login
- Patient profile / medication / appointment / symptom CRUD
- Chatbot, RAG, AI
- Admin management UI or seed/default admin users

## Key docs

- `docs/authentication-architecture.md`
- `docs/token-lifecycle.md`
- `docs/authentication-threat-model.md`
- `docs/phase-6-authentication-plan.md`
- `docs/phase-6-validation.md`
