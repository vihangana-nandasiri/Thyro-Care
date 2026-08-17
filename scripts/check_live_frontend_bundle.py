"""Safe live frontend bundle checks. No secrets."""
from __future__ import annotations

import re
import urllib.request

FE = "https://thyrot1.chinthakajayaweera1.workers.dev"
EXPECTED_API = "https://thyro-t1.onrender.com/api/v1"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "ThyroCare-Smoke/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "ignore")


def main() -> None:
    html = fetch(f"{FE}/")
    match = re.search(r"/assets/index-[^\"]+\.js", html)
    print("asset", match.group(0) if match else None)
    if not match:
        raise SystemExit(1)
    bundle = fetch(f"{FE}{match.group(0)}")
    print("expected_api_present", EXPECTED_API in bundle)
    print("double_onrender", "onrender.com.onrender.com" in bundle)
    print("localhost_8000_string_present", "localhost:8000" in bundle)
    print(
        "apiBaseUrl_localhost_literal",
        'apiBaseUrl:"http://localhost:8000' in bundle,
    )
    print(
        "google_client_id_embedded",
        bool(re.search(r"apps\.googleusercontent\.com", bundle)),
    )
    print("client_secret_in_bundle", "client_secret" in bundle.lower())
    print("forgot_route", "/forgot-password" in bundle)


if __name__ == "__main__":
    main()
