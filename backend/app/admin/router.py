from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session, selectinload

from app.auth.service import revoke_all_sessions
from app.config import settings
from app.constants import (
    APPEAL_ACCEPTED,
    APPEAL_KIND_BLACKLIST,
    APPEAL_PENDING,
    APPEAL_REJECTED,
    REPORT_ACTIONED,
    REPORT_DISMISSED,
    REPORT_OPEN,
    REPORT_REVIEWED,
    STATUS_ACTIVE,
    STATUS_BLACKLISTED,
    STATUS_DEACTIVATED,
)
from app.database import get_db
from app.deps import require_admin
from app.errors import ApiError
from app.models import (
    Appeal,
    BlacklistedEmail,
    ModerationAction,
    Photo,
    Profile,
    Report,
    User,
    utcnow,
)
from app.moderation.service import log_action
from app.notifications.email import send_email
from app.profiles.photos import delete_file
from app.schemas import AppealReviewPayload, ReasonPayload, ReportResolvePayload
from app.security import create_jwt, email_hash
from app.serializers import action_out, appeal_out, iso, user_out

router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)], include_in_schema=False)


def admin_user_row(user: User) -> dict:
    row = user_out(user)
    row["is_admin"] = user.is_admin
    row["created_at"] = iso(user.created_at)
    row["last_login_at"] = iso(user.last_login_at)
    row["deactivated_at"] = iso(user.deactivated_at)
    row["deactivation_reason"] = user.deactivation_reason
    return row


def admin_photo_out(photo: Photo) -> dict:
    token = create_jwt(photo.id, "admin_media", 15)
    return {"id": photo.id, "url": f"/media/{photo.id}?t={token}"}


def moderation_target(db: Session, admin: User, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(404, "not_found", "Not Found")
    if user.id == admin.id or user.is_admin:
        raise ApiError(400, "forbidden_target", "Admin accounts cannot be moderated from here.")
    return user


def apply_deactivation(db: Session, admin: User, user: User, reason: str) -> None:
    if user.status != STATUS_ACTIVE:
        raise ApiError(409, "invalid_state", "Only active accounts can be deactivated.")
    user.status = STATUS_DEACTIVATED
    user.deactivation_reason = reason
    user.deactivated_at = utcnow()
    log_action(db, admin, user, "deactivated", reason)


def apply_blacklist(db: Session, admin: User, user: User, reason: str) -> None:
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(409, "invalid_state", "This account is already blacklisted.")
    digest = email_hash(user.email)
    exists = db.scalar(select(BlacklistedEmail.id).where(BlacklistedEmail.email_hash == digest))
    if exists is None:
        db.add(BlacklistedEmail(email_hash=digest, reason=reason, created_by=admin.id))
    db.execute(
        update(Appeal)
        .where(Appeal.user_id == user.id, Appeal.status == APPEAL_PENDING)
        .values(
            status=APPEAL_REJECTED,
            admin_response="This account has been permanently blacklisted.",
            reviewed_at=utcnow(),
            reviewed_by=admin.id,
        )
    )
    user.status = STATUS_BLACKLISTED
    user.deactivation_reason = None
    revoke_all_sessions(db, user.id)
    log_action(db, admin, user, "blacklisted", reason)


def queue_deactivation_email(background: BackgroundTasks, email: str) -> None:
    background.add_task(
        send_email,
        email,
        "Your New Catch account has been deactivated",
        "An administrator has deactivated your New Catch account. "
        "Sign in to see the reason and submit an appeal.\n\n"
        f"Questions: {settings.support_email}",
    )


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
        "photos": [admin_photo_out(photo) for photo in user.photos],
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
    apply_deactivation(db, admin, user, payload.reason)
    db.commit()
    queue_deactivation_email(background, user.email)
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
    db.execute(
        update(Appeal)
        .where(Appeal.user_id == user.id, Appeal.status == APPEAL_PENDING)
        .values(
            status=APPEAL_ACCEPTED,
            admin_response=payload.reason,
            reviewed_at=utcnow(),
            reviewed_by=admin.id,
        )
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
    apply_blacklist(db, admin, user, payload.reason)
    db.commit()
    return admin_user_row(user)


@router.post("/photos/{photo_id}/remove")
def remove_photo(
    photo_id: int,
    payload: ReasonPayload,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ApiError(404, "not_found", "Not Found")
    owner = db.get(User, photo.user_id)
    filename = photo.filename
    log_action(db, admin, owner, "photo_removed", payload.reason)
    db.delete(photo)
    db.commit()
    delete_file(filename)
    background.add_task(
        send_email,
        owner.email,
        "A photo was removed from your New Catch profile",
        f"A moderator removed one of your photos.\n\nReason: {payload.reason}\n\n"
        f"Questions or appeals: {settings.support_email}",
    )
    return {"ok": True}


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
    rows = []
    for appeal in db.scalars(stmt).all():
        blacklist_reason: Optional[str] = None
        if appeal.kind == APPEAL_KIND_BLACKLIST:
            blacklist_reason = db.scalar(
                select(BlacklistedEmail.reason).where(BlacklistedEmail.email_hash == email_hash(appeal.user.email))
            )
        rows.append({**appeal_out(appeal), "user": admin_user_row(appeal.user), "blacklist_reason": blacklist_reason})
    return rows


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
    if accepted:
        if user.status == STATUS_DEACTIVATED:
            user.status = STATUS_ACTIVE
            user.deactivation_reason = None
            user.deactivated_at = None
        elif user.status == STATUS_BLACKLISTED:
            db.execute(delete(BlacklistedEmail).where(BlacklistedEmail.email_hash == email_hash(user.email)))
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
    outcome = (
        "accepted and your account is active again, so you can sign in"
        if accepted
        else "reviewed and the decision stands"
    )
    background.add_task(
        send_email,
        user.email,
        "Your New Catch appeal has been reviewed",
        f"Your appeal was {outcome}.\n\nMessage from the moderation team:\n{payload.response}\n\n"
        f"Questions: {settings.support_email}",
    )
    return {**appeal_out(appeal), "user": admin_user_row(user), "blacklist_reason": None}


def report_out(report: Report) -> dict:
    screenshot_url = None
    if report.screenshot_filename:
        token = create_jwt(report.id, "report_media", 15)
        screenshot_url = f"/media/report/{report.id}?t={token}"
    return {
        "id": report.id,
        "reason": report.reason,
        "description": report.description,
        "status": report.status,
        "admin_note": report.admin_note,
        "created_at": iso(report.created_at),
        "reviewed_at": iso(report.reviewed_at),
        "screenshot_url": screenshot_url,
        "reporter_email": report.reporter.email,
        "reported": admin_user_row(report.reported),
    }


@router.get("/reports")
def list_reports(
    status: str = Query("open", pattern="^(open|all)$"),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Report)
        .options(selectinload(Report.reporter), selectinload(Report.reported).selectinload(User.profile))
        .order_by(Report.created_at.desc())
        .limit(100)
    )
    if status == "open":
        stmt = stmt.where(Report.status == REPORT_OPEN)
    return [report_out(report) for report in db.scalars(stmt).all()]


@router.post("/reports/{report_id}/resolve")
def resolve_report(
    report_id: int,
    payload: ReportResolvePayload,
    background: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    report = db.scalar(
        select(Report)
        .where(Report.id == report_id)
        .options(selectinload(Report.reporter), selectinload(Report.reported).selectinload(User.profile))
    )
    if report is None:
        raise ApiError(404, "not_found", "Not Found")
    if report.status != REPORT_OPEN:
        raise ApiError(409, "invalid_state", "This report has already been resolved.")
    reported = report.reported
    if payload.action == "deactivate":
        apply_deactivation(db, admin, moderation_target(db, admin, reported.id), payload.note)
    elif payload.action == "blacklist":
        apply_blacklist(db, admin, moderation_target(db, admin, reported.id), payload.note)
    status = {
        "dismiss": REPORT_DISMISSED,
        "reviewed": REPORT_REVIEWED,
        "deactivate": REPORT_ACTIONED,
        "blacklist": REPORT_ACTIONED,
    }[payload.action]
    report.status = status
    report.admin_note = payload.note
    report.reviewed_at = utcnow()
    report.reviewed_by = admin.id
    log_action(db, admin, reported, f"report_{status}", payload.note)
    db.commit()
    if payload.action == "deactivate":
        queue_deactivation_email(background, reported.email)
    return report_out(report)