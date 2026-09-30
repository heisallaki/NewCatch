from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import APPEAL_PENDING, APPEAL_REJECTED, STATUS_DEACTIVATED
from app.database import get_db
from app.deps import get_current_user, rate_limit
from app.errors import ApiError
from app.models import Appeal, User, utcnow
from app.notifications.email import send_email
from app.schemas import AppealPayload
from app.serializers import appeal_out, iso, user_out

router = APIRouter(prefix="/users", tags=["users"])


def latest_appeal(db: Session, user: User) -> Optional[Appeal]:
    return db.scalar(select(Appeal).where(Appeal.user_id == user.id).order_by(Appeal.created_at.desc()))


def appeal_eligibility(user: User, latest: Optional[Appeal]):
    if user.status != STATUS_DEACTIVATED:
        return False, None
    if latest is not None and latest.status == APPEAL_PENDING:
        return False, None
    if (
        latest is not None
        and latest.status == APPEAL_REJECTED
        and latest.reviewed_at is not None
        and user.deactivated_at is not None
        and latest.reviewed_at >= user.deactivated_at
    ):
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


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.get("/me/account-status")
def account_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_account_status(db, user)


@router.post("/me/appeals", dependencies=[Depends(rate_limit("appeal", 10, 3600))])
def create_appeal(
    payload: AppealPayload,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    can_appeal, _ = appeal_eligibility(user, latest_appeal(db, user))
    if not can_appeal:
        raise ApiError(409, "appeal_not_allowed", "You can't submit an appeal right now.")
    appeal = Appeal(user_id=user.id, message=payload.message)
    db.add(appeal)
    db.commit()
    background.add_task(
        send_email,
        settings.support_email,
        "New Catch: new appeal submitted",
        f"A deactivated account ({user.email}) submitted appeal #{appeal.id}. Review it in the admin console.",
    )
    return build_account_status(db, user)