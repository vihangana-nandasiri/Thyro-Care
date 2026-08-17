# Authentication security model (Phase 13A additions)

## Preserved session architecture

- Access tokens: in-memory on the client only
- Refresh tokens: HttpOnly cookies (`Secure` + `SameSite=None` in production)
- CSRF cookie + `X-CSRF-Token` on refresh/logout
- Public registration creates **PATIENT** only
- ADMIN / MEDICAL_EXPERT via privileged provisioning only

## Action tokens

- Stored only as HMAC-SHA256 hashes in `auth_action_tokens`
- Never logged or returned from normal production responses
- Single-use + TTL; superseded by newer tokens for the same purpose

## Enumeration protection

Forgot-password and unauthenticated resend responses are identical regardless
of whether the email exists or the account is ineligible.

## Google linking policy

Never silently link Google to an existing account by email alone. Conflict
message directs the user to password sign-in first.

## Audit events (privacy-safe)

- `PASSWORD_RESET_REQUESTED` / `PASSWORD_RESET_COMPLETED`
- `PASSWORD_CHANGED`
- `EMAIL_VERIFICATION_SENT` / `EMAIL_VERIFIED`
- `GOOGLE_LOGIN_SUCCEEDED` / `GOOGLE_LOGIN_FAILED` / `GOOGLE_ACCOUNT_CONFLICT`

Audit payloads must not include raw emails, passwords, tokens, cookies, or
Google credentials. Email references use fingerprints where needed.

## Rate limits

Dedicated limits exist for forgot/reset/verify/resend/change-password/google
(see backend `.env.example`). Do not weaken CSRF, CORS, cookie, or rate-limit
protections when enabling Phase 13A features.
