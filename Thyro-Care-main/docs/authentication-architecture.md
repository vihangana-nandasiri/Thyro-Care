# Authentication Architecture

ThyroCare AI Phase 6 authentication for the patient-support platform.

> Medical disclaimer: informational support only — not a substitute for professional care.

## Registration flow

1. Client submits JSON to `POST /api/v1/auth/register` (full name, email, password, confirm password, consent, disclaimer).
2. Backend validates policy, normalizes email, hashes password with Argon2 (`pwdlib`).
3. Creates a `PATIENT` user only (role is never taken from client input).
4. Creates a minimal patient profile with consent/disclaimer timestamps.
5. Issues a short-lived JWT access token (JSON) and opaque refresh token (HttpOnly cookie).
6. Sets a readable CSRF cookie for later cookie-authenticated calls.
7. Writes a `USER_REGISTERED` audit event.

## Login flow

1. Client submits email/password to `POST /api/v1/auth/login`.
2. Backend normalizes email and loads the user.
3. Unknown, deleted, or wrong-password cases return the same generic error.
4. Suspended/inactive accounts receive a safe account-unavailable response.
5. Failed attempts increment; temporary lock applies after the configured threshold.
6. On success: reset failure counters, optional password rehash, update `last_login_at`.
7. Issue new access token + new refresh-token family + CSRF cookie.
8. Audit `LOGIN_SUCCEEDED` / `LOGIN_FAILED` / lock events as applicable.

## Access-token flow

- JWT (HS256 by default), returned in JSON, stored only in frontend memory.
- Sent as `Authorization: Bearer`.
- Claims: `sub`, `type=access`, `role`, `jti`, `iss`, `aud`, `iat`, `nbf`, `exp`.
- Never stored in `localStorage`, `sessionStorage`, or a readable cookie.

## Refresh-token flow

- Cryptographically random opaque value (not a JWT).
- HttpOnly cookie (`thyrocare_refresh` by default), path restricted to `/api/v1/auth`.
- Only SHA-256 hash persisted in MongoDB.
- Rotated on every successful refresh; reuse of a revoked token revokes the family.

## Cookie strategy

| Cookie  | HttpOnly | Purpose                          |
| ------- | -------- | -------------------------------- |
| Refresh | yes      | Session continuity               |
| CSRF    | no       | Double-submit for refresh/logout |

Secure / SameSite / Domain come from settings. Development may use `Secure=false` and `SameSite=lax`. Production requires `Secure=true` and exact CORS origins with credentials.

## CSRF strategy

Double-submit cookie: readable CSRF cookie value must match `X-CSRF-Token` (constant-time compare) for refresh and logout.

## Role authorization

Roles: `patient`, `admin`, `medical_expert`. Public registration always creates `patient`. Protected dependencies load the user from the database and compare persisted role to JWT role for sensitive checks.

## Account-status checks

Active users may authenticate. Suspended/inactive are blocked. Soft-deleted users cannot authenticate. Locked users wait until `locked_until` expires. Email verification is gated by `REQUIRE_EMAIL_VERIFICATION` (default false).

## Frontend memory-token design

`tokenStore.ts` holds the access token in process memory. Page reload bootstraps via refresh cookie.

## Axios refresh design

On eligible 401 responses, a single-flight refresh runs once; queued requests retry. Login/register/refresh/logout never trigger refresh. Refresh failure clears memory token and marks the session unauthenticated.
