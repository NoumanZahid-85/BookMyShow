import json
import uuid
import pytest
from httpx import AsyncClient

from src.features.shows.models import ShowDocument
from src.modules.booking.models import BookingDocument, BookingStatus, SeatLayoutDocument
from src.modules.auth.models import UserRole
from src.modules.ticket.models import TicketDocument
from tests.conftest import auth_headers


@pytest.fixture
async def setup_confirmed_booking():
    show_uuid = uuid.uuid4().hex[:8]
    cinema_id = f"cinema_tkt_{show_uuid}"
    show = ShowDocument(
        movie_title="Ticket Test Movie",
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

    booking_id = f"bkg_tkt_{show_uuid}"
    booking = BookingDocument(
        booking_id=booking_id,
        show_id=show_id,
        user_id="user_ticket_tester",
        seat_ids=["A01", "A02"],
        hold_id=f"hold_{show_uuid}",
        status=BookingStatus.CONFIRMED,
        total_amount=300.0,
        payment_id=f"pay_{show_uuid}",
    )
    await booking.insert()

    yield booking_id, show_id

    # Teardown
    await TicketDocument.find({"booking_id": booking_id}).delete()
    await BookingDocument.find({"booking_id": booking_id}).delete()
    await SeatLayoutDocument.find({"cinema_id": cinema_id}).delete()
    await ShowDocument.find({"_id": show.id}).delete()


@pytest.mark.asyncio
async def test_ticket_generation_and_idempotency(client: AsyncClient, setup_confirmed_booking):
    booking_id, _ = setup_confirmed_booking

    # 1. Generate QR ticket
    gen_res = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_ticket_tester"))
    assert gen_res.status_code == 201
    tkt_data = gen_res.json()
    assert tkt_data["booking_id"] == booking_id
    assert tkt_data["status"] == "ISSUED"
    assert "<svg" in tkt_data["qr_svg"]
    assert "ticket_id" in tkt_data
    ticket_id = tkt_data["ticket_id"]

    # 2. Idempotency check: Calling generate again returns same ticket
    gen2_res = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_ticket_tester"))
    assert gen2_res.status_code == 201
    assert gen2_res.json()["ticket_id"] == ticket_id

    # 3. Fetch ticket by ticket_id
    get_res = await client.get(f"/api/v1/tickets/{ticket_id}")
    assert get_res.status_code == 200
    assert get_res.json()["ticket_id"] == ticket_id


@pytest.mark.asyncio
async def test_gate_scanner_verification_lifecycle(client: AsyncClient, setup_confirmed_booking):
    booking_id, _ = setup_confirmed_booking

    # 1. Generate ticket
    gen_res = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_ticket_tester"))
    qr_payload = gen_res.json()["qr_payload"]

    # 2. Gate scan (Valid First Scan)
    scan1_res = await client.post(
        "/api/v1/tickets/verify",
        headers=await auth_headers("gate_staff_test", UserRole.ADMIN),
        json={"qr_payload": qr_payload, "gate_id": "GATE_A_NORTH"},
    )
    assert scan1_res.status_code == 200
    scan1_data = scan1_res.json()
    assert scan1_data["valid"] is True
    assert "VALID_TICKET" in scan1_data["message"]

    # 3. Second scan attempt (Must be rejected as already used)
    scan2_res = await client.post(
        "/api/v1/tickets/verify",
        headers=await auth_headers("gate_staff_test", UserRole.ADMIN),
        json={"qr_payload": qr_payload, "gate_id": "GATE_B_SOUTH"},
    )
    assert scan2_res.status_code == 200
    scan2_data = scan2_res.json()
    assert scan2_data["valid"] is False
    assert "ALREADY_USED" in scan2_data["message"]


@pytest.mark.asyncio
async def test_gate_scanner_rejects_tampered_qr_code(client: AsyncClient, setup_confirmed_booking):
    booking_id, _ = setup_confirmed_booking

    # 1. Generate legitimate ticket
    gen_res = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_ticket_tester"))
    qr_raw = gen_res.json()["qr_payload"]
    parsed = json.loads(qr_raw)

    # 2. Malicious user tampers with seats in the payload (A01 -> H15 VIP)
    parsed["data"]["seat_ids"] = ["H15"]
    tampered_payload = json.dumps(parsed)

    # 3. Gate scanner verification MUST REJECT due to invalid HMAC signature
    scan_res = await client.post(
        "/api/v1/tickets/verify",
        headers=await auth_headers("gate_staff_test", UserRole.ADMIN),
        json={"qr_payload": tampered_payload, "gate_id": "GATE_MAIN"},
    )
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["valid"] is False
    assert "SECURITY_ALERT" in scan_data["message"]


@pytest.mark.asyncio
async def test_ticket_routes_need_the_right_person(client: AsyncClient, setup_confirmed_booking):
    booking_id, _ = setup_confirmed_booking

    stranger = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_stranger"))
    assert stranger.status_code == 403

    gen_res = await client.post(f"/api/v1/tickets/generate/{booking_id}", headers=await auth_headers("user_ticket_tester"))
    scan = {"qr_payload": gen_res.json()["qr_payload"], "gate_id": "GATE_MAIN"}

    assert (await client.post("/api/v1/tickets/verify", json=scan)).status_code == 401
    customer_scan = await client.post("/api/v1/tickets/verify", headers=await auth_headers("user_ticket_tester"), json=scan)
    assert customer_scan.status_code == 403
