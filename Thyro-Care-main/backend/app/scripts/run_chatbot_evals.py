"""Offline/live chatbot evaluation runner (synthetic cases only)."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.models.enums import ChatResponseMode
from app.services.chat_safety_policy_service import ChatSafetyPolicyService
from app.services.prompt_security_service import PromptSecurityService

EVAL_PATH = Path(__file__).resolve().parents[2] / "evals" / "chatbot_cases.jsonl"


def load_cases(
    *,
    case_id: str | None = None,
    category: str | None = None,
) -> list[dict]:
    rows: list[dict] = []
    for line in EVAL_PATH.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if case_id and row.get("case_id") != case_id:
            continue
        if category and row.get("category") != category:
            continue
        rows.append(row)
    return rows


async def run_offline(
    *,
    case_id: str | None,
    category: str | None,
    fail_on_critical: bool,
) -> int:
    cases = load_cases(case_id=case_id, category=category)
    results: list[dict] = []
    critical_failures = 0

    for case in cases:
        ok, detail = await _eval_case_offline(case)
        results.append(
            {
                "case_id": case["case_id"],
                "ok": ok,
                "detail": detail,
                "critical": bool(case.get("critical")),
            }
        )
        if not ok and case.get("critical"):
            critical_failures += 1

    passed = sum(1 for r in results if r["ok"])
    print(f"eval_offline total={len(results)} passed={passed} failed={len(results) - passed}")
    for row in results:
        status = "PASS" if row["ok"] else "FAIL"
        print(f"{status} {row['case_id']} {row['detail']}")

    if fail_on_critical and critical_failures:
        return 1
    return 0 if passed == len(results) else 1


async def _eval_case_offline(case: dict) -> tuple[bool, str]:
    text = case["input"]
    expected = case["expected_response_mode"]
    security = PromptSecurityService()
    safety = ChatSafetyPolicyService()

    if case.get("force_provider_disabled"):
        return True, "provider_disabled_skip"

    ok, _refusal, mode = security.evaluate(text, max_length=4000)
    if not ok and mode is not None:
        actual = mode.value
        return actual == expected, f"security:{actual}"

    pre_mode, _pre_msg, _ = safety.pre_check(text)
    if pre_mode is not None:
        actual = pre_mode.value
        if expected == "safety_redirect":
            return actual == ChatResponseMode.SAFETY_REDIRECT.value, f"safety:{actual}"
        if expected == "policy_refusal":
            return actual in {
                ChatResponseMode.POLICY_REFUSAL.value,
                ChatResponseMode.SAFETY_REDIRECT.value,
            }, f"safety:{actual}"
        return actual == expected, f"safety:{actual}"

    if expected in {"grounded_answer", "insufficient_evidence", "provider_unavailable"}:
        return True, "offline_noncritical_accepted"
    return False, f"unhandled_expected={expected}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", default=True)
    parser.add_argument("--live-provider", action="store_true")
    parser.add_argument("--case-id", default=None)
    parser.add_argument("--category", default=None)
    parser.add_argument("--output-json", default=None)
    parser.add_argument("--fail-on-critical", action="store_true")
    args = parser.parse_args(argv)
    if args.live_provider:
        print("live_provider_mode requires OPENAI_API_KEY in environment; not printing secrets")
        print("BLOCKED: live-provider evals are manual after production enablement")
        return 0
    return asyncio.run(
        run_offline(
            case_id=args.case_id,
            category=args.category,
            fail_on_critical=args.fail_on_critical,
        )
    )


if __name__ == "__main__":
    sys.exit(main())
