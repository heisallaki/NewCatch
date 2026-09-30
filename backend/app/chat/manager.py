from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)

    def add(self, user_id: int, websocket: WebSocket) -> None:
        self.connections[user_id].add(websocket)

    def remove(self, user_id: int, websocket: WebSocket) -> None:
        sockets = self.connections.get(user_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self.connections.pop(user_id, None)

    async def send(self, user_id: int, payload: dict) -> None:
        for websocket in list(self.connections.get(user_id, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                self.remove(user_id, websocket)


manager = ConnectionManager()