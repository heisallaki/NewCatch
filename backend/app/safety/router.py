from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.chat.manager import manager
from app.database import get_db
from app.deps import get_active_user, rate_limit
from app.models import User
from app.safety.service import block_user, list_blocked, unblock_user, unmatch_user

router = APIRouter(prefix="/safety", tags=["safety"])


async def close_chat(match_id: int, first: int, second: int) -> None:
    for user_id in (first, second):
        await manager.send(user_id, {"type": "chat_closed", "match_id": match_id})


@router.post("/block/{user_id}", dependencies=[Depends(rate_limit("block", 60, 3600))])
async def block(user_id: int, viewer: User = Depends(get_active_user)):
    match_id = await run_in_threadpool(block_user, viewer.id, user_id)
    if match_id is not None:
        await close_chat(match_id, viewer.id, user_id)
    return {"ok": True}


@router.post("/unmatch/{user_id}", dependencies=[Depends(rate_limit("unmatch", 60, 3600))])
async def unmatch(user_id: int, viewer: User = Depends(get_active_user)):
    match_id = await run_in_threadpool(unmatch_user, viewer.id, user_id)
    await close_chat(match_id, viewer.id, user_id)
    return {"ok": True}


@router.delete("/block/{user_id}")
def unblock(user_id: int, viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    unblock_user(db, viewer.id, user_id)
    return {"ok": True}


@router.get("/blocks")
def blocks(viewer: User = Depends(get_active_user), db: Session = Depends(get_db)):
    return list_blocked(db, viewer.id)