# Production auth cookies and CORS

Frontend (current): `https://thyrot1.chinthakajayaweera1.workers.dev`  
Backend: separately hosted HTTPS API (not on Cloudflare static assets).

Incorrect cookie/CORS settings often cause:

- Login appearing successful
- Refresh cookie not stored
- Browser reload logging the user out
- CSRF refresh failures

## Shared requirements

- HTTPS on both frontend and API in production
- `allow_credentials=true` on CORS
- Exact origin in `ALLOWED_ORIGINS` (no `*` with credentials)
- Allow request headers: `Authorization`, `Content-Type`, `X-CSRF-Token`
- Expose useful response headers as already configured (e.g. `X-Request-ID`, `X-Process-Time`)
- Refresh cookie path aligned with API (`COOKIE_PATH=/api/v1/auth` by default)
- Access token stays in memory on the client; refresh uses HttpOnly cookie

## 1) Same-site custom-domain deployment

Example: `https://app.example.com` + `https://api.example.com` under a shared registrable domain with careful cookie domain design — or better, serve API under the same site via reverse proxy (`https://app.example.com/api`).

Recommended when API is reverse-proxied on the same site:

| Setting           | Value                                         |
| ----------------- | --------------------------------------------- |
| `COOKIE_SECURE`   | `true`                                        |
| `COOKIE_SAMESITE` | `lax` (or `strict` if acceptable)             |
| `COOKIE_DOMAIN`   | usually unset (host-only) or carefully scoped |
| `ALLOWED_ORIGINS` | exact app origin                              |

## 2) Cross-site frontend and backend (current Workers.dev pattern)

Example: Workers.dev frontend + API on another host.

| Setting           | Value                                             |
| ----------------- | ------------------------------------------------- |
| `COOKIE_SECURE`   | `true` (**required** for `SameSite=None`)         |
| `COOKIE_SAMESITE` | `none` (required for cross-site cookie send)      |
| `COOKIE_DOMAIN`   | unset unless you control a shared parent domain   |
| `ALLOWED_ORIGINS` | `https://thyrot1.chinthakajayaweera1.workers.dev` |

Do **not** set `SameSite=None` without `Secure=true`. Backend settings already reject `COOKIE_SAMESITE=none` when `COOKIE_SECURE` is false.

Browsers may further restrict third-party cookies; a same-site custom domain is preferred long-term.

## 3) Local development

| Setting           | Value                   |
| ----------------- | ----------------------- |
| Frontend          | `http://localhost:5173` |
| API               | `http://localhost:8000` |
| `COOKIE_SECURE`   | `false`                 |
| `COOKIE_SAMESITE` | `lax`                   |
| `ALLOWED_ORIGINS` | `http://localhost:5173` |

## Verification checklist

1. Login sets refresh + CSRF cookies (Application → Cookies).
2. Hard reload keeps session via `/auth/refresh` + CSRF header.
3. Logout clears cookies.
4. Cross-origin XHR/fetch uses `credentials: include` (Axios already configured).
5. No wildcard CORS in production.
