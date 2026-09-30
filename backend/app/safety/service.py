from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.errors import ApiError
from app.models import Block, Match, User


def blocked_ids(db: Session, user_id: int) -> set[int]:
    rows = db.execute(
        select(Block.blocker_id, Block.blocked_id).where(
            or_(Block.blocker_id == user_id, Block.blocked_id == user_id)
        )
    ).all()
    return {blocked if blocker == user_id else blocker for blocker, blocked in rows}


def is_blocked_between(db: Session, first: int, second: int) -> bool:
    found = db.scalar(
        select(Block.id)
        .where(
            or_(
                and_(Block.blocker_id == first, Block.blocked_id == second),
                and_(Block.blocker_id == second, Block.blocked_id == first),
            )
        )
        .limit(1)
    )
    return found is not None


def find_match(db: Session, first: int, second: int) -> Optional[Match]:
    low, high = sorted((first, second))
    return db.scalar(select(Match).where(Match.user_a_id == low, Match.user_b_id == high))


def block_user(viewer_id: int, target_id: int) -> Optional[int]:
    if viewer_id == target_id:
        raise ApiError(400, "invalid_target", "You can't block yourself.")
    with SessionLocal() as db:
        if db.get(User, target_id) is None:
            raise ApiError(404, "not_found", "This profile is no longer available.")
        db.add(Block(blocker_id=viewer_id, blocked_id=target_id))
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
        match = find_match(db, viewer_id, target_id)
        match_id = match.id if match else None
        if match is not None:
            db.delete(match)
        db.commit()
        return match_id


def unmatch_user(viewer_id: int, target_id: int) -> int:
    with SessionLocal() as db:
        match = find_match(db, viewer_id, target_id)
        if match is None:
            raise ApiError(404, "not_found", "You are not matched with this person.")
        match_id = match.id
        db.delete(match)
        db.commit()
        return match_id


def unblock_user(db: Session, viewer_id: int, target_id: int) -> None:
    block = db.scalar(select(Block).where(Block.blocker_id == viewer_id, Block.blocked_id == target_id))
    if block is not None:
        db.delete(block)
        db.commit()


def list_blocked(db: Session, viewer_id: int) -> list[dict]:
    blocks = db.scalars(select(Block).where(Block.blocker_id == viewer_id).order_by(Block.created_at.desc())).all()
    ids = [block.blocked_id for block in blocks]
    if not ids:
        return []
    users = {
        user.id: user
        for user in db.scalars(select(User).where(User.id.in_(ids)).options(selectinload(User.profile))).all()
    }
    rows = []
    for block in blocks:
        user = users.get(block.blocked_id)
        name = user.profile.display_name if user and user.profile else "Unavailable user"
        rows.append({"user_id": block.blocked_id, "display_name": name})
    return rows