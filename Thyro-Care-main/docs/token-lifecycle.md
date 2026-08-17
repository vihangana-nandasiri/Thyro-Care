# Token Lifecycle

## Access token

1. **Creation:** Signed JWT after register, login, or refresh.
2. **Expiry:** Default 15 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES`).
3. **Use:** Bearer header for protected routes such as `GET /auth/me`.
4. **Disposal:** Cleared from frontend memory on logout or failed refresh; server does not persist access tokens.

## Refresh token

1. **Creation:** `secrets.token_urlsafe` opaque value; new family on login/register.
2. **Hash persistence:** SHA-256 of the raw token stored in `refresh_tokens`.
3. **Cookie:** HttpOnly, path `/api/v1/auth`, Max-Age aligned with `REFRESH_TOKEN_EXPIRE_DAYS` (default 14).
4. **Rotation:** Each successful refresh revokes the prior record, inserts a new hash, and links `replaced_by_token_id`.
5. **Family ID:** Shared across rotations in one login session lineage.
6. **Reuse detection:** Presenting a revoked token in a family revokes all active tokens in that family.
7. **Revocation:** Logout revokes the current token; reuse detection revokes the family; user-wide revoke is available in the repository.
8. **Logout:** Clears refresh and CSRF cookies; returns success idempotently when safe.
9. **TTL cleanup:** `expires_at` TTL index removes expired documents when Mongo TTL is active.
