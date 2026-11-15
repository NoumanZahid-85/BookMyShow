from collections import defaultdict
from fastapi import WebSocket
from src.bootstrap.logger import logger


class SeatConnectionManager:
    def __init__(self):
        # Maps show_id -> set of active WebSockets
        self.active_connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, show_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections[show_id].add(websocket)
        logger.info(
            "WebSocket client connected to seat stream",
            show_id=show_id,
            active_count=len(self.active_connections[show_id]),
        )
        # Send initial confirmation event
        await websocket.send_json({
            "event": "STREAM_CONNECTED",
            "show_id": show_id,
            "message": "Subscribed to live seat updates",
        })

    def disconnect(self, show_id: str, websocket: WebSocket) -> None:
        if show_id in self.active_connections:
            self.active_connections[show_id].discard(websocket)
            if not self.active_connections[show_id]:
                del self.active_connections[show_id]
        logger.info("WebSocket client disconnected from seat stream", show_id=show_id)

    async def broadcast_seat_update(self, show_id: str, event_type: str, seats: list[str], **extra) -> None:
        if show_id not in self.active_connections or not self.active_connections[show_id]:
            return

        payload = {
            "event": event_type,
            "show_id": show_id,
            "seats": seats,
            **extra,
        }

        stale_connections = []
        for connection in list(self.active_connections[show_id]):
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)

        for stale in stale_connections:
            self.disconnect(show_id, stale)


# Global singleton manager
seat_ws_manager = SeatConnectionManager()
