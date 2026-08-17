# Authentication and account recovery (Phase 13A)

This document describes ThyroCare AI password recovery, email verification,
authenticated password change, and Google Sign-In. Features default **disabled**
until environment variables are configured in Render / Cloudflare / Google Cloud.

## User flows

### Forgot / reset password

1. User submits email on `/forgot-password`.
2. API always returns the same generic message (no account enumeration).
3. When `PASSWORD_RESET_ENABLED=true` and the account is active with password
   auth enabled, a single-use hashed token is stored and (if delivery is on)
   an email is sent with a frontend fragment link:
   `{FRONTEND_PUBLIC_URL}/reset-password#token=...`
4. User opens `/reset-password`, the SPA reads and clears the fragment, then
   posts the token + new password to `POST /api/v1/auth/reset-password`.
5. On success: password updated, all refresh sessions revoked, no auto-login.
   A password-changed notification is sent when email delivery is enabled.

### Email verification

1. When `EMAIL_VERIFICATION_ENABLED=true`, registration may issue a verification
   email (`/verify-email#token=...`).
2. `POST /api/v1/auth/verify-email` marks `email_verified=true` and consumes the
   token. Role is never changed.
3. `POST /api/v1/auth/resend-verification` is rate-limited; authenticated users
   preferred. Unauthenticated email-based resend never reveals account existence.
4. Login gating for unverified users follows `REQUIRE_EMAIL_VERIFICATION`
   (unchanged default: `false`).

### Change password

Authenticated `POST /api/v1/auth/change-password` requires the current password,
rejects reuse, enforces password policy, revokes all refresh sessions, and
notifies by email when delivery is enabled. User must sign in again.

### Google Sign-In

1. Frontend loads Google Identity Services only when `VITE_GOOGLE_CLIENT_ID` is set.
2. Popup callback sends the ID token to `POST /api/v1/auth/google`.
3. Backend verifies the token with `google.oauth2.id_token.verify_oauth2_token`.
4. Linked identity → normal session. New identity → PATIENT only.
5. Existing local email without Google link → conflict (no silent linking).

## Endpoint contracts

| Method | Path                               | Auth            | Notes                                 |
| ------ | ---------------------------------- | --------------- | ------------------------------------- |
| POST   | `/api/v1/auth/forgot-password`     | No              | Generic response always               |
| POST   | `/api/v1/auth/reset-password`      | No              | Token + new password                  |
| POST   | `/api/v1/auth/verify-email`        | No              | Token                                 |
| POST   | `/api/v1/auth/resend-verification` | Optional bearer | Generic when unauthenticated          |
| POST   | `/api/v1/auth/change-password`     | Bearer          | Revokes sessions                      |
| POST   | `/api/v1/auth/google`              | No              | `{ "credential": "<id_token>" }` only |

Existing register/login/refresh/logout/me behavior is preserved.

## Token lifecycle

- Collection: `auth_action_tokens`
- Purposes: `EMAIL_VERIFICATION`, `PASSWORD_RESET`
- Raw token: ≥32 bytes entropy, exists only to build the email link
- Persistence: HMAC-SHA256 hash only (`token_hash`)
- Single-use via atomic consume; new tokens invalidate prior active tokens
  for the same user+purpose
- Expired / invalid / consumed → one generic client error

## Session revocation

Password reset and change-password revoke **all** refresh token families for
the user. Google and email/password login continue to issue HttpOnly refresh
cookies + CSRF cookies with in-memory access tokens.

## Generic-response policy

Forgot-password and unauthenticated resend never reveal whether an email
exists, or account status (suspended/deleted/ineligible). Invalid reset or
verify tokens share one generic message.

## Rollback / disable

Set on Render:

- `PASSWORD_RESET_ENABLED=false`
- `EMAIL_VERIFICATION_ENABLED=false`
- `EMAIL_DELIVERY_ENABLED=false`
- `GOOGLE_AUTH_ENABLED=false`

Unset `VITE_GOOGLE_CLIENT_ID` on Cloudflare and rebuild to hide the Google button.

See also: `email-delivery-setup.md`, `google-sign-in-setup.md`,
`authentication-security-model.md`, `phase-13a-validation.md`.
