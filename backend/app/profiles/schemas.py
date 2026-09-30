from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas import normalize_gender


class ProfileUpdatePayload(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    display_name: str = Field(min_length=2, max_length=40)
    campus: str = Field(max_length=60)
    year_of_study: str = Field(max_length=20)
    gender: str = Field(max_length=20)
    gender_custom: Optional[str] = Field(default=None, max_length=30)
    course: str = Field(min_length=2, max_length=120)
    graduation_year: Optional[int] = Field(default=None, ge=2020, le=2045)
    bio: Optional[str] = Field(default=None, max_length=500)
    interests: list[str] = Field(default_factory=list, max_length=20)
    music_genres: list[str] = Field(default_factory=list, max_length=10)
    favourite_artist: Optional[str] = Field(default=None, max_length=100)
    looking_for: list[str] = Field(default_factory=list, max_length=7)
    visibility: Literal["everyone", "matching", "hidden"]
    discovery_scope: Literal["all", "my_campus"]
    opened_name: Literal["full_name", "display_name"]

    @model_validator(mode="after")
    def gender_rules(self):
        self.gender_custom = normalize_gender(self.gender, self.gender_custom)
        return self


class PhotoUploadPayload(BaseModel):
    image: str = Field(min_length=100)
    mime_type: Optional[str] = Field(default=None, max_length=50)