import argparse
import asyncio
import json
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import websockets
from sqlalchemy import delete, or_, select
from sqlalchemy.engine import make_url

from app.config import settings
from app.database import SessionLocal
from app.models import Block, Match, Message, User
from app.security import create_jwt

DOMAIN = "@students.jkuat.ac.ke"
failures = []


def report(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS  " if ok else "FAIL  ") + name + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(name)


def http(base: str, method: str, path: str, token: str, body=None):
    request = urllib.request.Request(
        base + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Content-Type": "application/json",
            "X-Client-Type": "native",
            "Authorization": f"Bearer {token}",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode() or "null")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode() or "null")


async def connect(ws_base: str, ticket: str, origin=None):
    url = f"{ws_base}/chat/ws?ticket={ticket}"
    headers = {"Origin": origin} if origin else None
    try:
        return await websockets.connect(url, additional_headers=headers)
    except TypeError:
        return await websockets.connect(url, extra_headers=headers)


async def is_refused(ws_base: str, ticket: str, origin=None) -> bool:
    try:
        socket = await connect(ws_base, ticket, origin)
    except Exception:
        return True
    await socket.close()
    return False


async def receive_message(socket, body: str):
    while True:
        event = json.loads(await asyncio.wait_for(socket.recv(), 5))
        if event.get("type") == "message" and event["message"]["body"] == body:
            return event["message"]


async def run(base: str) -> None:
    ws_base = base.replace("http", "ws", 1)
    origin = base
    with SessionLocal() as db:
        first = db.scalar(select(User).where(User.email == f"dev.user1{DOMAIN}"))
        second = db.scalar(select(User).where(User.email == f"dev.user2{DOMAIN}"))
        if first is None or second is None:
            print("Run scripts/seed_dev.py first.")
            sys.exit(1)
        low, high = sorted((first.id, second.id))
        match = db.scalar(select(Match).where(Match.user_a_id == low, Match.user_b_id == high))
        if match is None:
            match = Match(user_a_id=low, user_b_id=high)
            db.add(match)
        db.execute(
            delete(Block).where(
                or_(
                    (Block.blocker_id == first.id) & (Block.blocked_id == second.id),
                    (Block.blocker_id == second.id) & (Block.blocked_id == first.id),
                )
            )
        )
        db.commit()
        match_id, first_id, second_id = match.id, first.id, second.id

    ticket_a = create_jwt(first_id, "ws", 1)
    ticket_b = create_jwt(second_id, "ws", 1)
    access_b = create_jwt(second_id, "access", 5)

    status, _ = http(base, "GET", "/health", access_b)
    report("API reachable", status == 200, base)
    report("WebSocket refuses bad ticket", await is_refused(ws_base, "bad-ticket", origin))
    report("WebSocket refuses foreign origin", await is_refused(ws_base, ticket_a, "http://evil.example"))

    try:
        socket_a = await connect(ws_base, ticket_a, origin)
        socket_b = await connect(ws_base, ticket_b)
    except Exception as error:
        report("WebSocket accepts same-origin and no-origin clients", False, type(error).__name__)
        return
    report("WebSocket accepts same-origin and no-origin clients", True)

    body = f"check-{uuid.uuid4().hex[:8]}"
    await socket_a.send(json.dumps({"type": "message", "match_id": match_id, "body": body}))
    try:
        got_a = await receive_message(socket_a, body)
        got_b = await receive_message(socket_b, body)
        report("WebSocket message delivered to sender and recipient", got_a["id"] == got_b["id"])
    except Exception as error:
        report("WebSocket message delivered to sender and recipient", False, type(error).__name__)

    with SessionLocal() as db:
        stored = db.scalar(select(Message).where(Message.body == body))
    report("WebSocket message persisted", stored is not None)

    rest_body = f"check-{uuid.uuid4().hex[:8]}"
    status, sent = http(base, "POST", f"/chat/{match_id}/messages", access_b, {"body": rest_body})
    report("REST send works", status == 200 and sent and sent["body"] == rest_body, f"status {status}")
    try:
        await receive_message(socket_a, rest_body)
        report("REST message pushed live over WebSocket", True)
    except Exception as error:
        report("REST message pushed live over WebSocket", False, type(error).__name__)
    status, data = http(base, "GET", f"/chat/{match_id}/messages?after_id=0", access_b)
    report("History returns both messages", status == 200 and {m["body"] for m in data["messages"]} >= {body, rest_body})

    await socket_a.close()
    await socket_b.close()
    with SessionLocal() as db:
        db.execute(delete(Message).where(Message.body.like("check-%")))
        db.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8000")
    args = parser.parse_args()
    host = make_url(settings.database_url).host
    if settings.app_env != "development" or host not in (None, "localhost", "127.0.0.1"):
        print("Refusing to run: this check only runs against a local development database.")
        sys.exit(1)
    asyncio.run(run(args.base.rstrip("/")))
    print("\nALL CHECKS PASSED" if not failures else f"\n{len(failures)} CHECK(S) FAILED")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()