from datetime import timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import (
    APPEAL_KIND_BLACKLIST,
    APPEAL_KIND_DEACTIVATION,
    APPEAL_PENDING,
    APPEAL_REJECTED,
    STATUS_BLACKLISTED,
    STATUS_DEACTIVATED,
)
from app.models import Appeal, User, utcnow
from app.serializers import appeal_out, iso


def latest_appeal(db: Session, user: User) -> Optional[Appeal]:
    return db.scalar(select(Appeal).where(Appeal.user_id == user.id).order_by(Appeal.created_at.desc()))


def appeal_eligibility(user: User, latest: Optional[Appeal]):
    if user.status not in (STATUS_DEACTIVATED, STATUS_BLACKLISTED):
        return False, None
    if latest is not None and latest.status == APPEAL_PENDING:
        return False, None
    if latest is not None and latest.status == APPEAL_REJECTED and latest.reviewed_at is not None:
        if user.status == STATUS_BLACKLISTED:
            applies = latest.kind == APPEAL_KIND_BLACKLIST
        else:
            applies = (
                latest.kind == APPEAL_KIND_DEACTIVATION
                and user.deactivated_at is not None
                and latest.reviewed_at >= user.deactivated_at
            )
        if applies:
            next_at = latest.reviewed_at + timedelta(days=settings.appeal_cooldown_days)
            if next_at > utcnow():
                return False, next_at
    return True, None


def build_account_status(db: Session, user: User) -> dict:
    latest = latest_appeal(db, user)
    can_appeal, next_at = appeal_eligibility(user, latest)
    return {
        "status": user.status,
        "reason": user.deactivation_reason,
        "deactivated_at": iso(user.deactivated_at),
        "support_email": settings.support_email,
        "can_appeal": can_appeal,
        "next_appeal_at": iso(next_at),
        "latest_appeal": appeal_out(latest) if latest else None,
    }