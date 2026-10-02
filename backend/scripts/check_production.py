import argparse
import io
import json
import smtplib
import sys
import uuid
from email.message import EmailMessage
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from PIL import Image
from sqlalchemy import create_engine, text

failures = []


def report(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pre-flight checks against the environment file in use.")
    parser.add_argument("--smtp-to", help="Send a real test email to this address")
    args = parser.parse_args()

    try:
        from app.main import validate_production_settings
        from app.config import settings
        from app.database import engine
        from app.storage import storage
    except RuntimeError as error:
        print("FAIL  configuration:", error)
        sys.exit(1)

    if settings.is_production:
        validate_production_settings()
        report("Production settings are safe", True)
    else:
        print("NOTE  APP_ENV is not production, so the production guard was not applied")

    try:
        with engine.connect() as connection:
            name = connection.execute(text("select current_database()")).scalar()
        report("Database reachable (pooled URL)", True, str(name))
    except Exception as error:
        report("Database reachable (pooled URL)", False, type(error).__name__)

    try:
        direct = create_engine(settings.migration_database_url, connect_args={"connect_timeout": 15})
        with direct.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
        config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
        config.set_main_option("script_location", str(Path(__file__).resolve().parent.parent / "migrations"))
        head = ScriptDirectory.from_config(config).get_current_head()
        report("Database migrations at head (direct URL)", current == head, f"current={current} head={head}")
    except Exception as error:
        report("Database migrations at head (direct URL)", False, type(error).__name__)

    try:
        image = Image.new("RGB", (16, 16), (255, 77, 141))
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG")
        data = buffer.getvalue()
        filename = f"{uuid.uuid4().hex}.jpg"
        storage.put("photos", filename, data)
        stored = storage.get("photos", filename)
        storage.delete("photos", filename)
        body = json.dumps({"prefix": "photos", "limit": 100}).encode()
        with storage.call("POST", f"{storage.base}/object/list/{storage.bucket}", body, "application/json") as response:
            objects = json.loads(response.read().decode())
        gone = not any(obj.get("name") == filename for obj in objects)
        report("Storage upload, download and delete", stored == data and gone, settings.storage_backend)
    except Exception as error:
        report("Storage upload, download and delete", False, type(error).__name__)

    if args.smtp_to:
        try:
            message = EmailMessage()
            message["From"] = settings.smtp_from or settings.smtp_username
            message["To"] = args.smtp_to
            message["Subject"] = "New Catch SMTP check"
            message.set_content("If you can read this, New Catch can send email.")
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                server.starttls()
                server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
            report("SMTP test email sent", True, args.smtp_to)
        except Exception as error:
            report("SMTP test email sent", False, type(error).__name__)

    print("\nALL CHECKS PASSED" if not failures else f"\n{len(failures)} CHECK(S) FAILED")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()