from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_user, get_current_user, rate_limit
from app.errors import ApiError
from app.models import PushToken, User, utcnow
from app.notifications.push import valid_token

router = APIRouter(prefix="/push", tags=["push"])


class PushRegisterPayload(BaseModel):
    token: str = Field(max_length=120)
    platform: Literal["ios", "android"]


class PushUnregisterPayload(BaseModel):
    token: str = Field(max_length=120)


@router.post("/register", dependencies=[Depends(rate_limit("push-register", 30, 3600))])
def register(
    payload: PushRegisterPayload,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    if not valid_token(payload.token):
        raise ApiError(422, "validation_error", "Please check the details you entered.")
    existing = db.scalar(select(PushToken).where(PushToken.token == payload.token))
    if existing is None:
        db.add(PushToken(user_id=user.id, token=payload.token, platform=payload.platform))
    else:
        existing.user_id = user.id
        existing.platform = payload.platform
        existing.last_seen_at = utcnow()
    db.commit()
    return {"ok": True}


@router.post("/unregister")
def unregister(
    payload: PushUnregisterPayload,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(delete(PushToken).where(PushToken.token == payload.token, PushToken.user_id == user.id))
    db.commit()
    return {"ok": True}