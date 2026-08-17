"""CLI: create ADMIN or MEDICAL_EXPERT accounts in a trusted environment.

Usage (from backend directory with venv active):

    python -m app.scripts.create_privileged_user --role admin
    python -m app.scripts.create_privileged_user --role medical_expert

Password may be supplied interactively via getpass, or via temporary env:

    PRIVILEGED_USER_PASSWORD
    PRIVILEGED_USER_PASSWORD_CONFIRM

Never pass the password as a normal CLI argument. Never commit credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

from app.core.config import get_settings
from app.core.exceptions import ConflictException, ValidationException
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.models.enums import UserRole
from app.services.privileged_user_service import PrivilegedUserService


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision ADMIN or MEDICAL_EXPERT users (trusted environment only).",
    )
    parser.add_argument(
        "--role",
        required=True,
        choices=("admin", "medical_expert"),
        help="Privileged role to create (patient is rejected).",
    )
    parser.add_argument(
        "--full-name",
        default="",
        help="Optional full name (otherwise prompted).",
    )
    parser.add_argument(
        "--email",
        default="",
        help="Optional email (otherwise prompted).",
    )
    return parser.parse_args(argv)


def _read_identity(args: argparse.Namespace) -> tuple[str, str]:
    full_name = args.full_name.strip() or input("Full name: ").strip()
    email = args.email.strip() or input("Email: ").strip()
    return full_name, email


def _read_password() -> tuple[str, str]:
    env_password = os.environ.get("PRIVILEGED_USER_PASSWORD", "")
    env_confirm = os.environ.get("PRIVILEGED_USER_PASSWORD_CONFIRM", "")
    if env_password or env_confirm:
        if not env_password or not env_confirm:
            raise ValidationException(
                "Set both PRIVILEGED_USER_PASSWORD and PRIVILEGED_USER_PASSWORD_CONFIRM",
            )
        return env_password, env_confirm
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    return password, confirm


async def _provision(
    *,
    role: str,
    full_name: str,
    email: str,
    password: str,
    confirm_password: str,
) -> int:
    settings = get_settings()
    await connect_to_mongo(settings)
    database = get_database()
    if database is None:
        print("Database unavailable", file=sys.stderr)
        return 1

    service = PrivilegedUserService(database)
    try:
        result = await service.create_privileged_user(
            role=UserRole(role),
            full_name=full_name,
            email=email,
            password=password,
            confirm_password=confirm_password,
        )
    except (ValidationException, ConflictException) as exc:
        print(f"Provisioning failed: {exc.message}", file=sys.stderr)
        await close_mongo_connection()
        return 1

    print(
        "Privileged user created "
        f"(role={result.role.value}; status={result.account_status.value}; "
        f"verified={result.email_verified})."
    )
    await close_mongo_connection()
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        full_name, email = _read_identity(args)
        password, confirm = _read_password()
    except ValidationException as exc:
        print(f"Provisioning failed: {exc.message}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Cancelled", file=sys.stderr)
        return 130

    try:
        return asyncio.run(
            _provision(
                role=args.role,
                full_name=full_name,
                email=email,
                password=password,
                confirm_password=confirm,
            )
        )
    finally:
        os.environ.pop("PRIVILEGED_USER_PASSWORD", None)
        os.environ.pop("PRIVILEGED_USER_PASSWORD_CONFIRM", None)


if __name__ == "__main__":
    raise SystemExit(main())
