import asyncio
import json
import logging
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload
from starlette.concurrency import run_in_threadpool

from app.chat.manager import manager
from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import get_active_user
from app.errors import ApiError
from app.models import Match, Message, User
from app.notifications.push import notify_new_message
from app.profiles.service import mini_out
from app.safety.service import is_blocked_between
from app.schemas import text
from app.security import create_jwt, decode_jwt, limiter
from app.serializers import iso

logger = logging.getLogger("newcatch.chat")
router = APIRouter(prefix="/chat", tags=["chat"])

MAX_BODY = 1000
background_tasks: set = set()


class SendPayload(BaseModel):
    body: text(1, MAX_BODY)


def spawn(coroutine) -> None:
    task = asyncio.ensure_future(coroutine)
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


def message_out(message: Message) -> dict:
    return {
        "id": message.id,
        "match_id": message.match_id,
        "sender_id": message.sender_id,
        "body": message.body,
        "created_at": iso(message.created_at),
    }


def load_conversations(db: Session, viewer: User) -> list:
    matches = db.scalars(
        select(Match)
        .where(or_(Match.user_a_id == viewer.id, Match.user_b_id == viewer.id))
        .order_by(Match.created_at.desc())
    ).all()
    other_ids = [m.user_b_id if m.user_a_id == viewer.id else m.user_a_id for m in matches]
    if not other_ids:
        return []
    users = {
        user.id: user
        for user in db.scalars(
            select(User)
            .where(User.id.in_(other_ids))
            .options(selectinload(User.profile), selectinload(User.photos))
        ).all()
    }
    pairs = []
    for match, other_id in zip(matches, other_ids):
        other = users.get(other_id)
        if other is not None and other.status == "active" and other.profile is not None:
            pairs.append((match, other))
    return pairs


def origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return True
    if origin in settings.cors_origin_list:
        return True
    host = websocket.headers.get("host", "").lower()
    return bool(host) and urlparse(origin).netloc.lower() == host


def user_is_active(user_id: int) -> bool:
    with SessionLocal() as db:
        user = db.get(User, user_id)
        return user is not None and user.status == "active"


def save_message(user_id: int, match_id: int, body: str) -> dict:
    unavailable = {"error": "unavailable", "detail": "This conversation is no longer available."}
    with SessionLocal() as db:
        match = db.get(Match, match_id)
        if match is None or user_id not in (match.user_a_id, match.user_b_id):
            return unavailable
        other_id = match.user_b_id if match.user_a_id == user_id else match.user_a_id
        me = db.get(User, user_id)
        other = db.get(User, other_id)
        if me is None or other is None or me.status != "active" or other.status != "active":
            return unavailable
        if is_blocked_between(db, user_id, other_id):
            return unavailable
        message = Message(match_id=match_id, sender_id=user_id, body=body)
        db.add(message)
        db.commit()
        result = message_out(message)
        result["recipient_id"] = other_id
        return result


async def deliver(user_id: int, match_id: int, body: str) -> dict:
    result = await run_in_threadpool(save_message, user_id, match_id, body)
    if "error" in result:
        return result
    recipient_id = result.pop("recipient_id")
    payload = {"type": "message", "message": result}
    await manager.send(user_id, payload)
    await manager.send(recipient_id, payload)
    spawn(run_in_threadpool(notify_new_message, recipient_id, match_id))
    return {"message": result}


@router.post("/ticket")
def ticket(viewer: User = Depends(get_active_user)):
    return {"ticket": create_jwt(viewer.id, "ws", 1)}


@router.get("/conversations")
def conversations(viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    rows = []
    for match, other in load_conversations(db, viewer):
        last = db.scalar(
            select(Message).where(Message.match_id == match.id).order_by(Message.id.desc()).limit(1)
        )
        rows.append(
            {
                "match_id": match.id,
                "person": mini_out(other),
                "last_message": None
                if last is None
                else {
                    "body": last.body,
                    "created_at": iso(last.created_at),
                    "mine": last.sender_id == viewer.id,
                },
                "updated_at": iso(last.created_at if last else match.created_at),
            }
        )
    rows.sort(key=lambda row: row["updated_at"], reverse=True)
    return rows


@router.get("/activity")
def activity(viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    items = []
    for match, other in load_conversations(db, viewer)[:20]:
        person = mini_out(other)
        items.append({"type": "match", "at": iso(match.created_at), "match_id": match.id, "person": person})
        incoming = db.scalar(
            select(Message)
            .where(Message.match_id == match.id, Message.sender_id != viewer.id)
            .order_by(Message.id.desc())
            .limit(1)
        )
        if incoming is not None:
            items.append(
                {
                    "type": "message",
                    "at": iso(incoming.created_at),
                    "match_id": match.id,
                    "person": person,
                    "preview": incoming.body[:80],
                }
            )
    items.sort(key=lambda item: item["at"], reverse=True)
    return items[:30]


@router.get("/{match_id}/messages")
def history(
    match_id: int,
    before_id: Optional[int] = Query(None),
    after_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    viewer: User = Depends(get_active_user),
    db: Session = Depends(get_db),
):
    match = db.get(Match, match_id)
    if match is None or viewer.id not in (match.user_a_id, match.user_b_id):
        raise ApiError(404, "not_found", "This conversation is no longer available.")
    other_id = match.user_b_id if match.user_a_id == viewer.id else match.user_a_id
    other = db.scalar(
        select(User).where(User.id == other_id).options(selectinload(User.profile), selectinload(User.photos))
    )
    if other is None or other.status != "active" or other.profile is None:
        raise ApiError(404, "not_found", "This conversation is no longer available.")
    stmt = select(Message).where(Message.match_id == match_id)
    if after_id is not None:
        rows = list(db.scalars(stmt.where(Message.id > after_id).order_by(Message.id.asc()).limit(limit)).all())
    else:
        if before_id is not None:
            stmt = stmt.where(Message.id < before_id)
        rows = list(db.scalars(stmt.order_by(Message.id.desc()).limit(limit)).all())
        rows.reverse()
    return {"other": mini_out(other), "messages": [message_out(row) for row in rows]}


@router.post("/{match_id}/messages")
async def send_message(match_id: int, payload: SendPayload, viewer: User = Depends(get_active_user)):
    if not limiter.check(f"chat:{viewer.id}", 30, 60):
        raise ApiError(429, "rate_limited", "You are sending messages too quickly.")
    result = await deliver(viewer.id, match_id, payload.body)
    if "error" in result:
        raise ApiError(404, result["error"], result["detail"])
    return result["message"]


async def reply_error(websocket: WebSocket, code: str, detail: str) -> None:
    await websocket.send_json({"type": "error", "code": code, "detail": detail})


async def handle_incoming(user_id: int, raw: str, websocket: WebSocket) -> None:
    try:
        data = json.loads(raw)
    except ValueError:
        await reply_error(websocket, "bad_request", "Invalid message.")
        return
    if not isinstance(data, dict):
        return
    kind = data.get("type")
    if kind == "ping":
        await websocket.send_json({"type": "pong"})
        return
    if kind != "message":
        return
    if not limiter.check(f"chat:{user_id}", 30, 60):
        await reply_error(websocket, "rate_limited", "You are sending messages too quickly.")
        return
    match_id = data.get("match_id")
    body = data.get("body")
    if not isinstance(match_id, int) or not isinstance(body, str):
        await reply_error(websocket, "bad_request", "Invalid message.")
        return
    body = body.strip()
    if not body or len(body) > MAX_BODY:
        await reply_error(websocket, "bad_request", "Messages must be 1 to 1000 characters.")
        return
    result = await deliver(user_id, match_id, body)
    if "error" in result:
        await reply_error(websocket, result["error"], result["detail"])


@router.websocket("/ws")
async def chat_socket(websocket: WebSocket, ticket: str = Query(..., max_length=2000)):
    if not origin_allowed(websocket):
        logger.warning("WebSocket refused: origin %r is not allowed", websocket.headers.get("origin"))
        await websocket.close(code=1008)
        return
    claims = decode_jwt(ticket, "ws")
    if claims is None:
        logger.warning("WebSocket refused: invalid or expired ticket")
        await websocket.close(code=1008)
        return
    user_id = int(claims["sub"])
    if not await run_in_threadpool(user_is_active, user_id):
        logger.warning("WebSocket refused: account is not active")
        await websocket.close(code=1008)
        return
    await websocket.accept()
    manager.add(user_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            await handle_incoming(user_id, raw, websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.remove(user_id, websocket)