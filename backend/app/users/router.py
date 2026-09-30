from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.appeals.service import appeal_eligibility, build_account_status, latest_appeal
from app.config import settings
from app.constants import APPEAL_KIND_DEACTIVATION
from app.database import get_db
from app.deps import get_current_user, rate_limit
from app.errors import ApiError
from app.models import Appeal, User
from app.notifications.email import send_email
from app.schemas import AppealPayload
from app.serializers import user_out

router = APIRouter(prefix="/users", tags=["users"])


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
    appeal = Appeal(user_id=user.id, kind=APPEAL_KIND_DEACTIVATION, message=payload.message)
    db.add(appeal)
    db.commit()
    background.add_task(
        send_email,
        settings.support_email,
        "New Catch: new appeal submitted",
        f"A deactivated account ({user.email}) submitted appeal #{appeal.id}. Review it in the admin console.",
    )
    return build_account_status(db, user)