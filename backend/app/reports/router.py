from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import REPORT_REASONS
from app.database import get_db
from app.deps import get_active_user, rate_limit
from app.errors import ApiError
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.constants import REPORT_REASONS
from app.database import get_db
from app.deps import get_active_user, rate_limit
from app.errors import ApiError
from app.models import Report, User
from app.notifications.email import send_email
from app.profiles.photos import ALLOWED_MIME, decode_upload, invalid_image, process_image, save_file
from app.schemas import text

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportPayload(BaseModel):
    reported_user_id: int
    reason: str = Field(max_length=30)
    description: text(10, 1000)
    screenshot: Optional[str] = Field(default=None, max_length=14_000_000)
    screenshot_mime: Optional[str] = Field(default=None, max_length=50)


@router.post("", dependencies=[Depends(rate_limit("report", 10, 3600))])
def create_report(
    payload: ReportPayload,
    background: BackgroundTasks,
    viewer: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    if payload.reason not in REPORT_REASONS:
        raise ApiError(422, "validation_error", "Please choose a report reason.")
    if payload.reported_user_id == viewer.id or db.get(User, payload.reported_user_id) is None:
        raise ApiError(404, "not_found", "This profile is no longer available.")
    filename = None
    if payload.screenshot:
        if payload.screenshot_mime and payload.screenshot_mime.lower() not in ALLOWED_MIME:
            raise invalid_image("Only JPEG, PNG or WebP screenshots are allowed.")
        data, _, _ = process_image(decode_upload(payload.screenshot), max_dimension=1600)
        filename = save_file(data, "reports")
    report = Report(
        reporter_id=viewer.id,
        reported_user_id=payload.reported_user_id,
        reason=payload.reason,
        description=payload.description,
        screenshot_filename=filename,
    )
    db.add(report)
    db.commit()
    background.add_task(
        send_email,
        settings.support_email,
        "New Catch: new user report",
        f"Report #{report.id} ({payload.reason}) was submitted. Review it in the admin console.",
    )
    return {"ok": True, "report_id": report.id}