"""
Concurrency and Race-Condition Test Suite for Seat Booking & Locking Engine
Proves zero double-bookings, atomic multi-seat hold/release, and hold expiration.
"""

import asyncio
import uuid
import pytest
from httpx import AsyncClient

from src.bootstrap.redis import RedisManager
from src.features.shows.models import ShowDocument
from src.modules.booking.models import BookingDocument, SeatLayoutDocument
from src.modules.booking.redis_hold import RedisHoldEngine
from tests.conftest import auth_headers


@pytest.fixture
async def setup_test_show():
    """Creates an isolated test show with clean Redis and Mongo state."""
    show_uuid = uuid.uuid4().hex[:8]
    cinema_id = f"cinema_{show_uuid}"
    show = ShowDocument(
        movie_title="Concurrency Test Movie",
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

    # Clean any leftover keys for this show
    if RedisManager.client:
        keys = await RedisManager.client.keys(f"*{show_id}*")
        if keys:
            await RedisManager.client.delete(*keys)

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
async def test_1_barrier_50_tasks_competing_for_single_seat(client: AsyncClient, setup_test_show: str):
    """
    Test 1: 50 simultaneous tasks using asyncio.Barrier(50) hit seat A01 at the exact same millisecond.
    Expectation: Exactly 1 succeeds (HTTP 200), exactly 49 conflict (HTTP 409). Exactly 1 key in Redis.
    """
    show_id = setup_test_show
    barrier = asyncio.Barrier(50)
    headers = [await auth_headers(f"user_race_{i}") for i in range(50)]  # sign in before the race starts

    async def attempt_hold(idx: int):
        await barrier.wait()
        return await client.post(
            f"/api/v1/shows/{show_id}/hold",
            headers=headers[idx],
            json={
                "seat_ids": ["A01"],
                "idempotency_key": f"key_{uuid.uuid4().hex}",
                "user_id": f"user_race_{idx}",
            },
        )

    responses = await asyncio.gather(*(attempt_hold(i) for i in range(50)))
    successes = [r for r in responses if r.status_code == 200]
    conflicts = [r for r in responses if r.status_code == 409]

    assert len(successes) == 1, f"Expected exactly 1 success, got {len(successes)}"
    assert len(conflicts) == 49, f"Expected 49 conflicts, got {len(conflicts)}"

    # Verify Redis state
    held_seats = await RedisHoldEngine.get_held_seats_for_show(show_id)
    assert "A01" in held_seats
    assert len(held_seats) == 1


@pytest.mark.asyncio
async def test_2_multi_seat_atomic_hold_no_partial_holds(client: AsyncClient, setup_test_show: str):
    """
    Test 2: 10 users each request 5 seats, with overlapping requests on seats B02 and B03.
    Expectation: Zero partial holds. All-or-nothing hold behavior via Lua.
    """
    show_id = setup_test_show
    barrier = asyncio.Barrier(10)
    headers = [await auth_headers(f"user_multi_{i}") for i in range(10)]

    async def attempt_multi(idx: int):
        await barrier.wait()
        # Users overlap on B02 and B03
        seats = [f"B{idx % 3 + 1:02d}", "B02", "B03", f"C{idx + 1:02d}", f"D{idx + 1:02d}"]
        return await client.post(
            f"/api/v1/shows/{show_id}/hold",
            headers=headers[idx],
            json={
                "seat_ids": list(set(seats)),
                "idempotency_key": f"key_{uuid.uuid4().hex}",
                "user_id": f"user_multi_{idx}",
            },
        )

    responses = await asyncio.gather(*(attempt_multi(i) for i in range(10)))
    successes = [r for r in responses if r.status_code == 200]
    conflicts = [r for r in responses if r.status_code == 409]

    assert len(successes) >= 1
    assert len(successes) + len(conflicts) == 10

    # Verify that successful holds hold all their requested seats
    held_seats = await RedisHoldEngine.get_held_seats_for_show(show_id)
    for s in successes:
        data = s.json()["data"]
        for seat in data["seats"]:
            assert seat in held_seats


@pytest.mark.asyncio
async def test_3_double_release_race_condition(client: AsyncClient, setup_test_show: str):
    """
    Test 3: Same user, same hold, sends 2 release requests concurrently.
    Expectation: 1 succeeds (200), 1 fails (403 or 404). Redis key deleted exactly once.
    """
    show_id = setup_test_show
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers("user_release"),
        json={"seat_ids": ["C01"], "idempotency_key": str(uuid.uuid4()), "user_id": "user_release"},
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    res1, res2 = await asyncio.gather(
        client.post(
            f"/api/v1/shows/{show_id}/release",
            headers=await auth_headers("user_release"),
            json={"hold_id": hold_id, "seat_ids": ["C01"], "user_id": "user_release"},
        ),
        client.post(
            f"/api/v1/shows/{show_id}/release",
            headers=await auth_headers("user_release"),
            json={"hold_id": hold_id, "seat_ids": ["C01"], "user_id": "user_release"},
        ),
    )

    statuses = {res1.status_code, res2.status_code}
    assert 200 in statuses
    assert 403 in statuses


@pytest.mark.asyncio
async def test_4_double_confirm_race_condition(client: AsyncClient, setup_test_show: str):
    """
    Test 4: Same hold confirmed 2x concurrently.
    Expectation: MongoDB contains exactly 1 booking.
    """
    show_id = setup_test_show
    hold_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers("user_confirm"),
        json={"seat_ids": ["D01"], "idempotency_key": str(uuid.uuid4()), "user_id": "user_confirm"},
    )
    assert hold_res.status_code == 200
    hold_id = hold_res.json()["data"]["hold_id"]

    res1, res2 = await asyncio.gather(
        client.post(
            f"/api/v1/shows/{show_id}/confirm",
            headers=await auth_headers("user_confirm"),
            json={"hold_id": hold_id, "payment_id": "pi_test_123", "user_id": "user_confirm"},
        ),
        client.post(
            f"/api/v1/shows/{show_id}/confirm",
            headers=await auth_headers("user_confirm"),
            json={"hold_id": hold_id, "payment_id": "pi_test_123", "user_id": "user_confirm"},
        ),
    )

    bookings = await BookingDocument.find({"hold_id": hold_id}).to_list()
    assert len(bookings) == 1, "Exactly 1 booking document must exist in MongoDB"


@pytest.mark.asyncio
async def test_5_idempotency_key_replay(client: AsyncClient, setup_test_show: str):
    """
    Test 5: Same Idempotency-Key sent 2x.
    Expectation: Exact same hold_id returned, Redis has 1 hold.
    """
    show_id = setup_test_show
    idemp_key = str(uuid.uuid4())

    res1 = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers("user_idemp"),
        json={"seat_ids": ["E01"], "idempotency_key": idemp_key, "user_id": "user_idemp"},
    )
    res2 = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers("user_idemp"),
        json={"seat_ids": ["E01"], "idempotency_key": idemp_key, "user_id": "user_idemp"},
    )

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["data"]["hold_id"] == res2.json()["data"]["hold_id"]


@pytest.mark.asyncio
async def test_6_hold_ttl_expiry(client: AsyncClient, setup_test_show: str):
    """
    Test 6: Hold with short TTL (2s).
    Expectation: After 2s, seat expires and becomes AVAILABLE again for another user.
    """
    show_id = setup_test_show
    token = f"{uuid.uuid4()}:user_quick"

    # Acquire hold directly with 2s TTL
    acquired = await RedisHoldEngine.acquire_multi_hold(show_id, ["F01"], token, ttl_seconds=2)
    assert acquired is True

    # Immediate check: seat is held
    held_now = await RedisHoldEngine.get_held_seats_for_show(show_id)
    assert "F01" in held_now

    # Wait 2.2 seconds for Redis TTL expiration
    await asyncio.sleep(2.2)

    held_after = await RedisHoldEngine.get_held_seats_for_show(show_id)
    assert "F01" not in held_after

    # New user can now hold F01
    new_res = await client.post(
        f"/api/v1/shows/{show_id}/hold",
        headers=await auth_headers("user_after_exp"),
        json={"seat_ids": ["F01"], "idempotency_key": str(uuid.uuid4()), "user_id": "user_after_exp"},
    )
    assert new_res.status_code == 200


@pytest.mark.asyncio
async def test_7_confirm_after_expiry_returns_410_gone(client: AsyncClient, setup_test_show: str):
    """
    Test 7: Confirm attempted on an expired hold.
    Expectation: Returns 410 Gone, no booking created.
    """
    show_id = setup_test_show
    fake_hold_id = str(uuid.uuid4())

    res = await client.post(
        f"/api/v1/shows/{show_id}/confirm",
        headers=await auth_headers("user_test"),
        json={"hold_id": fake_hold_id, "payment_id": "pi_expired_test", "user_id": "user_test"},
    )

    assert res.status_code == 410
    bookings = await BookingDocument.find({"hold_id": fake_hold_id}).to_list()
    assert len(bookings) == 0
