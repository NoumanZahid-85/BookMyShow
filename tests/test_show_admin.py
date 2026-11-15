import pytest


@pytest.mark.asyncio
async def test_show_writes_require_auth(client):
    payload = {"movie_title": "X", "cinema_id": "c", "start_time": "2030-01-01T10:00:00Z", "end_time": "2030-01-01T12:00:00Z", "base_price": 100}
    assert (await client.post("/api/v1/shows", json=payload)).status_code == 401
    assert (await client.patch("/api/v1/shows/000000000000000000000000", json={"base_price": 5})).status_code == 401
    assert (await client.delete("/api/v1/shows/000000000000000000000000")).status_code == 401


@pytest.mark.asyncio
async def test_rankings_shape(client):
    res = await client.get("/api/v1/rankings?days=7")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["days"] == 7
    assert isinstance(data["movies"], list) and isinstance(data["shows"], list)
    tickets = [m["tickets"] for m in data["movies"]]
    assert tickets == sorted(tickets, reverse=True)


@pytest.mark.asyncio
async def test_sales_requires_admin(client):
    assert (await client.get("/api/v1/admin/sales")).status_code == 401


@pytest.mark.asyncio
async def test_sales_summary_adds_up(client):
    from src.modules.booking.service import BookingService

    data = await BookingService.get_sales_summary(7)
    assert data["totals"]["tickets"] == sum(d["tickets"] for d in data["daily"])
    assert sum(h["tickets"] for h in data["by_hour"]) == data["totals"]["tickets"]


def test_seat_price_follows_show_base_price():
    from src.modules.booking.models import SeatTier
    from src.modules.booking.service import seat_price

    assert seat_price(1200, SeatTier.SILVER) == 1200
    assert seat_price(1200, SeatTier.GOLD) == 1500
    assert seat_price(1200, SeatTier.PLATINUM) == 1920
    assert seat_price(850, SeatTier.GOLD) == 1060  # 1062.5 rounds to the nearest 10
