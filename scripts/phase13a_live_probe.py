"""Safe live checks for Phase 13A enablement. No secrets printed."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

BE = "https://thyro-t1.onrender.com"
FE = "https://thyrot1.chinthakajayaweera1.workers.dev"
ORIGIN = FE
API = f"{BE}/api/v1"


def fetch(url: str, *, method: str = "GET", body: dict | None = None) -> tuple[int, str, dict]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "User-Agent": "ThyroCare-Phase13A/1.0",
        "Accept": "application/json",
        "Origin": ORIGIN,
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8", "ignore")
            return resp.status, raw, dict(resp.headers.items())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "ignore")
        return exc.code, raw, dict(exc.headers.items())


def main() -> None:
    print("=== FRONTEND BUNDLE ===")
    status, html, _ = fetch(f"{FE}/")
    print("frontend_home_status", status)
    match = re.search(r"/assets/index-[^\"]+\.js", html)
    print("index_asset", match.group(0) if match else None)
    if match:
        _, bundle, _ = fetch(f"{FE}{match.group(0)}")
        exact = "https://thyro-t1.onrender.com/api/v1"
        print("active_api_exact", exact in bundle)
        print(
            "apiBaseUrl_production_literal",
            'apiBaseUrl:"https://thyro-t1.onrender.com/api/v1"' in bundle,
        )
        print(
            "apiBaseUrl_localhost_literal",
            'apiBaseUrl:"http://localhost:8000' in bundle,
        )
        print("double_onrender", "onrender.com.onrender.com" in bundle)
        print("localhost_8000_string_present", "localhost:8000" in bundle)
        print("forgot_route", "/forgot-password" in bundle)
        print("reset_route", "/reset-password" in bundle)
        print("verify_route", "/verify-email" in bundle)
        print("privacy_route", "/privacy" in bundle)
        print("gsi_client_ref", "accounts.google.com/gsi/client" in bundle)
        print(
            "google_client_id_embedded",
            bool(re.search(r"apps\.googleusercontent\.com", bundle)),
        )
        print("client_secret_in_bundle", "client_secret" in bundle.lower())

    print("=== LEGAL ROUTES ===")
    for path in ("/privacy", "/terms", "/medical-disclaimer"):
        code, body, _ = fetch(f"{FE}{path}")
        kind = (
            "spa"
            if "<!DOCTYPE html>" in body[:200].upper() or "ThyroCare" in body
            else "other"
        )
        print(f"legal{path}", code, kind)

    print("=== AUTH BASELINE ===")
    code, raw, _ = fetch(
        f"{API}/auth/login",
        method="POST",
        body={"email": "x@example.com", "password": "wrong-password-xx"},
    )
    print("login_exists_status", code)
    code, raw, _ = fetch(
        f"{API}/auth/forgot-password",
        method="POST",
        body={"email": "synthetic.unknown@example.com"},
    )
    print("forgot_password_status", code)
    try:
        payload = json.loads(raw)
        msg = payload.get("message") or payload.get("detail")
        print("forgot_password_payload_type", type(msg).__name__)
        if isinstance(msg, str):
            print(
                "forgot_password_generic_shape",
                "eligible" in msg.lower() or msg == "Not Found",
            )
    except Exception:
        print("forgot_password_raw_len", len(raw))

    print("=== OPENAPI ===")
    code, raw, _ = fetch(f"{BE}/openapi.json")
    print("openapi_status", code)
    if code == 200:
        paths = sorted(
            p for p in json.loads(raw).get("paths", {}) if "/auth" in p
        )
        print("auth_path_count", len(paths))
        for p in paths:
            print("auth_path", p)
        print(
            "openapi_has_forgot",
            any(p.endswith("/forgot-password") for p in paths),
        )
        print(
            "openapi_has_google",
            any(p.endswith("/google") for p in paths),
        )


if __name__ == "__main__":
    main()
