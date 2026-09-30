from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.constants import CAMPUSES, LOOKING_FOR, MUSIC_GENRES, YEARS
from app.database import get_db
from app.deps import get_active_user, rate_limit
from app.discovery.service import can_see
from app.errors import ApiError
from app.matching.scoring import score_profiles
from app.models import Photo, Swipe, User
from app.profiles.photos import (
    ALLOWED_MIME,
    decode_upload,
    delete_file,
    invalid_image,
    process_image,
    save_file,
)
from app.profiles.schemas import PhotoUploadPayload, ProfileUpdatePayload
from app.profiles.service import (
    approved_photos,
    clean_interests,
    is_complete,
    opened_profile_out,
    own_profile_out,
)
from app.safety.service import find_match, is_blocked_between

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/me")
def get_my_profile(user: User = Depends(get_active_user)):
    return own_profile_out(user)


@router.put("/me", dependencies=[Depends(rate_limit("profile-save", 60, 3600))])
def update_my_profile(
    payload: ProfileUpdatePayload,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    if payload.campus not in CAMPUSES or payload.year_of_study not in YEARS:
        raise ApiError(422, "validation_error", "Please check the details you entered.")
    if any(genre not in MUSIC_GENRES for genre in payload.music_genres):
        raise ApiError(422, "validation_error", "Please check the details you entered.")
    if any(option not in LOOKING_FOR for option in payload.looking_for):
        raise ApiError(422, "validation_error", "Please check the details you entered.")
    profile = user.profile
    profile.full_name = payload.full_name
    profile.display_name = payload.display_name
    profile.campus = payload.campus
    profile.year_of_study = payload.year_of_study
    profile.gender = payload.gender
    profile.gender_custom = payload.gender_custom
    profile.course = payload.course
    profile.graduation_year = payload.graduation_year
    profile.bio = payload.bio.strip() if payload.bio and payload.bio.strip() else None
    profile.interests = clean_interests(payload.interests)
    profile.music_genres = list(dict.fromkeys(payload.music_genres))
    profile.favourite_artist = (payload.favourite_artist or "").strip() or None
    profile.looking_for = list(dict.fromkeys(payload.looking_for))
    profile.visibility = payload.visibility
    profile.discovery_scope = payload.discovery_scope
    profile.opened_name = payload.opened_name
    db.commit()
    return own_profile_out(user)


@router.post("/me/photos", dependencies=[Depends(rate_limit("photo-upload", 30, 3600))])
def upload_photo(
    payload: PhotoUploadPayload,
    user: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    if payload.mime_type and payload.mime_type.lower() not in ALLOWED_MIME:
        raise invalid_image("Only JPEG, PNG or WebP photos are allowed.")
    if len(approved_photos(user)) >= settings.max_photos:
        raise ApiError(409, "photo_limit", f"You can upload up to {settings.max_photos} photos.")
    raw = decode_upload(payload.image)
    data, width, height = process_image(raw)
    filename = save_file(data)
    position = max((photo.position for photo in user.photos), default=-1) + 1
    user.photos.append(Photo(filename=filename, position=position, width=width, height=height))
    try:
        db.commit()
    except Exception:
        db.rollback()
        delete_file(filename)
        raise
    return own_profile_out(user)


@router.delete("/me/photos/{photo_id}")
def delete_photo(photo_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    photo = next((item for item in user.photos if item.id == photo_id), None)
    if photo is None:
        raise ApiError(404, "not_found", "Photo not found.")
    filename = photo.filename
    db.delete(photo)
    db.commit()
    delete_file(filename)
    db.expire(user, ["photos"])
    return own_profile_out(user)


@router.post("/me/photos/{photo_id}/primary")
def make_primary_photo(photo_id: int, user: User = Depends(get_active_user), db: Session = Depends(get_db)):
    photos = approved_photos(user)
    chosen = next((item for item in photos if item.id == photo_id), None)
    if chosen is None:
        raise ApiError(404, "not_found", "Photo not found.")
    ordered = [chosen] + [item for item in photos if item.id != photo_id]
    for index, item in enumerate(ordered):
        item.position = index
    db.commit()
    db.expire(user, ["photos"])
    return own_profile_out(user)


@router.get("/{user_id}")
def open_profile(user_id: int, viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    target = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.profile), selectinload(User.photos))
    )
    if target is None or target.status != "active" or target.profile is None:
        raise ApiError(404, "not_found", "This profile is no longer available.")
    if target.id == viewer.id:
        return opened_profile_out(target, score_profiles(viewer.profile, target.profile), "self")
    if is_blocked_between(db, viewer.id, target.id):
        raise ApiError(404, "not_found", "This profile is no longer available.")
    match = find_match(db, viewer.id, target.id)
    swipe_action = db.scalar(
        select(Swipe.action).where(Swipe.from_user_id == viewer.id, Swipe.to_user_id == target.id)
    )
    if match is not None:
        relationship = "matched"
    elif swipe_action == "catch":
        relationship = "caught"
    elif swipe_action == "swerve":
        relationship = "swerved"
    else:
        relationship = "none"
    if match is None and not (is_complete(target) and can_see(viewer.profile, target.profile)):
        raise ApiError(404, "not_found", "This profile is no longer available.")
    return opened_profile_out(
        target,
        score_profiles(viewer.profile, target.profile),
        relationship,
        match.id if match else None,
    )