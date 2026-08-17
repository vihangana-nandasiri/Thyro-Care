# Google Sign-In setup (Phase 13A)

ThyroCare AI uses the Google Identity Services **ID token popup** flow.
No Google Client Secret is required on the backend or frontend for this flow.

## Google Cloud Console

1. Create (or select) an OAuth 2.0 Client ID of type **Web application**.
2. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://thyrot1.chinthakajayaweera1.workers.dev`
3. Copy the **Client ID** only (never commit it).

## Render (backend)

```
GOOGLE_AUTH_ENABLED=true
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

When `GOOGLE_AUTH_ENABLED=true`, `GOOGLE_CLIENT_ID` is required at startup.

## Cloudflare (frontend build)

```
VITE_GOOGLE_CLIENT_ID=<same-client-id>.apps.googleusercontent.com
```

Rebuild after setting the variable (clear build cache if needed). Without this
value, the Google button is not rendered.

## Backend verification

`GoogleIdentityService` calls `google.oauth2.id_token.verify_oauth2_token` and
checks audience, issuer, expiry, `sub`, email, and `email_verified`. Invalid
tokens map to a generic 401. Production does not call Google's tokeninfo endpoint.

## Identity persistence

Collection `auth_identities` stores `provider=google` + `provider_subject=sub`.
Email is not the permanent identity key. ID tokens and full Google profiles are
not stored.

## Account rules

- New Google users are created as **PATIENT** only (`email_verified=true`)
- Existing local email without a linked identity → conflict; password sign-in
  required before any future linking feature
- ADMIN / MEDICAL_EXPERT accounts are never created or replaced by Google login
- Client must not send role/email/name/user_id — only `{ "credential": "..." }`

## CSP

The Worker entrypoint (`worker/index.ts`) allows only required GSI origins for
script/frame/connect/style. Do not add wildcards.

## Rollback

Set `GOOGLE_AUTH_ENABLED=false` on Render and remove `VITE_GOOGLE_CLIENT_ID`
from Cloudflare, then redeploy both.
