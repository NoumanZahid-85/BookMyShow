import uuid
import pytest
from httpx import AsyncClient

from src.bootstrap.redis import RedisManager
from src.features.shows.models import ShowDocument
from src.modules.booking.models import BookingDocument, SeatLayoutDocument
from src.modules.payment.models import PaymentDocument
from tests.conftest import auth_headers


@pytest.fixture
async def setup_show():
    show_uuid = uuid.uuid4().hex[:8]
    cinema_id = f"cinema_pay_{show_uuid}"
    show = ShowDocument(
        movie_title="Payment Test Movie",
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
    await PaymentDocument.find({"show_id": show_id}).delete()
    await SeatLayoutDocument.find({"cinema_id": cinema_id}).delete()
    await ShowDocument.find({"_id": show.id}).delete()
    if RedisManager.client:
        keys = await RedisManager.client.keys(f"*{show_id}*")
        if keys:
            await RedisManager.client.delete(*keys)


@pytest.mark.asyncio
async def test_payment_session_creation(client: AsyncClient, setup_show):
    show_id = setup_show
    user_id = f"user_{uuid.uuid4().hex[:6]}"

    # 1. Hold seat A01
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers(user_id),
        json={
            "seat_ids": ["A01"],
            "idempotency_key": str(uuid.uuid4()),
            "user_id": user_id,
        },
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    # 2. Create payment session
    pay_res = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers(user_id),
        json={
            "hold_id": hold_id,
            "show_id": show_id,
            "user_id": user_id,
        },
    )
    assert pay_res.status_code == 201
    pay_data = pay_res.json()
    assert pay_data["hold_id"] == hold_id
    assert pay_data["amount"] == 300.0  # Silver row A sells at the show base price
    assert pay_data["status"] == "PENDING"
    assert "payment_id" in pay_data


@pytest.mark.asyncio
async def test_payment_session_for_expired_hold_rejected(client: AsyncClient, setup_show):
    show_id = setup_show
    pay_res = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers("test_user"),
        json={
            "hold_id": f"expired_hold_{uuid.uuid4().hex[:6]}",
            "show_id": show_id,
            "user_id": "test_user",
        },
    )
    assert pay_res.status_code == 410


@pytest.mark.asyncio
async def test_payment_success_reconciliation_and_my_bookings(client: AsyncClient, setup_show):
    show_id = setup_show
    user_id = f"user_{uuid.uuid4().hex[:6]}"

    # 1. Hold seats B01, B02
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers(user_id),
        json={
            "seat_ids": ["B01", "B02"],
            "idempotency_key": str(uuid.uuid4()),
            "user_id": user_id,
        },
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    # 2. Create payment session
    pay_res = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers(user_id),
        json={
            "hold_id": hold_id,
            "show_id": show_id,
            "user_id": user_id,
        },
    )
    payment_id = pay_res.json()["payment_id"]

    # 3. Simulate successful payment
    sim_res = await client.post(
        f"/api/v1/payments/{payment_id}/simulate",
        json={"success": True},
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["status"] == "SUCCESS"
    assert sim_data["booking_id"] is not None
    booking_id = sim_data["booking_id"]

    # 4. Check user's booking history
    hist_res = await client.get(
        "/api/v1/bookings/user/my-bookings",
        headers=await auth_headers(user_id),
    )
    assert hist_res.status_code == 200
    bookings = hist_res.json()["data"]
    assert len(bookings) == 1
    assert bookings[0]["booking_id"] == booking_id
    assert bookings[0]["seat_ids"] == ["B01", "B02"]

    # 5. Idempotent check: re-simulating returns same booking
    sim2_res = await client.post(
        f"/api/v1/payments/{payment_id}/simulate",
        json={"success": True},
    )
    assert sim2_res.status_code == 200
    assert sim2_res.json()["booking_id"] == booking_id


@pytest.mark.asyncio
async def test_payment_failure_auto_releases_seats(client: AsyncClient, setup_show):
    show_id = setup_show
    user_a = f"user_a_{uuid.uuid4().hex[:6]}"
    user_b = f"user_b_{uuid.uuid4().hex[:6]}"

    # 1. User A holds seat C01
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers(user_a),
        json={
            "seat_ids": ["C01"],
            "idempotency_key": str(uuid.uuid4()),
            "user_id": user_a,
        },
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    # 2. Create payment session
    pay_res = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers(user_a),
        json={
            "hold_id": hold_id,
            "show_id": show_id,
            "user_id": user_a,
        },
    )
    payment_id = pay_res.json()["payment_id"]

    # 3. Simulate card decline
    fail_res = await client.post(
        f"/api/v1/payments/{payment_id}/simulate",
        json={"success": False, "failure_reason": "Insufficient funds in bank"},
    )
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["status"] == "FAILED"
    assert fail_data["failure_reason"] == "Insufficient funds in bank"

    # 4. User B immediately attempts to hold seat C01 -> MUST SUCCEED because C01 was auto-released!
    hold_b_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers(user_b),
        json={
            "seat_ids": ["C01"],
            "idempotency_key": str(uuid.uuid4()),
            "user_id": user_b,
        },
    )
    assert hold_b_res.status_code == 200
    assert hold_b_res.json()["data"]["seats"] == ["C01"]


@pytest.mark.asyncio
async def test_stripe_webhook_reconciliation(client: AsyncClient, setup_show):
    show_id = setup_show
    user_id = f"user_wh_{uuid.uuid4().hex[:6]}"

    # 1. Hold seat D01
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers(user_id),
        json={
            "seat_ids": ["D01"],
            "idempotency_key": str(uuid.uuid4()),
            "user_id": user_id,
        },
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    # 2. Create payment session
    pay_res = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers(user_id),
        json={
            "hold_id": hold_id,
            "show_id": show_id,
            "user_id": user_id,
        },
    )
    payment_id = pay_res.json()["payment_id"]

    # 3. Send Stripe Webhook event
    webhook_payload = {
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_abc",
                "metadata": {
                    "payment_id": payment_id,
                    "hold_id": hold_id,
                },
            }
        },
    }

    wh_res = await client.post("/api/v1/payments/webhook", json=webhook_payload)
    assert wh_res.status_code == 200
    assert wh_res.json() == {"received": True, "processed": True}

    # 4. Verify payment status is now SUCCESS and booking exists
    status_res = await client.get(f"/api/v1/payments/{payment_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "SUCCESS"
    assert status_res.json()["booking_id"] is not None


@pytest.mark.asyncio
async def test_booking_routes_need_sign_in_and_ignore_body_user(client: AsyncClient, setup_show):
    show_id = setup_show
    body = {"seat_ids": ["G01"], "idempotency_key": str(uuid.uuid4()), "user_id": "someone_else"}

    no_token = await client.post(f"/api/v1/shows/{show_id}/hold", json=body)
    assert no_token.status_code == 401

    # The body claims another user; the hold must belong to the signed-in user.
    me = f"user_me_{uuid.uuid4().hex[:6]}"
    held = await client.post(f"/api/v1/shows/{show_id}/hold", headers=await auth_headers(me), json=body)
    assert held.status_code == 200
    hold_id = held.json()["data"]["hold_id"]

    stolen = await client.post(
        "/api/v1/payments/create-session",
        headers=await auth_headers("someone_else"),
        json={"hold_id": hold_id, "show_id": show_id, "user_id": me},
    )
    assert stolen.status_code >= 400

    mine = await client.get("/api/v1/bookings/user/my-bookings", headers={"x-user-id": me})
    assert mine.status_code == 401
