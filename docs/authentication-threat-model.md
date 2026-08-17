# Authentication Threat Model (Phase 6)

Informal design analysis — **not** a penetration test and **not** a regulatory certification.

| Threat                 | Mitigation in Phase 6                            | Residual risk                                    |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Password theft         | Argon2 via `pwdlib`; never log passwords         | Offline cracking if DB leaked                    |
| Credential stuffing    | Login rate-limit foundation; temporary lockout   | In-memory limiter is not distributed             |
| Account enumeration    | Generic login failures                           | Timing side channels possible                    |
| Brute force            | Failed-attempt lock + rate limits                | Bypass if many IPs / no shared store             |
| Access-token theft     | Short TTL; memory-only storage                   | XSS can still read memory in-page                |
| Refresh-token theft    | HttpOnly cookie; hash-at-rest; rotation          | Stolen cookie until rotation/reuse detection     |
| XSS                    | HttpOnly refresh; no access token in web storage | Frontend XSS remains critical                    |
| CSRF                   | Double-submit on refresh/logout                  | Misconfigured SameSite/CORS                      |
| Token replay           | Access expiry; refresh rotation                  | Stolen access token valid until exp              |
| Refresh reuse          | Family revoke on reuse                           | Attacker may obtain one session before detection |
| Open redirect          | Safe internal return-path checks on login        | —                                                |
| Role manipulation      | Server forces PATIENT on register; DB role check | Compromised admin accounts                       |
| Database compromise    | Hashed passwords; hashed refresh tokens          | Still severe; rotate secrets/tokens              |
| Logging leakage        | No passwords/raw tokens in audit payloads        | Misconfigured log shipping                       |
| Distributed rate limit | Documented limitation                            | Need Redis/shared store later                    |

Deferred: email verification, password-reset email, MFA, social login.
