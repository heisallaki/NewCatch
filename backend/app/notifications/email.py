import logging
import smtplib
from email.message import EmailMessage

from app.config import settings

logger = logging.getLogger("newcatch.email")

OTP_SUBJECTS = {
    "register": "Verify your New Catch email",
    "login": "Your New Catch sign-in code",
    "reset": "Reset your New Catch password",
}


def send_email(to: str, subject: str, body: str) -> None:
    if settings.email_backend == "console":
        print(f"\n===== EMAIL to {to} =====\nSubject: {subject}\n\n{body}\n=========================\n", flush=True)
        return
    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_username
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
    except Exception:
        logger.exception("Failed to send email with subject %r", subject)


def send_otp_email(to: str, purpose: str, code: str) -> None:
    body = (
        f"Your New Catch verification code is {code}.\n\n"
        f"It expires in {settings.otp_ttl_minutes} minutes and can only be used once. "
        "If you did not request it, ignore this email and never share the code with anyone.\n\n"
        f"Questions: {settings.support_email}"
    )
    send_email(to, OTP_SUBJECTS[purpose], body)


def send_account_exists_email(to: str) -> None:
    body = (
        "Someone tried to create a New Catch account with this email address, but an account already exists.\n\n"
        "If this was you, log in instead or use Forgot Password. If it was not you, you can ignore this email.\n\n"
        f"Questions: {settings.support_email}"
    )
    send_email(to, "You already have a New Catch account", body)