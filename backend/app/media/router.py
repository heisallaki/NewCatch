from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.errors import ApiError
from app.models import Photo, Report, User
from app.profiles.photos import read_file
from app.security import decode_jwt

router = APIRouter(tags=["media"])

HEADERS = {"Cache-Control": "private, max-age=600"}


def image_response(data):
    if data is None:
        raise ApiError(404, "not_found", "Not Found")
    return Response(content=data, media_type="image/jpeg", headers=HEADERS)


@router.get("/media/{photo_id}")
def serve_photo(photo_id: int, t: str = Query(..., max_length=2000), db: Session = Depends(get_db)):
    claims = decode_jwt(t, "media")
    admin_view = False
    if claims is None:
        claims = decode_jwt(t, "admin_media")
        admin_view = claims is not None
    if claims is None or claims["sub"] != str(photo_id):
        raise ApiError(404, "not_found", "Not Found")
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise ApiError(404, "not_found", "Not Found")
    if not admin_view:
        owner = db.get(User, photo.user_id)
        if photo.status != "approved" or owner is None or owner.status != "active":
            raise ApiError(404, "not_found", "Not Found")
    return image_response(read_file(photo.filename))


@router.get("/media/report/{report_id}")
def serve_report_screenshot(report_id: int, t: str = Query(..., max_length=2000), db: Session = Depends(get_db)):
    claims = decode_jwt(t, "report_media")
    if claims is None or claims["sub"] != str(report_id):
        raise ApiError(404, "not_found", "Not Found")
    report = db.get(Report, report_id)
    if report is None or not report.screenshot_filename:
        raise ApiError(404, "not_found", "Not Found")
    return image_response(read_file(report.screenshot_filename, "reports"))