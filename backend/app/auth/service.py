import hmac
from datetime import timedelta
from typing import Optional

from fastapi import Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import BlacklistedEmail, OtpCode, RefreshToken, User, utcnow
from app.security import (
    create_jwt,
    email_hash,
    generate_otp,
    hash_otp,
    hash_token,
    new_refresh_token,
)

ACCESS_COOKIE = "nc_access"
REFRESH_COOKIE = "nc_refresh"


def is_native(request: Request) -> bool:
    return request.headers.get("x-client-type") == "native"


def is_blacklisted(db: Session, email: str) -> bool:
    found = db.scalar(select(BlacklistedEmail.id).where(BlacklistedEmail.email_hash == email_hash(email)))
    return found is not None


def issue_otp(db: Session, email: str, purpose: str) -> tuple[Optional[str], Optional[str]]:
    now = utcnow()
    window_start = now - timedelta(hours=1)
    recent = db.scalars(
        select(OtpCode)
        .where(OtpCode.email == email, OtpCode.purpose == purpose, OtpCode.created_at > window_start)
        .order_by(OtpCode.created_at.desc())
    ).all()
    if len(recent) >= settings.otp_max_per_hour:
        return None, "limit"
    if recent and (now - recent[0].created_at).total_seconds() < settings.otp_resend_seconds:
        return None, "cooldown"
    for old in recent:
        if old.consumed_at is None:
            old.consumed_at = now
    code = generate_otp()
    db.add(
        OtpCode(
            email=email,
            purpose=purpose,
            code_hash=hash_otp(email, purpose, code),
            expires_at=now + timedelta(minutes=settings.otp_ttl_minutes),
            created_at=now,
        )
    )
    db.commit()
    return code, None


def consume_otp(db: Session, email: str, purpose: str, code: str) -> bool:
    now = utcnow()
    otp = db.scalars(
        select(OtpCode)
        .where(
            OtpCode.email == email,
            OtpCode.purpose == purpose,
            OtpCode.consumed_at.is_(None),
            OtpCode.expires_at > now,
        )
        .order_by(OtpCode.created_at.desc())
    ).first()
    if otp is None:
        return False
    if otp.attempts >= settings.otp_max_attempts:
        otp.consumed_at = now
        db.commit()
        return False
    otp.attempts += 1
    if not hmac.compare_digest(otp.code_hash, hash_otp(email, purpose, code)):
        if otp.attempts >= settings.otp_max_attempts:
            otp.consumed_at = now
        db.commit()
        return False
    result = db.execute(
        update(OtpCode).where(OtpCode.id == otp.id, OtpCode.consumed_at.is_(None)).values(consumed_at=now)
    )
    db.commit()
    return result.rowcount == 1


def revoke_all_sessions(db: Session, user_id: int) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )


def start_session(
    db: Session, user: User, request: Request, response: Response, touch_login: bool = True
) -> Optional[dict]:
    now = utcnow()
    refresh = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=now + timedelta(days=settings.refresh_token_days),
            created_at=now,
        )
    )
    if touch_login:
        user.last_login_at = now
    db.commit()
    access = create_jwt(user.id, "access", settings.access_token_minutes)
    if is_native(request):
        return {"access_token": access, "refresh_token": refresh}
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        max_age=settings.access_token_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        max_age=settings.refresh_token_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/auth",
    )
    return None