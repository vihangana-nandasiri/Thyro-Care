# Email delivery setup (Phase 13A)

ThyroCare AI uses an email service abstraction (`backend/app/services/email_service.py`).

## Modes

| Setting                                               | Behavior                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `EMAIL_DELIVERY_ENABLED=false`                        | No SMTP send; auth flows fail closed without leaking account existence |
| `EMAIL_DELIVERY_ENABLED=true` + `EMAIL_PROVIDER=smtp` | SMTP send with plain-text + HTML alternatives                          |

Tests inject a fake sender; no public internet is required.

## Required Render variables (when enabling delivery)

```
EMAIL_DELIVERY_ENABLED=true
EMAIL_PROVIDER=smtp
SMTP_HOST=<provider host>
SMTP_PORT=587
SMTP_USERNAME=<username>
SMTP_PASSWORD=<secret>
SMTP_USE_TLS=true
SMTP_FROM_EMAIL=<verified from address>
SMTP_FROM_NAME=ThyroCare AI
FRONTEND_PUBLIC_URL=https://thyrot1.chinthakajayaweera1.workers.dev
```

Also enable the flows you need:

```
EMAIL_VERIFICATION_ENABLED=true
EMAIL_VERIFICATION_TOKEN_TTL_HOURS=24
PASSWORD_RESET_ENABLED=true
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
```

Startup validation requires SMTP host/from when delivery is enabled.

## Message rules

- Escape user-derived values in HTML
- State that unexpected messages can be ignored
- No medical content, attachments, access tokens, or refresh tokens
- Links use frontend fragment tokens (`#token=`) to reduce server-log exposure

## Templates

- Verify email
- Reset password
- Password changed notification

## Secret rotation

Rotate SMTP credentials in the provider console, update Render env vars, and
redeploy. Do not commit real passwords. Example files use empty placeholders only.

## Troubleshooting

- Delivery disabled: APIs still return generic success for forgot/resend.
- SMTP auth failures: logged without username/password; user sees generic messaging.
- Wrong `FRONTEND_PUBLIC_URL`: email links point at the wrong origin.
