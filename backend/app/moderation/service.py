from typing import Optional

from sqlalchemy.orm import Session

from app.models import ModerationAction, User


def log_action(
    db: Session,
    admin: User,
    target: User,
    action: str,
    reason: Optional[str] = None,
    appeal_id: Optional[int] = None,
) -> None:
    db.add(
        ModerationAction(
            admin_id=admin.id,
            target_user_id=target.id,
            action=action,
            reason=reason,
            appeal_id=appeal_id,
        )
    )