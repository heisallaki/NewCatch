import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import SessionLocal
from app.models import PushToken, User
from app.notifications.push import remove_tokens, send_push


def main() -> None:
    parser = argparse.ArgumentParser(description="Send a generic test push to a user's registered devices.")
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email.strip().lower()))
        if user is None:
            print("No account found for that email.")
            sys.exit(1)
        tokens = list(db.scalars(select(PushToken.token).where(PushToken.user_id == user.id)))
    if not tokens:
        print("No registered devices for that account.")
        sys.exit(1)
    dead = send_push(tokens, "New message", "Open New Catch to read it.", {"type": "test"})
    remove_tokens(dead)
    print(f"Sent to {len(tokens)} device(s). Unregistered devices removed: {len(dead)}")


if __name__ == "__main__":
    main()