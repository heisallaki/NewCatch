import re
from dataclasses import dataclass, field
from typing import Optional

from app.models import Profile

COURSE_STOP_WORDS = {
    "bachelor",
    "science",
    "sciences",
    "degree",
    "diploma",
    "technology",
    "studies",
    "honours",
    "applied",
    "with",
    "from",
    "and",
    "the",
}


@dataclass
class MatchResult:
    score: int
    explanation: str
    shared_interests: list = field(default_factory=list)


def normalize(value: str) -> str:
    return " ".join(value.lower().split())


def year_number(label: str) -> Optional[int]:
    found = re.match(r"(\d)", label or "")
    return int(found.group(1)) if found else None


def course_words(course: str) -> set:
    return {
        word
        for word in re.findall(r"[a-z]+", course.lower())
        if len(word) > 3 and word not in COURSE_STOP_WORDS
    }


def plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def score_profiles(viewer: Profile, target: Profile) -> MatchResult:
    viewer_interests = {normalize(item) for item in viewer.interests}
    shared_interests = sorted(item for item in target.interests if normalize(item) in viewer_interests)
    shared_genres = sorted(set(viewer.music_genres) & set(target.music_genres))
    shared_looking = sorted(set(viewer.looking_for) & set(target.looking_for))
    same_campus = viewer.campus == target.campus

    viewer_year = year_number(viewer.year_of_study)
    target_year = year_number(target.year_of_study)
    same_year = viewer_year is not None and viewer_year == target_year
    adjacent_year = viewer_year is not None and target_year is not None and abs(viewer_year - target_year) == 1

    if normalize(viewer.course) == normalize(target.course):
        course_points, course_label = 10, "Same course"
    elif course_words(viewer.course) & course_words(target.course):
        course_points, course_label = 5, "Similar course"
    else:
        course_points, course_label = 0, None

    same_artist = bool(
        viewer.favourite_artist
        and target.favourite_artist
        and normalize(viewer.favourite_artist) == normalize(target.favourite_artist)
    )

    points = 35 * min(1, len(shared_interests) / 4)
    points += 15 * min(1, len(shared_genres) / 3)
    points += 20 if shared_looking else 0
    points += course_points
    points += 10 if same_campus else 0
    points += 5 if same_year else (3 if adjacent_year else 0)
    points += 5 if same_artist else 0

    parts = []
    if shared_interests:
        parts.append(plural(len(shared_interests), "shared interest"))
    if same_campus:
        parts.append("Same campus")
    if shared_genres:
        parts.append(plural(len(shared_genres), "shared music genre"))
    if shared_looking:
        parts.append("Both looking for " + ", ".join(shared_looking[:2]))
    if course_label:
        parts.append(course_label)
    if same_year:
        parts.append("Same year")
    if same_artist:
        parts.append("Same favourite artist")

    return MatchResult(
        score=int(round(min(points, 100))),
        explanation=" · ".join(parts[:4]) or "Someone new to discover",
        shared_interests=shared_interests,
    )