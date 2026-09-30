from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.service import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    consume_otp,
    is_blacklisted,
    is_native,
    issue_otp,
    revoke_all_sessions,
    start_session,
)
from app.config import settings
from app.constants import CAMPUSES, STATUS_BLACKLISTED, YEARS
from app.database import get_db
from app.deps import enforce_csrf, rate_limit
from app.errors import ApiError
from app.models import PolicyAcceptance, Profile, RefreshToken, User, utcnow
from app.notifications.email import send_account_exists_email, send_otp_email
from app.schemas import (
    EmailPayload,
    LoginPayload,
    LoginVerifyPayload,
    OtpPayload,
    RefreshPayload,
    RegisterCompletePayload,
    ResetPayload,
)
from app.security import (
    DUMMY_HASH,
    create_jwt,
    decode_jwt,
    hash_password,
    hash_token,
    limiter,
    verify_password,
)
from app.serializers import user_out
from sqlalchemy import update

router = APIRouter(prefix="/auth", tags=["auth"])

GENERIC_CODE_MESSAGE = (
    "If this email is eligible, a verification code has been sent. You can request a new code once a minute."
)
INVALID_OTP_MESSAGE = "That code is invalid or has expired."
BLACKLIST_MESSAGE = (
    "This email has been blacklisted from New Catch. "
    f"If you believe this is a mistake, use the Appeal option or contact {settings.support_email}."
)


@router.post("/register/request", dependencies=[Depends(rate_limit("register-request", 10, 3600))])
def register_request(payload: EmailPayload, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = payload.email
    if is_blacklisted(db, email):
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        background.add_task(send_account_exists_email, email)
    else:
        code, _ = issue_otp(db, email, "register")
        if code:
            background.add_task(send_otp_email, email, "register", code)
    return {"message": GENERIC_CODE_MESSAGE}


@router.post("/register/verify", dependencies=[Depends(rate_limit("register-verify", 20, 900))])
def register_verify(payload: OtpPayload, db: Session = Depends(get_db)):
    if is_blacklisted(db, payload.email):
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    if not consume_otp(db, payload.email, "register", payload.otp):
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    return {"registration_token": create_jwt(payload.email, "register", 30)}


@router.post("/register/complete", dependencies=[Depends(rate_limit("register-complete", 20, 900))])
def register_complete(
    payload: RegisterCompletePayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    claims = decode_jwt(payload.registration_token, "register")
    if claims is None:
        raise ApiError(401, "registration_expired", "Your verification expired. Please start again.")
    email = claims["sub"]
    if payload.campus not in CAMPUSES or payload.year_of_study not in YEARS:
        raise ApiError(422, "validation_error", "Please check the details you entered.")
    if payload.accepted_policy_version != settings.policy_version:
        raise ApiError(400, "policy_outdated", "Please review and accept the latest policies.")
    if is_blacklisted(db, email):
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ApiError(409, "account_exists", "An account already exists. Please log in instead.")
    user = User(email=email, password_hash=hash_password(payload.password))
    user.profile = Profile(
        full_name=payload.full_name,
        display_name=payload.display_name,
        campus=payload.campus,
        year_of_study=payload.year_of_study,
        course=payload.course,
        graduation_year=payload.graduation_year,
    )
    db.add(user)
    try:
        db.flush()
        db.add(PolicyAcceptance(user_id=user.id, policy_version=payload.accepted_policy_version))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "account_exists", "An account already exists. Please log in instead.")
    tokens = start_session(db, user, request, response)
    return {"user": user_out(user), "tokens": tokens}


@router.post("/login", dependencies=[Depends(rate_limit("login", 20, 900))])
def login(payload: LoginPayload, background: BackgroundTasks, db: Session = Depends(get_db)):
    if not limiter.check(f"login-email:{payload.email}", 8, 900):
        raise ApiError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.")
    user = db.scalar(select(User).where(User.email == payload.email))
    password_ok = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if user is None or not password_ok:
        raise ApiError(401, "invalid_credentials", "Invalid email or password.")
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    code, reason = issue_otp(db, payload.email, "login")
    if reason == "limit":
        raise ApiError(429, "rate_limited", "Too many codes requested. Please try again later.")
    if code:
        background.add_task(send_otp_email, payload.email, "login", code)
    return {
        "challenge_token": create_jwt(payload.email, "login_challenge", 10),
        "message": "We sent a verification code to your JKUAT email.",
    }


@router.post("/login/verify", dependencies=[Depends(rate_limit("login-verify", 20, 900))])
def login_verify(
    payload: LoginVerifyPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    challenge = decode_jwt(payload.challenge_token, "login_challenge")
    if challenge is None:
        raise ApiError(401, "challenge_expired", "Your sign-in session expired. Please start again.")
    email = challenge["sub"]
    if not consume_otp(db, email, "login", payload.otp):
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise ApiError(401, "invalid_credentials", "Invalid email or password.")
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    tokens = start_session(db, user, request, response)
    return {"user": user_out(user), "tokens": tokens}


@router.post("/password/forgot", dependencies=[Depends(rate_limit("forgot", 10, 3600))])
def forgot_password(payload: EmailPayload, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None and user.status != STATUS_BLACKLISTED:
        code, _ = issue_otp(db, payload.email, "reset")
        if code:
            background.add_task(send_otp_email, payload.email, "reset", code)
    return {"message": GENERIC_CODE_MESSAGE}


@router.post("/password/reset", dependencies=[Depends(rate_limit("reset", 20, 900))])
def reset_password(
    payload: ResetPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    if not consume_otp(db, payload.email, "reset", payload.otp):
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        raise ApiError(400, "invalid_otp", INVALID_OTP_MESSAGE)
    if user.status == STATUS_BLACKLISTED:
        raise ApiError(403, "email_blacklisted", BLACKLIST_MESSAGE)
    user.password_hash = hash_password(payload.new_password)
    revoke_all_sessions(db, user.id)
    db.commit()
    tokens = start_session(db, user, request, response)
    return {"user": user_out(user), "tokens": tokens}


@router.post("/refresh", dependencies=[Depends(rate_limit("refresh", 60, 300))])
def refresh(
    payload: RefreshPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    native = is_native(request)
    if native:
        token = payload.refresh_token
    else:
        enforce_csrf(request)
        token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise ApiError(401, "unauthorized", "Please sign in again.")
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(token)))
    now = utcnow()
    if record is None or record.expires_at <= now:
        raise ApiError(401, "unauthorized", "Please sign in again.")
    if record.revoked_at is not None:
        revoke_all_sessions(db, record.user_id)
        db.commit()
        raise ApiError(401, "unauthorized", "Please sign in again.")
    record.revoked_at = now
    db.commit()
    user = db.get(User, record.user_id)
    if user is None or user.status == STATUS_BLACKLISTED:
        raise ApiError(401, "unauthorized", "Please sign in again.")
    tokens = start_session(db, user, request, response, touch_login=False)
    return {"tokens": tokens}


@router.post("/logout")
def logout(
    payload: RefreshPayload,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = payload.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if token:
        db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == hash_token(token), RefreshToken.revoked_at.is_(None))
            .values(revoked_at=utcnow())
        )
        db.commit()
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/auth")
    return {"ok": True}