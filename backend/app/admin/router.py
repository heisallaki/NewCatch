from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.auth.service import revoke_all_sessions
from app.constants import (
    APPEAL_ACCEPTED,
    APPEAL_PENDING,
    APPEAL_REJECTED,
    STATUS_ACTIVE,
    STATUS_BLACKLISTED,
    STATUS_DEACTIVATED,
)
from app.database import get_db
from app.deps import require_admin
from app.errors import ApiError
from app.models import Appeal, BlacklistedEmail, ModerationAction, Profile, User, utcnow
from app.moderation.service import log_action
from app.notifications.email import send_email
from app.schemas import AppealReviewPayload, ReasonPayload
from app.security import email_hash
from app.serializers import action_out, appeal_out, iso, user_out
from app.config import settings

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], include_in_schema=False)


def admin_user_row(user: User) -> dict:
    row = user_out(user)
    row["is_admin"] = user.is_admin
    row["created_at"] = iso(user.created_at)
    row["last_login_at"] = iso(user.last_login_at)
    row["deactivated_at"] = iso(user.deactivated_at)
    row["deactivation_reason"] = user.deactivation_reason
    return row


def moderation_target(db: Session, admin: User, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(404, "not_found", "Not Found")
    if user.id == admin.id or user.is_admin:
        raise ApiError(400, "forbidden_target", "Admin accounts cannot be moderated from here.")
    return user


@router.get("/me")
def admin_me(admin: User = Depends(require_admin)):
    return {"is_admin": True, "email": admin.email}


@router.get("/users")
def list_users(
    q: str = "",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(User).outerjoin(Profile, Profile.user_id == User.id).options(selectinload(User.profile))
    term = q.strip()
    if term:
        pattern = f"%{term}%"
        stmt = stmt.where(
            or_(User.email.ilike(pattern), Profile.display_name.ilike(pattern), Profile.full_name.ilike(pattern))
        )
    users = db.scalars(stmt.order_by(User.id.desc()).limit(limit).offset(offset)).all()
    return [admin_user_row(user) for user in users]


@router.get("/users/{user_id}")
def user_detail(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(404, "not_found", "Not Found")
    actions = db.scalars(
        select(ModerationAction)
        .where(ModerationAction.target_user_id == user_id)
        .options(selectinload(ModerationAction.admin))
        .order_by(ModerationAction.created_at.desc())
        .limit(50)
    ).all()
    appeals = db.scalars(
        select(Appeal).where(Appeal.user_id == user_id).order_by(Appeal.created_at.desc()).limit(20)
    ).all()
    return {
        "user": admin_user_row(user),
        "actions": [action_out(action) for action in actions],
        "appeals": [appeal_out(appeal) for appeal in appeals],
    }


@router.post("/users/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    payload: ReasonPayload,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = moderation_target(db, admin, user_id)
    if user.status != STATUS_ACTIVE:
        raise ApiError(409, "invalid_state", "Only active accounts can be deactivated.")
    user.status = STATUS_DEACTIVATED
    user.deactivation_reason = payload.reason
    user.deactivated_at = utcnow()
    log_action(db, admin, user, "deactivated", payload.reason)
    db.commit()
    background.add_task(
        send_email,
        user.email,
        "Your New Catch account has been deactivated",
        "An administrator has deactivated your New Catch account. "
        "Sign in to see the reason and submit an appeal.\n\n"
        f"Questions: {settings.support_email}",
    )
    return admin_user_row(user)


@router.post("/users/{user_id}/reactivate")
def reactivate_user(
    user_id: int,
    payload: ReasonPayload,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = moderation_target(db, admin, user_id)
    if user.status != STATUS_DEACTIVATED:
        raise ApiError(409, "invalid_state", "Only deactivated accounts can be reactivated.")
    now = utcnow()
    db.execute(
        update(Appeal)
        .where(Appeal.user_id == user.id, Appeal.status == APPEAL_PENDING)
        .values(status=APPEAL_ACCEPTED, admin_response=payload.reason, reviewed_at=now, reviewed_by=admin.id)
    )
    user.status = STATUS_ACTIVE
    user.deactivation_reason = None
    user.deactivated_at = None
    log_action(db, admin, user, "reactivated", payload.reason)
    db.commit()
    background.add_task(
        send_email,
        user.email,
        "Your New Catch account has been reactivated",
        "Your New Catch account is active again. You can sign in as usual.\n\n"
        f"Questions: {settings.support_email}",
    )
    return admin_user_row(user)


@router.post("/users/{user_id}/blacklist")
def blacklist_user(
    user_id: int,
    payload: ReasonPayload,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = moderation_target(db, admin, user_id)
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(409, "invalid_state", "This account is already blacklisted.")
    digest = email_hash(user.email)
    exists = db.scalar(select(BlacklistedEmail.id).where(BlacklistedEmail.email_hash == digest))
    if exists is None:
        db.add(BlacklistedEmail(email_hash=digest, reason=payload.reason, created_by=admin.id))
    now = utcnow()
    db.execute(
        update(Appeal)
        .where(Appeal.user_id == user.id, Appeal.status == APPEAL_PENDING)
        .values(
            status=APPEAL_REJECTED,
            admin_response="This account has been permanently blacklisted.",
            reviewed_at=now,
            reviewed_by=admin.id,
        )
    )
    user.status = STATUS_BLACKLISTED
    user.deactivation_reason = None
    revoke_all_sessions(db, user.id)
    log_action(db, admin, user, "blacklisted", payload.reason)
    db.commit()
    return admin_user_row(user)


@router.get("/appeals")
def list_appeals(
    status: str = Query("pending", pattern="^(pending|all)$"),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Appeal)
        .options(selectinload(Appeal.user).selectinload(User.profile))
        .order_by(Appeal.created_at.desc())
        .limit(100)
    )
    if status == "pending":
        stmt = stmt.where(Appeal.status == APPEAL_PENDING)
    return [{**appeal_out(appeal), "user": admin_user_row(appeal.user)} for appeal in db.scalars(stmt).all()]


@router.post("/appeals/{appeal_id}/review")
def review_appeal(
    appeal_id: int,
    payload: AppealReviewPayload,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    appeal = db.get(Appeal, appeal_id)
    if appeal is None:
        raise ApiError(404, "not_found", "Not Found")
    if appeal.status != APPEAL_PENDING:
        raise ApiError(409, "invalid_state", "This appeal has already been reviewed.")
    user = appeal.user
    accepted = payload.decision == "accept"
    appeal.status = APPEAL_ACCEPTED if accepted else APPEAL_REJECTED
    appeal.admin_response = payload.response
    appeal.reviewed_at = utcnow()
    appeal.reviewed_by = admin.id
    if accepted and user.status == STATUS_DEACTIVATED:
        user.status = STATUS_ACTIVE
        user.deactivation_reason = None
        user.deactivated_at = None
    log_action(
        db,
        admin,
        user,
        "appeal_accepted" if accepted else "appeal_rejected",
        payload.response,
        appeal.id,
    )
    db.commit()
    outcome = "accepted and your account is active again" if accepted else "reviewed and your account remains deactivated"
    background.add_task(
        send_email,
        user.email,
        "Your New Catch appeal has been reviewed",
        f"Your appeal was {outcome}.\n\nMessage from the moderation team:\n{payload.response}\n\n"
        f"Questions: {settings.support_email}",
    )
    return {**appeal_out(appeal), "user": admin_user_row(user)}