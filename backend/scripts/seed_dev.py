import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.models import PolicyAcceptance, Profile, User
from app.security import hash_password

DEV_PASSWORD = "DevPass#2026"

ACCOUNTS = [
    ("dev.admin@student.jkuat.ac.ke", "Dev Admin", "Admin", "Main Campus", "3rd Year", "BBIT"),
    ("dev.user1@student.jkuat.ac.ke", "Dev User One", "Amani", "Nairobi CBD Campus", "2nd Year", "Computer Science"),
    ("dev.user2@student.jkuat.ac.ke", "Dev User Two", "Zuri", "Karen Campus", "4th Year", "Civil Engineering"),
]


def main() -> None:
    host = make_url(settings.database_url).host
    if settings.app_env != "development" or host not in (None, "localhost", "127.0.0.1"):
        print("Refusing to seed: this script only runs against a local development database.")
        sys.exit(1)

    with SessionLocal() as db:
        for email, full_name, display_name, campus, year, course in ACCOUNTS:
            if db.scalar(select(User.id).where(User.email == email)) is not None:
                print(f"Skipped (already exists): {email}")
                continue
            user = User(email=email, password_hash=hash_password(DEV_PASSWORD))
            user.profile = Profile(
                full_name=full_name,
                display_name=display_name,
                campus=campus,
                year_of_study=year,
                course=course,
            )
            db.add(user)
            db.flush()
            db.add(PolicyAcceptance(user_id=user.id, policy_version=settings.policy_version))
            print(f"Created: {email}")
        db.commit()
    print(f"Local development password for seeded accounts: {DEV_PASSWORD}")


if __name__ == "__main__":
    main()