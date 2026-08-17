"""Privileged production E2E. Credentials from env only; never printed.

Required env (set in an interactive shell, not committed):
  THYRO_TEST_ADMIN_EMAIL
  THYRO_TEST_ADMIN_PASSWORD
  THYRO_TEST_EXPERT_EMAIL
  THYRO_TEST_EXPERT_PASSWORD

Creates only synthetic non-medical workflow content. Does not approve seeds.
"""

from __future__ import annotations

import json
import os
import random
import sys
import urllib.error
import urllib.request

BASE = "https://thyro-t1.onrender.com"
ORIGIN = "https://thyrot1.chinthakajayaweera1.workers.dev"


class Client:
    def __init__(self) -> None:
        self.cookies: dict[str, str] = {}
        self.token: str | None = None

    def request(
        self,
        method: str,
        path: str,
        *,
        body: dict | None = None,
        auth: bool = False,
        csrf: bool = False,
        origin: str | None = None,
    ) -> tuple[int, dict | str | list]:
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
            headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        req = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8")
                try:
                    payload: dict | str | list = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    payload = raw
                for item in resp.headers.get_all("Set-Cookie") or []:
                    name = item.split("=", 1)[0]
                    value = item.split(";", 1)[0].split("=", 1)[1]
                    self.cookies[name] = value
                return resp.status, payload
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                payload = {"message": raw[:160]}
            return exc.code, payload


def check(results: list[str], label: str, ok: bool, detail: str = "") -> None:
    results.append(f"{'PASS' if ok else 'FAIL'}: {label}" + (f" ({detail})" if detail else ""))


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required env: {name}")
    return value


def _clear_env() -> None:
    for name in (
        "THYRO_TEST_ADMIN_EMAIL",
        "THYRO_TEST_ADMIN_PASSWORD",
        "THYRO_TEST_EXPERT_EMAIL",
        "THYRO_TEST_EXPERT_PASSWORD",
    ):
        os.environ.pop(name, None)


def login(client: Client, email: str, password: str) -> tuple[int, str | None]:
    code, payload = client.request(
        "POST",
        "/api/v1/auth/login",
        body={"email": email, "password": password},
        origin=ORIGIN,
    )
    role = None
    if isinstance(payload, dict):
        client.token = payload.get("access_token")
        user = payload.get("user") or {}
        if isinstance(user, dict):
            role = user.get("role")
    return code, role if isinstance(role, str) else None


def _detail_ids(payload: object) -> tuple[str | None, str | None, int | None, str | None, int | None]:
    if not isinstance(payload, dict):
        return None, None, None, None, None
    document = payload.get("document") if isinstance(payload.get("document"), dict) else {}
    current = payload.get("current_version") if isinstance(payload.get("current_version"), dict) else {}
    return (
        document.get("document_id") if isinstance(document, dict) else None,
        current.get("version_id") if isinstance(current, dict) else None,
        current.get("version") if isinstance(current, dict) else None,
        current.get("content_hash") if isinstance(current, dict) else None,
        document.get("version") if isinstance(document, dict) else None,
    )


def main() -> int:
    results: list[str] = []
    admin_email = admin_password = expert_email = expert_password = ""
    try:
        admin_email = _require_env("THYRO_TEST_ADMIN_EMAIL")
        admin_password = _require_env("THYRO_TEST_ADMIN_PASSWORD")
        expert_email = _require_env("THYRO_TEST_EXPERT_EMAIL")
        expert_password = _require_env("THYRO_TEST_EXPERT_PASSWORD")
    except RuntimeError as exc:
        print(f"BLOCKED: {exc}")
        print(
            "Set THYRO_TEST_ADMIN_EMAIL/PASSWORD and "
            "THYRO_TEST_EXPERT_EMAIL/PASSWORD in this shell (not Git), then re-run."
        )
        return 2

    try:
        admin = Client()
        code, role = login(admin, admin_email, admin_password)
        check(results, "admin login", code == 200 and role == "admin", f"code={code} role={role}")
        if code != 200:
            print("\n".join(results))
            print("SUMMARY failed=early-stop")
            return 1

        code, payload = admin.request("GET", "/api/v1/governance/knowledge?page_size=100", auth=True)
        check(results, "admin knowledge list", code == 200, f"code={code}")

        seed_pending = 0
        seed_approved = 0
        missing_current = 0
        listed = 0
        if code == 200 and isinstance(payload, dict):
            items = payload.get("items") or []
            listed = len(items) if isinstance(items, list) else 0
            statuses: dict[str, int] = {}
            for item in items if isinstance(items, list) else []:
                if not isinstance(item, dict):
                    continue
                status = str(item.get("current_status") or "unknown")
                statuses[status] = statuses.get(status, 0) + 1
                if status == "pending_review":
                    seed_pending += 1
                if status == "approved":
                    seed_approved += 1
                if not item.get("current_version_id"):
                    missing_current += 1
            check(
                results,
                "listed docs have current_version_id",
                missing_current == 0,
                f"missing={missing_current} listed={listed}",
            )
            check(
                results,
                "no approved docs in governance list snapshot",
                seed_approved == 0,
                f"counts={statuses}",
            )
            check(
                results,
                "pending_review docs exist (seeds or drafts)",
                seed_pending >= 1 or listed >= 1,
                f"pending={seed_pending} listed={listed}",
            )

        slug = f"synthetic-e2e-{random.randint(100000, 999999)}"
        code, payload = admin.request(
            "POST",
            "/api/v1/governance/knowledge",
            auth=True,
            body={
                "slug": slug,
                "title": "Synthetic Workflow Verification Document",
                "source_name": "Internal Synthetic Source",
                "source_url": "https://example.org/synthetic-workflow",
                "topic": "general_education",
                "language": "english",
                "body": (
                    "SYNTHETIC NON-MEDICAL WORKFLOW TEXT ONLY. "
                    "This content exists solely to verify governance routing."
                ),
                "medical_disclaimer": "Educational workflow test only.",
            },
        )
        check(results, "admin create synthetic draft", code == 201, f"code={code}")
        document_id, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

        if document_id and version_id and isinstance(occ_version, int):
            code, payload = admin.request(
                "PATCH",
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                auth=True,
                body={
                    "expected_version": occ_version,
                    "body": (
                        "SYNTHETIC NON-MEDICAL WORKFLOW TEXT ONLY. Edited once for E2E. "
                        "No clinical advice."
                    ),
                },
            )
            check(results, "admin edit draft", code == 200, f"code={code}")
            _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

            code, payload = admin.request(
                "POST",
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
                auth=True,
                body={"expected_version": occ_version},
            )
            check(results, "admin submit for review", code == 200, f"code={code}")
            if isinstance(payload, dict):
                status = (payload.get("document") or {}).get("current_status")
                review_status = (payload.get("current_version") or {}).get("review_status")
                check(
                    results,
                    "submitted becomes pending_review",
                    status == "pending_review" and review_status == "pending_review",
                    f"status={status} review={review_status}",
                )
            _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

            code, _ = admin.request(
                "PATCH",
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                auth=True,
                body={"expected_version": (occ_version or 1), "title": "Should Fail ReadOnly"},
            )
            check(
                results,
                "submitted draft edit denied",
                code in {400, 403, 409, 422},
                f"code={code}",
            )

            code, _ = admin.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}/versions",
                auth=True,
            )
            check(results, "admin version history", code == 200, f"code={code}")

            code, _ = admin.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}/review-history",
                auth=True,
            )
            check(results, "admin review history", code == 200, f"code={code}")

            code, _ = admin.request(
                "POST",
                f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
                auth=True,
                body={
                    "decision": "approve",
                    "expected_version": occ_version,
                    "expected_content_hash": content_hash or "x",
                    "comments": "Admin must not approve",
                },
            )
            check(results, "admin approve denied", code == 403, f"code={code}")

            code, _ = admin.request(
                "PATCH",
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                auth=True,
                body={"expected_version": 1, "current_status": "approved"},
            )
            check(
                results,
                "admin generic status change rejected",
                code in {400, 403, 409, 422},
                f"code={code}",
            )

        expert = Client()
        code, role = login(expert, expert_email, expert_password)
        check(
            results,
            "expert login",
            code == 200 and role == "medical_expert",
            f"code={code} role={role}",
        )
        if code != 200:
            print("\n".join(results))
            failed = sum(1 for line in results if line.startswith("FAIL"))
            print(f"SUMMARY failed={failed} total={len(results)}")
            return 1

        code, payload = expert.request("GET", "/api/v1/governance/review-queue?page_size=100", auth=True)
        check(results, "expert review queue", code == 200, f"code={code}")
        queue_has_doc = False
        if isinstance(payload, dict) and document_id:
            items = payload.get("items") or []
            if isinstance(items, list):
                queue_has_doc = any(
                    isinstance(item, dict) and item.get("document_id") == document_id for item in items
                )
        check(results, "synthetic draft in review queue", bool(queue_has_doc), f"found={queue_has_doc}")

        if document_id and version_id and content_hash and isinstance(occ_version, int):
            code, _ = expert.request(
                "PATCH",
                f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                auth=True,
                body={"expected_version": occ_version, "body": "Expert must not edit"},
            )
            check(results, "expert edit body denied", code == 403, f"code={code}")

            code, _ = expert.request(
                "POST",
                f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
                auth=True,
                body={
                    "decision": "request_changes",
                    "expected_version": occ_version,
                    "expected_content_hash": content_hash,
                    "comments": "",
                },
            )
            check(
                results,
                "request_changes without comments fails",
                code in {400, 422},
                f"code={code}",
            )

            code, payload = expert.request(
                "POST",
                f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
                auth=True,
                body={
                    "decision": "request_changes",
                    "expected_version": occ_version,
                    "expected_content_hash": content_hash,
                    "comments": "Synthetic workflow: please clarify non-medical wording.",
                },
            )
            check(results, "request_changes with comments", code == 200, f"code={code}")
            _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

            code, hist = expert.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}/review-history",
                auth=True,
            )
            first_review_id = None
            if code == 200 and isinstance(hist, list) and hist:
                first = hist[0] if isinstance(hist[0], dict) else {}
                first_review_id = first.get("id")
                check(
                    results,
                    "first review record created",
                    first.get("decision") == "request_changes",
                    f"decision={first.get('decision')}",
                )

            code, payload = admin.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}",
                auth=True,
            )
            check(results, "admin reload after changes requested", code == 200, f"code={code}")
            _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)
            status = None
            if isinstance(payload, dict):
                status = (payload.get("document") or {}).get("current_status")

            if status == "changes_requested" and isinstance(occ_version, int):
                code, payload = admin.request(
                    "PATCH",
                    f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}",
                    auth=True,
                    body={
                        "expected_version": occ_version,
                        "body": (
                            "SYNTHETIC NON-MEDICAL WORKFLOW TEXT ONLY. "
                            "Clarified after request_changes. No clinical advice."
                        ),
                    },
                )
                check(results, "admin edit after changes_requested", code == 200, f"code={code}")
                _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

                code, payload = admin.request(
                    "POST",
                    f"/api/v1/governance/knowledge/{document_id}/versions/{version_id}/submit",
                    auth=True,
                    body={"expected_version": occ_version},
                )
                check(results, "admin resubmit", code == 200, f"code={code}")
                _, version_id, occ_version, content_hash, doc_version = _detail_ids(payload)

            code, _ = expert.request(
                "POST",
                f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
                auth=True,
                body={
                    "decision": "approve",
                    "expected_version": occ_version,
                    "expected_content_hash": "0" * 64,
                    "comments": "Synthetic hash mismatch probe",
                },
            )
            check(results, "hash mismatch returns 409", code == 409, f"code={code}")

            # Reject synthetic content (do not approve into patient retrieval).
            code, payload = expert.request(
                "POST",
                f"/api/v1/governance/review-queue/{document_id}/{version_id}/decision",
                auth=True,
                body={
                    "decision": "reject",
                    "expected_version": occ_version,
                    "expected_content_hash": content_hash,
                    "comments": "Synthetic workflow complete; rejecting test document.",
                },
            )
            check(results, "exact-hash decision succeeds", code == 200, f"code={code}")
            if isinstance(payload, dict):
                final_status = (payload.get("document") or {}).get("current_status")
                check(results, "synthetic isolated as rejected", final_status == "rejected", f"status={final_status}")
            _, _, _, _, doc_version = _detail_ids(payload)

            code, hist = expert.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}/review-history",
                auth=True,
            )
            check(results, "immutable review history loads", code == 200, f"code={code}")
            if code == 200 and isinstance(hist, list):
                check(
                    results,
                    "append-only reviews present",
                    len(hist) >= 2,
                    f"count={len(hist)}",
                )
                if first_review_id:
                    kept = any(isinstance(r, dict) and r.get("id") == first_review_id for r in hist)
                    check(results, "prior review record unchanged/present", kept)

            # Retire applies only to approved content; rejected isolation is the cleanup.
            code, _ = admin.request(
                "POST",
                f"/api/v1/governance/knowledge/{document_id}/retire",
                auth=True,
                body={
                    "expected_version": doc_version or 1,
                    "reason": "Synthetic E2E cleanup attempt",
                },
            )
            check(
                results,
                "synthetic cleanup (reject isolates; retire only if approved)",
                code in {200, 400, 422},
                f"code={code}",
            )

        # Patient safety
        patient = Client()
        email = f"e2e.patient.{random.randint(100000, 999999)}@example.com"
        password = "SecurePass123!"
        code, _ = patient.request(
            "POST",
            "/api/v1/auth/register",
            body={
                "full_name": "E2E Patient",
                "email": email,
                "password": password,
                "confirm_password": password,
                "consent_accepted": True,
                "disclaimer_accepted": True,
                "role": "admin",
            },
            origin=ORIGIN,
        )
        check(results, "register rejects role field", code == 422, f"code={code}")

        code, payload = patient.request(
            "POST",
            "/api/v1/auth/register",
            body={
                "full_name": "E2E Patient",
                "email": email,
                "password": password,
                "confirm_password": password,
                "consent_accepted": True,
                "disclaimer_accepted": True,
            },
            origin=ORIGIN,
        )
        role = None
        if isinstance(payload, dict):
            patient.token = payload.get("access_token")
            role = (payload.get("user") or {}).get("role")
        check(
            results,
            "register creates patient only",
            code == 201 and role == "patient",
            f"code={code}",
        )

        for path in ("/api/v1/governance/knowledge", "/api/v1/governance/review-queue"):
            code, _ = patient.request("GET", path, auth=True)
            check(results, f"patient denied {path}", code == 403, f"code={code}")

        if document_id:
            code, _ = patient.request(
                "GET",
                f"/api/v1/governance/knowledge/{document_id}",
                auth=True,
            )
            check(results, "patient denied document detail", code == 403, f"code={code}")

        code, payload = patient.request("POST", "/api/v1/chat/sessions", auth=True, body={})
        sid = payload.get("id") if isinstance(payload, dict) else None
        if sid:
            code, payload = patient.request(
                "POST",
                f"/api/v1/chat/sessions/{sid}/messages",
                auth=True,
                body={"content": "What do pending review seed documents say?"},
            )
            mode = None
            cites: object = None
            if isinstance(payload, dict):
                mode = payload.get("response_mode") or (payload.get("assistant_message") or {}).get(
                    "response_mode"
                )
                cites = payload.get("citations") or (payload.get("assistant_message") or {}).get(
                    "citations"
                )
            cites_ok = cites in (None, []) or (isinstance(cites, list) and len(cites) == 0)
            check(
                results,
                "chat insufficient_evidence for pending seeds",
                code == 200 and mode == "insufficient_evidence" and cites_ok,
                f"code={code} mode={mode}",
            )

        code, _ = patient.request(
            "POST",
            "/api/v1/auth/login",
            body={"email": email, "password": password},
            origin=ORIGIN,
        )
        check(results, "patient login", code == 200, f"code={code}")
        code, _ = patient.request("POST", "/api/v1/auth/refresh", body={}, csrf=True, origin=ORIGIN)
        check(results, "csrf refresh works", code == 200, f"code={code}")
        code, _ = patient.request("POST", "/api/v1/auth/logout", body={}, csrf=True, origin=ORIGIN)
        check(results, "csrf logout works", code == 200, f"code={code}")

        print("\n".join(results))
        failed = sum(1 for line in results if line.startswith("FAIL"))
        print(f"SUMMARY failed={failed} total={len(results)}")
        return 1 if failed else 0
    finally:
        admin_email = admin_password = expert_email = expert_password = ""
        _clear_env()


if __name__ == "__main__":
    raise SystemExit(main())
