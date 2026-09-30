from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_active_user, rate_limit
from app.discovery.service import can_see, visible_to
from app.errors import ApiError
from app.matching.scoring import score_profiles
from app.models import Match, Profile, Swipe, User
from app.profiles.service import card_out, is_complete

router = APIRouter(prefix="/discovery", tags=["discovery"])


class SwipePayload(BaseModel):
    user_id: int
    action: Literal["catch", "swerve"]


def require_complete_viewer(viewer: User) -> None:
    if viewer.profile is None or not is_complete(viewer):
        raise ApiError(
            403,
            "profile_incomplete",
            "Complete your profile with a photo, interests and what you are looking for to start discovering.",
        )


def load_users(db: Session, ids: list[int]) -> dict[int, User]:
    if not ids:
        return {}
    users = db.scalars(
        select(User).where(User.id.in_(ids)).options(selectinload(User.profile), selectinload(User.photos))
    ).all()
    return {user.id: user for user in users}


@router.get("/cards")
def cards(
    limit: int = Query(10, ge=1, le=20),
    viewer: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    require_complete_viewer(viewer)
    viewer_profile = viewer.profile
    swiped = select(Swipe.to_user_id).where(Swipe.from_user_id == viewer.id)
    stmt = (
        select(User)
        .join(Profile, Profile.user_id == User.id)
        .where(
            User.status == "active",
            User.id != viewer.id,
            User.id.not_in(swiped),
            Profile.visibility != "hidden",
        )
        .options(selectinload(User.profile), selectinload(User.photos))
        .order_by(User.id)
        .limit(400)
    )
    if viewer_profile.discovery_scope == "my_campus":
        stmt = stmt.where(Profile.campus == viewer_profile.campus)
    scored = []
    for candidate in db.scalars(stmt).all():
        if not is_complete(candidate) or not visible_to(viewer_profile, candidate.profile):
            continue
        result = score_profiles(viewer_profile, candidate.profile)
        scored.append((result.score, candidate.id, candidate, result))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [card_out(candidate, result) for _, _, candidate, result in scored[:limit]]


@router.post("/swipe", dependencies=[Depends(rate_limit("swipe", 400, 3600))])
def swipe(payload: SwipePayload, viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    require_complete_viewer(viewer)
    target = db.scalar(
        select(User)
        .where(User.id == payload.user_id)
        .options(selectinload(User.profile), selectinload(User.photos))
    )
    if (
        target is None
        or target.id == viewer.id
        or target.status != "active"
        or target.profile is None
        or not is_complete(target)
        or not can_see(viewer.profile, target.profile)
    ):
        raise ApiError(404, "not_found", "This profile is no longer available.")
    db.add(Swipe(from_user_id=viewer.id, to_user_id=target.id, action=payload.action))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "already_swiped", "You have already responded to this profile.")
    matched = False
    if payload.action == "catch":
        reverse = db.scalar(
            select(Swipe.id).where(
                Swipe.from_user_id == target.id,
                Swipe.to_user_id == viewer.id,
                Swipe.action == "catch",
            )
        )
        if reverse is not None:
            first, second = sorted((viewer.id, target.id))
            db.add(Match(user_a_id=first, user_b_id=second))
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
            matched = True
    person = card_out(target, score_profiles(viewer.profile, target.profile)) if matched else None
    return {"matched": matched, "person": person}


@router.get("/catches")
def catches(viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    matches = db.scalars(
        select(Match)
        .where(or_(Match.user_a_id == viewer.id, Match.user_b_id == viewer.id))
        .order_by(Match.created_at.desc())
    ).all()
    matched = {(m.user_b_id if m.user_a_id == viewer.id else m.user_a_id): m for m in matches}
    caught_ids = db.scalars(
        select(Swipe.to_user_id)
        .where(Swipe.from_user_id == viewer.id, Swipe.action == "catch")
        .order_by(Swipe.created_at.desc())
        .limit(100)
    ).all()
    waiting_ids = [user_id for user_id in caught_ids if user_id not in matched]
    users = load_users(db, list(matched) + waiting_ids)
    viewer_profile = viewer.profile

    def build(user_id: int, allow_hidden: bool):
        user = users.get(user_id)
        if user is None or user.status != "active" or user.profile is None:
            return None
        if not allow_hidden and user.profile.visibility == "hidden":
            return None
        return card_out(user, score_profiles(viewer_profile, user.profile))

    match_rows = []
    for other_id, match in matched.items():
        person = build(other_id, True)
        if person is not None:
            match_rows.append(
                {"match_id": match.id, "matched_at": match.created_at.isoformat(), "person": person}
            )
    waiting_rows = [person for person in (build(user_id, False) for user_id in waiting_ids) if person is not None]
    return {"matches": match_rows, "waiting": waiting_rows}