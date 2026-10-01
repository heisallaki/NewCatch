import json
import logging
import re
import urllib.request

from sqlalchemy import delete, select

from app.config import settings
from app.database import SessionLocal
from app.models import PushToken

logger = logging.getLogger("newcatch.push")

TOKEN_PATTERN = re.compile(r"^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{8,80}\]$")


def valid_token(token: str) -> bool:
    return bool(TOKEN_PATTERN.match(token))


def send_push(tokens: list[str], title: str, body: str, data: dict) -> list[str]:
    if not settings.push_enabled or not tokens:
        return []
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "channelId": "messages",
            "priority": "high",
        }
        for token in tokens
    ]
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.expo_access_token:
        headers["Authorization"] = f"Bearer {settings.expo_access_token}"
    request = urllib.request.Request(
        settings.expo_push_url,
        data=json.dumps(messages).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode())
    except Exception:
        logger.exception("Push request failed")
        return []
    tickets = payload.get("data", []) if isinstance(payload, dict) else []
    dead = []
    for token, ticket in zip(tokens, tickets):
        if isinstance(ticket, dict) and ticket.get("status") == "error":
            if (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
                dead.append(token)
            else:
                logger.warning("Push ticket error: %s", ticket.get("message"))
    return dead


def remove_tokens(tokens: list[str]) -> None:
    if not tokens:
        return
    with SessionLocal() as db:
        db.execute(delete(PushToken).where(PushToken.token.in_(tokens)))
        db.commit()


def notify_new_message(recipient_id: int, match_id: int) -> None:
    with SessionLocal() as db:
        tokens = list(db.scalars(select(PushToken.token).where(PushToken.user_id == recipient_id)))
    if not tokens:
        return
    dead = send_push(
        tokens,
        "New message",
        "Open New Catch to read it.",
        {"type": "message", "match_id": match_id},
    )
    remove_tokens(dead)