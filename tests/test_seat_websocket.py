import uuid
import pytest

from httpx import AsyncClient
from src.bootstrap.redis import RedisManager
from src.features.shows.models import ShowDocument
from src.modules.booking.models import BookingDocument, SeatLayoutDocument
from src.modules.booking.schemas import SeatHoldRequest, SeatReleaseRequest
from src.modules.booking.service import BookingService
from src.modules.booking.websocket import SeatConnectionManager, seat_ws_manager


class MockWebSocket:
    def __init__(self):
        self.accepted = False
        self.sent_json_events: list[dict] = []
        self.is_closed = False

    async def accept(self):
        self.accepted = True

    async def send_json(self, data: dict):
        if self.is_closed:
            raise ConnectionResetError("Socket closed")
        self.sent_json_events.append(data)


@pytest.fixture
async def setup_ws_show(client: AsyncClient):
    show_uuid = uuid.uuid4().hex[:8]
    cinema_id = f"cinema_ws_{show_uuid}"
    show = ShowDocument(
        movie_title="WebSocket Test Movie",
        cinema_id=cinema_id,
        screen_number=1,
        start_time="2026-11-14T10:00:00Z",
        end_time="2026-11-14T13:00:00Z",
        base_price=300.0,
        total_seats=120,
        available_seats=120,
    )
    await show.insert()
    show_id = str(show.id)

    yield show_id

    # Teardown
    await BookingDocument.find({"show_id": show_id}).delete()
    await SeatLayoutDocument.find({"cinema_id": cinema_id}).delete()
    await ShowDocument.find({"_id": show.id}).delete()
    if RedisManager.client:
        keys = await RedisManager.client.keys(f"*{show_id}*")
        if keys:
            await RedisManager.client.delete(*keys)


@pytest.mark.asyncio
async def test_websocket_manager_lifecycle():
    mgr = SeatConnectionManager()
    show_id = "test_show_ws_001"
    ws1 = MockWebSocket()
    ws2 = MockWebSocket()

    # 1. Connect two clients
    await mgr.connect(show_id, ws1)
    await mgr.connect(show_id, ws2)

    assert ws1.accepted is True
    assert ws2.accepted is True
    assert len(ws1.sent_json_events) == 1
    assert ws1.sent_json_events[0]["event"] == "STREAM_CONNECTED"

    # 2. Broadcast seat hold
    await mgr.broadcast_seat_update(
        show_id=show_id,
        event_type="SEAT_HELD",
        seats=["A01", "A02"],
        expires_in=600,
    )

    assert len(ws1.sent_json_events) == 2
    assert ws1.sent_json_events[1]["event"] == "SEAT_HELD"
    assert ws1.sent_json_events[1]["seats"] == ["A01", "A02"]

    assert len(ws2.sent_json_events) == 2
    assert ws2.sent_json_events[1]["event"] == "SEAT_HELD"

    # 3. Disconnect ws1
    mgr.disconnect(show_id, ws1)
    assert ws1 not in mgr.active_connections.get(show_id, set())

    # 4. Handle broken connection during broadcast
    ws2.is_closed = True
    await mgr.broadcast_seat_update(
        show_id=show_id,
        event_type="SEAT_RELEASED",
        seats=["A01"],
    )
    # Stale connection should be automatically purged
    assert show_id not in mgr.active_connections or ws2 not in mgr.active_connections[show_id]


@pytest.mark.asyncio
async def test_live_seat_streaming_integration_with_booking_service(client: AsyncClient, setup_ws_show):
    show_id = setup_ws_show
    user_id = f"user_ws_{uuid.uuid4().hex[:6]}"

    mock_client = MockWebSocket()
    await seat_ws_manager.connect(show_id, mock_client)

    try:
        # 1. Hold Seats via BookingService -> must trigger WebSocket broadcast
        hold_res = await BookingService.hold_seats(
            show_id,
            SeatHoldRequest(
                seat_ids=["B05", "B06"],
                idempotency_key=str(uuid.uuid4()),
                user_id=user_id,
            ),
        )

        assert len(mock_client.sent_json_events) >= 2
        hold_event = mock_client.sent_json_events[-1]
        assert hold_event["event"] == "SEAT_HELD"
        assert hold_event["seats"] == ["B05", "B06"]
        assert hold_event["show_id"] == show_id

        # 2. Release Seats via BookingService -> must trigger WebSocket broadcast
        await BookingService.release_seats(
            show_id,
            SeatReleaseRequest(
                hold_id=hold_res.hold_id,
                user_id=user_id,
                seat_ids=["B05", "B06"],
            ),
        )

        assert len(mock_client.sent_json_events) >= 3
        release_event = mock_client.sent_json_events[-1]
        assert release_event["event"] == "SEAT_RELEASED"
        assert release_event["seats"] == ["B05", "B06"]

    finally:
        seat_ws_manager.disconnect(show_id, mock_client)
