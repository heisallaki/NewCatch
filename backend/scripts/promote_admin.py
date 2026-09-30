import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.constants import EMAIL_PATTERN, STATUS_ACTIVE
from app.database import SessionLocal
from app.models import ModerationAction, User


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant or revoke the New Catch admin role.")
    parser.add_argument("--email", help="Registered JKUAT student email")
    parser.add_argument("--revoke", action="store_true", help="Remove the admin role instead of granting it")
    parser.add_argument("--yes", action="store_true", help="Skip the confirmation prompt")
    args = parser.parse_args()

    email = (args.email or input("Registered JKUAT email: ")).strip().lower()
    if not re.match(EMAIL_PATTERN, email):
        print("Error: a valid @student.jkuat.ac.ke email is required.")
        sys.exit(1)

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            print("Error: no registered account found for that email.")
            sys.exit(1)
        if not args.revoke and user.status != STATUS_ACTIVE:
            print("Error: only active accounts can be promoted.")
            sys.exit(1)
        verb = "revoke admin from" if args.revoke else "promote to admin"
        if not args.yes and input(f"Type yes to {verb} {email}: ").strip().lower() != "yes":
            print("Cancelled.")
            sys.exit(1)
        user.is_admin = not args.revoke
        db.add(
            ModerationAction(
                admin_id=None,
                target_user_id=user.id,
                action="admin_revoked" if args.revoke else "admin_promoted",
                reason="Changed via server script",
            )
        )
        db.commit()
        print(f"Done: {email} is {'no longer' if args.revoke else 'now'} an admin.")


if __name__ == "__main__":
    main()