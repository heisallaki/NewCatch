import re
from typing import Annotated, Literal, Optional, TypeAlias

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

from app.constants import EMAIL_PATTERN, GENDERS

JkuatEmail: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=255, pattern=EMAIL_PATTERN),
]
OtpValue: TypeAlias = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^\d{6}$")]

GENDER_CUSTOM_PATTERN = re.compile(r"^\w[\w \-']{1,29}$")


FullNameText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=100),
]
DisplayNameText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=40),
]
CourseText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=2, max_length=120),
]
AppealMessageText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=20, max_length=2000),
]
ReasonText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=5, max_length=500),
]
AppealResponseText: TypeAlias = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=3, max_length=1000),
]


def check_password_strength(value: str) -> str:
    has_letter = any(char.isalpha() for char in value)
    has_digit = any(char.isdigit() for char in value)
    if len(value) < 10 or not has_letter or not has_digit:
        raise ValueError("Password must be at least 10 characters and include a letter and a number.")
    return value


def normalize_gender(gender: str, custom: Optional[str]) -> Optional[str]:
    if gender not in GENDERS:
        raise ValueError("Select a gender.")
    if gender != "Custom":
        return None
    value = " ".join((custom or "").split())
    if not GENDER_CUSTOM_PATTERN.match(value):
        raise ValueError("Describe your gender in 2 to 30 letters.")
    return value


class EmailPayload(BaseModel):
    email: JkuatEmail


class OtpPayload(BaseModel):
    email: JkuatEmail
    otp: OtpValue


class RegisterCompletePayload(BaseModel):
    registration_token: str = Field(max_length=2000)
    password: str = Field(min_length=10, max_length=128)
    full_name: FullNameText
    display_name: DisplayNameText
    campus: str = Field(max_length=60)
    year_of_study: str = Field(max_length=20)
    gender: str = Field(max_length=20)
    gender_custom: Optional[str] = Field(default=None, max_length=30)
    course: CourseText
    graduation_year: Optional[int] = Field(default=None, ge=2020, le=2045)
    accepted_policy_version: str = Field(max_length=20)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return check_password_strength(value)

    @model_validator(mode="after")
    def gender_rules(self):
        self.gender_custom = normalize_gender(self.gender, self.gender_custom)
        return self


class LoginPayload(BaseModel):
    email: JkuatEmail
    password: str = Field(min_length=1, max_length=128)


class LoginVerifyPayload(BaseModel):
    challenge_token: str = Field(max_length=2000)
    otp: OtpValue


class ResetPayload(BaseModel):
    email: JkuatEmail
    otp: OtpValue
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return check_password_strength(value)


class RefreshPayload(BaseModel):
    refresh_token: Optional[str] = Field(default=None, max_length=200)


class AppealPayload(BaseModel):
    message: AppealMessageText


class ReasonPayload(BaseModel):
    reason: ReasonText


class AppealReviewPayload(BaseModel):
    decision: Literal["accept", "reject"]
    response: AppealResponseText


class ReportResolvePayload(BaseModel):
    action: Literal["dismiss", "reviewed", "deactivate", "blacklist"]
    note: ReasonText