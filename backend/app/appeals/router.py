from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.appeals.service import appeal_eligibility, build_account_status, latest_appeal
from app.auth.service import consume_otp, issue_otp
from app.config import settings
from app.constants import APPEAL_KIND_BLACKLIST, STATUS_BLACKLISTED
from app.database import get_db
from app.deps import rate_limit
from app.errors import ApiError
from app.models import Appeal, User
from app.notifications.email import send_email, send_otp_email
from app.schemas import EmailPayload, OtpPayload, text
from app.security import create_jwt, decode_jwt

router = APIRouter(prefix="/appeals", tags=["appeals"])

CODE_MESSAGE = "If this email has a blacklisted account, a verification code has been sent."
INVALID_OTP_MESSAGE = "That code is invalid or has expired."


class BlacklistAppealPayload(BaseModel):
    appeal_token: str = Field(max_length=2000)
    message: text(20, 2000)


def blacklisted_user(db: Session, email: str):
    user = db.scalar(select(User).where(User.email == email))
    if user is None or user.status != STATUS_BLACKLISTED:
        return None
    return user


@router.post("/blacklist/request", dependencies=[Depends(rate_limit("bl-appeal-request", 10, 3600))])
def request_code(payload: EmailPayload, background: BackgroundTasks, db: Session = Depends(get_db)):
    if blacklisted_user(db, payload.email) is not None:
        code, _ = issue_otp(db, payload.email, "appeal")
        if code:
            background.add_task(send_otp_email, payload.email, "appeal", code)
    return {"message": CODE_MESSAGE}


@router.post("/blacklist/verify", dependencies=[Depends(rate_limit("bl-appeal-verify", 20, 900))])
def verify_code(payload: OtpPayload, db: Session = Depends(get_db)):
    if not consume_otp(db, payload.email, "appeal", payload.otp):
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    user = blacklisted_user(db, payload.email)
    if user is None:
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    return {
        "appeal_token": create_jwt(payload.email, "blacklist_appeal", 30),
        "status": build_account_status(db, user),
    }


@router.post("/blacklist", dependencies=[Depends(rate_limit("bl-appeal-submit", 10, 3600))])
def submit_appeal(payload: BlacklistAppealPayload, background: BackgroundTasks, db: Session = Depends(get_db)):
    claims = decode_jwt(payload.appeal_token, "blacklist_appeal")
    if claims is None:
        raise ApiError(401, "appeal_expired", "Your verification expired. Please start again.")
    user = blacklisted_user(db, claims["sub"])
    if user is None:
        raise ApiError(409, "appeal_not_allowed", "You can't submit an appeal right now.")
    can_appeal, _ = appeal_eligibility(user, latest_appeal(db, user))
    if not can_appeal:
        raise ApiError(409, "appeal_not_allowed", "You can't submit an appeal right now.")
    appeal = Appeal(user_id=user.id, kind=APPEAL_KIND_BLACKLIST, message=payload.message)
    db.add(appeal)
    db.commit()
    background.add_task(
        send_email,
        settings.support_email,
        "New Catch: new blacklist appeal",
        f"A blacklisted email ({user.email}) submitted appeal #{appeal.id}. Review it in the admin console.",
    )
    return build_account_status(db, user)