"""Production smoke checks against Render + Cloudflare. No secrets printed."""
from __future__ import annotations

import json
import random
import sys
import urllib.error
import urllib.request

BASE = "https://thyro-t1.onrender.com"
ORIGIN = "https://thyrot1.chinthakajayaweera1.workers.dev"
FE = ORIGIN


class Client:
    def __init__(self) -> None:
        self.cookies: dict[str, str] = {}
        self.token: str | None = None

    def _cookie_header(self) -> str:
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())

    def request(
        self,
        method: str,
        path: str,
        *,
        body: dict | None = None,
        auth: bool = False,
        csrf: bool = False,
        origin: str | None = None,
    ) -> tuple[int, dict | str, dict[str, str]]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if csrf and "thyrocare_csrf" in self.cookies:
            headers["X-CSRF-Token"] = self.cookies["thyrocare_csrf"]
        if origin:
            headers["Origin"] = origin
        if self.cookies:
            headers["Cookie"] = self._cookie_header()
        req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                payload: dict | str
                try:
                    payload = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    payload = raw
                set_cookie = resp.headers.get_all("Set-Cookie") or []
                for item in set_cookie:
                    name = item.split("=", 1)[0]
                    value = item.split(";", 1)[0].split("=", 1)[1]
                    self.cookies[name] = value
                return resp.status, payload, dict(resp.headers.items())
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = raw
            return exc.code, payload, dict(exc.headers.items()) if exc.headers else {}


def main() -> int:
    c = Client()
    results: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        results.append(f"{'PASS' if ok else 'FAIL'}: {label}" + (f" ({detail})" if detail else ""))

    # Health
    code, payload, _ = c.request("GET", "/api/v1/health")
    check(
        "api health connected",
        code == 200 and isinstance(payload, dict) and payload.get("data", {}).get("database_status") == "connected",
        f"code={code}",
    )

    # CORS preflight
    req = urllib.request.Request(
        f"{BASE}/api/v1/auth/login",
        method="OPTIONS",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,x-csrf-token",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        acao = resp.headers.get("Access-Control-Allow-Origin")
        acac = resp.headers.get("Access-Control-Allow-Credentials")
        check("cors allow origin", acao == ORIGIN, f"acao={acao}")
        check("cors credentials", (acac or "").lower() == "true", f"acac={acac}")

    email = f"smoke.{random.randint(100000, 999999)}@example.com"
    password = "SecurePass123!"
    code, payload, headers = c.request(
        "POST",
        "/api/v1/auth/register",
        body={
            "full_name": "Smoke Patient",
            "email": email,
            "password": password,
            "confirm_password": password,
            "consent_accepted": True,
            "disclaimer_accepted": True,
        },
        origin=ORIGIN,
    )
    check("register", code == 201 and isinstance(payload, dict) and "access_token" in payload, f"code={code}")
    if isinstance(payload, dict):
        c.token = payload.get("access_token")
    set_cookie = headers.get("Set-Cookie") or headers.get("set-cookie") or ""
    check("refresh cookie secure", "Secure" in set_cookie or "secure" in set_cookie.lower())
    check("refresh cookie samesite=none", "samesite=none" in set_cookie.lower())

    code, payload, _ = c.request(
        "POST",
        "/api/v1/auth/login",
        body={"email": email, "password": password},
        origin=ORIGIN,
    )
    check("login", code == 200 and isinstance(payload, dict) and "access_token" in payload, f"code={code}")
    if isinstance(payload, dict):
        c.token = payload.get("access_token")

    code, payload, _ = c.request("POST", "/api/v1/auth/refresh", body={}, csrf=True, origin=ORIGIN)
    check("refresh", code == 200 and isinstance(payload, dict) and "access_token" in payload, f"code={code}")
    if isinstance(payload, dict) and payload.get("access_token"):
        c.token = payload["access_token"]

    code, payload, _ = c.request("GET", "/api/v1/profiles/me", auth=True)
    check("profile", code == 200, f"code={code}")

    code, payload, _ = c.request(
        "POST",
        "/api/v1/medications",
        auth=True,
        body={
            "name": "Smoke Test Supplement A",
            "dosage_text": "1 unit",
            "frequency": "once_daily",
            "reminder_times": ["08:00"],
            "start_date": "2026-07-01",
            "status": "active",
            "timezone": "UTC",
        },
    )
    med_id = payload.get("id") if isinstance(payload, dict) else None
    med_version = payload.get("version") if isinstance(payload, dict) else None
    if code != 201:
        req_id = ""
        if isinstance(payload, dict):
            req_id = str(payload.get("request_id") or "")
            safe_msg = str(payload.get("message") or payload.get("code") or "error")[:120]
        else:
            safe_msg = str(payload)[:120]
        check("medication create", False, f"code={code} request_id={req_id} msg={safe_msg}")
    else:
        check("medication create", True, f"code={code}")

    if med_id:
        code, payload, _ = c.request("GET", f"/api/v1/medications/{med_id}", auth=True)
        check("medication read", code == 200, f"code={code}")

        code, payload, _ = c.request(
            "PATCH",
            f"/api/v1/medications/{med_id}",
            auth=True,
            body={
                "name": "Smoke Test Supplement A Updated",
                "expected_version": med_version if isinstance(med_version, int) else 1,
            },
        )
        check("medication update", code == 200, f"code={code}")

        code, payload, _ = c.request("DELETE", f"/api/v1/medications/{med_id}", auth=True)
        check("medication delete", code == 200, f"code={code}")

    code, payload, _ = c.request(
        "POST",
        "/api/v1/appointments",
        auth=True,
        body={
            "title": "TSH follow-up",
            "appointment_type": "tsh_test",
            "scheduled_start": "2026-08-01T10:00:00+00:00",
            "location_type": "in_person",
            "timezone": "UTC",
        },
    )
    check("appointment create", code in {200, 201}, f"code={code}")

    code, payload, _ = c.request(
        "POST",
        "/api/v1/symptoms",
        auth=True,
        body={
            "symptom_type": "fatigue",
            "severity": "mild",
            "status": "active",
            "frequency": "occasional",
            "started_at": "2026-07-01T08:00:00+00:00",
            "timezone": "UTC",
            "description": "",
            "notes": "",
            "safety_answers": {
                "breathing_emergency": False,
                "severe_chest_discomfort": False,
                "loss_of_consciousness": False,
                "severe_or_rapid_neck_swelling": False,
                "unable_to_swallow": False,
                "uncontrolled_bleeding": False,
                "severe_new_confusion": False,
                "rapidly_worsening_condition": False,
                "feels_immediately_unsafe": False,
            },
        },
    )
    check("symptom create", code in {200, 201}, f"code={code}")

    code, payload, _ = c.request("POST", "/api/v1/chat/sessions", auth=True, body={})
    check("chat session", code in {200, 201}, f"code={code}")
    session_id = payload.get("id") if isinstance(payload, dict) else None
    if session_id:
        code, payload, _ = c.request(
            "POST",
            f"/api/v1/chat/sessions/{session_id}/messages",
            auth=True,
            body={"content": "What is fatigue after surgery?"},
        )
        mode = None
        if isinstance(payload, dict):
            mode = payload.get("response_mode") or payload.get("assistant_message", {}).get("response_mode")
        check(
            "chat provider-disabled/honest mode",
            code in {200, 201, 503} or (mode in {"provider_unavailable", "insufficient_evidence", "policy_refusal"}),
            f"code={code} mode={mode}",
        )

    code, payload, _ = c.request("GET", "/api/v1/governance/knowledge", auth=True)
    check("patient governance denied", code == 403, f"code={code}")

    code, payload, _ = c.request("POST", "/api/v1/auth/logout", body={}, csrf=True, origin=ORIGIN)
    check("logout", code == 200, f"code={code}")

    # Frontend SPA routes (Cloudflare may bot-challenge some clients; treat 200 as success)
    for path in ["/", "/login", "/register", "/emergency", "/dashboard", "/admin/knowledge", "/medical-review"]:
        req = urllib.request.Request(
            f"{FE}{path}",
            method="GET",
            headers={"User-Agent": "ThyroCare-Smoke/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                check(f"spa {path}", resp.status == 200, f"code={resp.status}")
        except urllib.error.HTTPError as exc:
            check(f"spa {path}", False, f"code={exc.code}")

    print("\n".join(results))
    failed = sum(1 for line in results if line.startswith("FAIL"))
    print(f"SUMMARY failed={failed} total={len(results)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
