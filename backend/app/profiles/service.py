import re

from app.config import settings
from app.errors import ApiError
from app.matching.scoring import MatchResult
from app.models import Photo, User
from app.security import create_jwt

INTEREST_PATTERN = re.compile(r"^\w[\w &'\-\.\+#/]{1,29}$")


def clean_interests(values: list[str]) -> list[str]:
    unique: dict[str, str] = {}
    for raw in values:
        value = " ".join(raw.split())
        if not INTEREST_PATTERN.match(value):
            raise ApiError(422, "validation_error", f"\"{raw[:30]}\" is not a valid interest.")
        unique.setdefault(value.lower(), value)
    return list(unique.values())


def approved_photos(user: User) -> list[Photo]:
    return [photo for photo in user.photos if photo.status == "approved"]


def photo_out(photo: Photo) -> dict:
    token = create_jwt(photo.id, "media", settings.media_token_minutes)
    return {"id": photo.id, "url": f"/media/{photo.id}?t={token}"}


def missing_fields(user: User) -> list[str]:
    missing = []
    if not approved_photos(user):
        missing.append("photo")
    if user.profile is None or not user.profile.interests:
        missing.append("interests")
    if user.profile is None or not user.profile.looking_for:
        missing.append("looking_for")
    return missing


def is_complete(user: User) -> bool:
    return user.profile is not None and not missing_fields(user)


def own_profile_out(user: User) -> dict:
    profile = user.profile
    missing = missing_fields(user)
    return {
        "user_id": user.id,
        "full_name": profile.full_name,
        "display_name": profile.display_name,
        "opened_name": profile.opened_name,
        "campus": profile.campus,
        "year_of_study": profile.year_of_study,
        "course": profile.course,
        "graduation_year": profile.graduation_year,
        "bio": profile.bio,
        "interests": profile.interests,
        "music_genres": profile.music_genres,
        "favourite_artist": profile.favourite_artist,
        "looking_for": profile.looking_for,
        "visibility": profile.visibility,
        "discovery_scope": profile.discovery_scope,
        "photos": [photo_out(photo) for photo in approved_photos(user)],
        "complete": not missing,
        "missing": missing,
    }


def card_out(target: User, result: MatchResult) -> dict:
    profile = target.profile
    photos = approved_photos(target)
    return {
        "user_id": target.id,
        "display_name": profile.display_name,
        "course": profile.course,
        "year_of_study": profile.year_of_study,
        "campus": profile.campus,
        "interests": profile.interests,
        "music_genres": profile.music_genres,
        "looking_for": profile.looking_for,
        "photo": photo_out(photos[0]) if photos else None,
        "match": {
            "score": result.score,
            "explanation": result.explanation,
            "shared_interests": result.shared_interests,
        },
    }


def opened_profile_out(target: User, result: MatchResult, relationship: str) -> dict:
    profile = target.profile
    data = card_out(target, result)
    data.update(
        {
            "name": profile.full_name if profile.opened_name == "full_name" else profile.display_name,
            "bio": profile.bio,
            "favourite_artist": profile.favourite_artist,
            "graduation_year": profile.graduation_year,
            "photos": [photo_out(photo) for photo in approved_photos(target)],
            "relationship": relationship,
        }
    )
    return data