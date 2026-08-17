# Phase 6 — Authentication Plan

**Date:** 2026-07-11  
**Baseline:** Phase 5 commit `a457e4b`  
**Scope:** Secure patient registration, login, JWT access tokens, opaque refresh cookies, CSRF, RBAC foundations. No profile CRUD, password reset, MFA, or AI.

---

## 1. Password-hashing strategy

- Library: **pwdlib[argon2]** with `PasswordHash.recommended()`
- Hash on register; verify on login; rehash when `needs_update`
- Policy: min 10 / max 128 chars; reject whitespace-only; allow internal spaces
- Never log plaintext or hashes

## 2. Access-token strategy

- **PyJWT**, HS256, short-lived (15 minutes default)
- Claims: `sub`, `type=access`, `role`, `jti`, `iss`, `aud`, `iat`, `nbf`, `exp`
- Returned in JSON only; frontend memory store only
- Fixed algorithm allowlist; validate iss/aud/exp/type/sub

## 3. Refresh-token strategy

- Opaque `secrets.token_urlsafe(32+)`; SHA-256 hash in MongoDB
- HttpOnly cookie; path `/api/v1/auth`; Secure/SameSite from settings
- New family on login; rotate on every refresh

## 4. Token-rotation & reuse detection

- On refresh: revoke old, insert new with `replaced_by_token_id`, same `family_id`
- Reuse of revoked token → revoke entire family
- Concurrent race treated as invalid/reuse

## 5. JWT claim strategy

- Minimal claims; no email/medical data
- Role checked against DB on sensitive authorization

## 6. Cookie strategy

- Refresh: HttpOnly, Secure (prod), SameSite=lax (dev) / configured prod
- CSRF: readable cookie; not HttpOnly
- Clear with matching path/domain/SameSite

## 7. CSRF strategy

- Double-submit: cookie + `X-CSRF-Token` header
- Required for refresh/logout; `hmac.compare_digest`
- Rotated on login/refresh; cleared on logout

## 8. Account-lockout strategy

- Increment `failed_login_count` on bad password for known user
- Lock after `LOGIN_MAX_FAILED_ATTEMPTS` for `LOGIN_LOCK_MINUTES`
- Generic “Invalid email or password” for unknown/wrong/deleted
- Explicit safe blocked response for suspended/inactive when identifiable after auth

## 9. Role-authorization strategy

- Roles: `patient`, `admin`, `medical_expert` (align FE to lowercase)
- Public register always creates `patient`
- Deps: `get_current_user`, `require_roles`, etc.

## 10. Registration transaction strategy

- Prefer Mongo transaction when available
- Else create user then profile; compensating soft-delete/cleanup on profile failure
- Unique email index is final concurrency guard

## 11. Audit strategy

- Events: register, login success/fail, lock, refresh, reuse, logout, family revoke, authz denied
- No passwords/tokens/raw emails; optional email hash for failed login
- Audit failure logged; does not leak secrets (non-blocking for read paths; best-effort on auth)

## 12. Frontend token storage

- Access token: in-memory `tokenStore` only
- Refresh: HttpOnly cookie (JS cannot read)
- CSRF: readable cookie → header on refresh/logout
- Bootstrap: refresh on app load

## 13. Axios refresh strategy

- Attach Bearer from memory
- Single-flight refresh on 401; queue retries; never refresh login/register/refresh/logout
- Clear state on refresh failure

## 14. Testing strategy

- Unit tests for passwords, JWT, refresh rotation/reuse, CSRF, cookies, auth routes with fakes/overrides
- Preserve health/repo tests
- No Atlas required for default suite

## 15. Deferred security features

- Email verification, password reset, MFA, Redis rate limits, social login, admin user management UI

## 16. Validation strategy

- Ruff + pytest + frontend typecheck/lint/format/build
- Manual browser flow: register → reload → refresh → logout; verify storage
- Mark Phase 6 complete only when all pass; stop before Phase 7
