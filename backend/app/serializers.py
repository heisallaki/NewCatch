from datetime import datetime
from typing import Optional

from app.models import Appeal, ModerationAction, User


def iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def user_out(user: User) -> dict:
    profile = user.profile
    return {
        "id": user.id,
        "email": user.email,
        "status": user.status,
        "is_admin": bool(user.is_admin and user.status == "active"),
        "profile": None
        if profile is None
        else {
            "full_name": profile.full_name,
            "display_name": profile.display_name,
            "campus": profile.campus,
            "year_of_study": profile.year_of_study,
            "course": profile.course,
            "graduation_year": profile.graduation_year,
        },
    }


def appeal_out(appeal: Appeal) -> dict:
    return {
        "id": appeal.id,
        "status": appeal.status,
        "message": appeal.message,
        "admin_response": appeal.admin_response,
        "created_at": iso(appeal.created_at),
        "reviewed_at": iso(appeal.reviewed_at),
    }


def action_out(action: ModerationAction) -> dict:
    return {
        "id": action.id,
        "action": action.action,
        "reason": action.reason,
        "admin_email": action.admin.email if action.admin else None,
        "appeal_id": action.appeal_id,
        "created_at": iso(action.created_at),
    }