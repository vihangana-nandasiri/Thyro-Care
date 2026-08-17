"""Email delivery abstraction for authentication messages."""

from __future__ import annotations

import html
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Protocol

from app.core.config import Settings, get_settings
from app.core.exceptions import ValidationException
from app.core.logging import get_logger

logger = get_logger(__name__)

GENERIC_DELIVERY_UNAVAILABLE = "Email delivery is temporarily unavailable"


@dataclass(frozen=True, slots=True)
class OutboundEmail:
    to_email: str
    subject: str
    text_body: str
    html_body: str


class EmailSender(Protocol):
    async def send(self, message: OutboundEmail) -> None: ...


class NullEmailSender:
    """Test/dev sender that records messages without network I/O."""

    def __init__(self) -> None:
        self.sent: list[OutboundEmail] = []

    async def send(self, message: OutboundEmail) -> None:
        self.sent.append(message)


class SmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send(self, message: OutboundEmail) -> None:
        msg = EmailMessage()
        msg["Subject"] = message.subject
        msg["From"] = (
            f"{self.settings.smtp_from_name} <{self.settings.smtp_from_email}>"
            if self.settings.smtp_from_name
            else self.settings.smtp_from_email
        )
        msg["To"] = message.to_email
        msg.set_content(message.text_body)
        msg.add_alternative(message.html_body, subtype="html")
        try:
            with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
                if self.settings.smtp_use_tls:
                    smtp.starttls()
                if self.settings.smtp_username:
                    smtp.login(self.settings.smtp_username, self.settings.smtp_password)
                smtp.send_message(msg)
        except Exception:
            logger.exception("smtp_send_failed")
            raise ValidationException(GENERIC_DELIVERY_UNAVAILABLE) from None


def _escape(value: str) -> str:
    return html.escape(value, quote=True)


class EmailService:
    def __init__(
        self,
        settings: Settings | None = None,
        sender: EmailSender | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        if sender is not None:
            self.sender = sender
        elif not self.settings.email_delivery_enabled:
            self.sender = NullEmailSender()
        else:
            self.sender = SmtpEmailSender(self.settings)

    def _frontend_link(self, path: str, raw_token: str) -> str:
        base = self.settings.frontend_public_url.rstrip("/")
        return f"{base}{path}#token={raw_token}"

    async def send_verification_email(
        self, *, to_email: str, full_name: str, raw_token: str
    ) -> None:
        link = self._frontend_link("/verify-email", raw_token)
        safe_name = _escape(full_name.strip() or "there")
        safe_link = _escape(link)
        subject = "Verify your ThyroCare AI email"
        text = (
            f"Hello {full_name.strip() or 'there'},\n\n"
            "Confirm your email address for ThyroCare AI by opening this link:\n"
            f"{link}\n\n"
            "If you did not create an account, you can ignore this message.\n"
        )
        html_body = (
            f"<p>Hello {safe_name},</p>"
            "<p>Confirm your email address for ThyroCare AI by opening this link:</p>"
            f'<p><a href="{safe_link}">Verify email</a></p>'
            "<p>If you did not create an account, you can ignore this message.</p>"
        )
        await self.sender.send(
            OutboundEmail(to_email=to_email, subject=subject, text_body=text, html_body=html_body)
        )

    async def send_password_reset_email(
        self, *, to_email: str, full_name: str, raw_token: str
    ) -> None:
        link = self._frontend_link("/reset-password", raw_token)
        safe_name = _escape(full_name.strip() or "there")
        safe_link = _escape(link)
        subject = "Reset your ThyroCare AI password"
        text = (
            f"Hello {full_name.strip() or 'there'},\n\n"
            "Use this link to reset your ThyroCare AI password:\n"
            f"{link}\n\n"
            "If you did not request a reset, you can ignore this message.\n"
        )
        html_body = (
            f"<p>Hello {safe_name},</p>"
            "<p>Use this link to reset your ThyroCare AI password:</p>"
            f'<p><a href="{safe_link}">Reset password</a></p>'
            "<p>If you did not request a reset, you can ignore this message.</p>"
        )
        await self.sender.send(
            OutboundEmail(to_email=to_email, subject=subject, text_body=text, html_body=html_body)
        )

    async def send_password_changed_email(self, *, to_email: str, full_name: str) -> None:
        safe_name = _escape(full_name.strip() or "there")
        subject = "Your ThyroCare AI password was changed"
        text = (
            f"Hello {full_name.strip() or 'there'},\n\n"
            "Your ThyroCare AI password was changed successfully.\n"
            "If you did not make this change, contact support immediately.\n"
        )
        html_body = (
            f"<p>Hello {safe_name},</p>"
            "<p>Your ThyroCare AI password was changed successfully.</p>"
            "<p>If you did not make this change, contact support immediately.</p>"
        )
        await self.sender.send(
            OutboundEmail(to_email=to_email, subject=subject, text_body=text, html_body=html_body)
        )
