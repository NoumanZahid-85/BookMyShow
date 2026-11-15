import json
import uuid
from datetime import UTC, datetime, timedelta
from bson import ObjectId

from src.bootstrap.errors import AppException
from src.features.cinemas.models import CinemaDocument
from src.features.shows.models import ShowDocument
from src.modules.booking.metrics import (
    active_holds_gauge,
    confirm_after_expiry_total,
    hold_conflict_total,
    hold_success_total,
)
from src.modules.booking.models import (
    BookingDocument,
    BookingStatus,
    SeatDefinition,
    SeatLayoutDocument,
    SeatPhysicalStatus,
    SeatTier,
)
from src.modules.booking.redis_hold import RedisHoldEngine
from src.modules.booking.websocket import seat_ws_manager
from src.modules.booking.schemas import (
    BookingResponse,
    LiveSeatStatus,
    SeatConfirmRequest,
    SeatHoldRequest,
    SeatHoldResponse,
    SeatMapItem,
    SeatMapResponse,
    SeatReleaseRequest,
)

HOLD_TTL_SECONDS = 600  # 10 minutes

# A show has one base price; better rows cost more. Silver rows sell at the advertised base price.
TIER_MULTIPLIER = {SeatTier.SILVER: 1.0, SeatTier.GOLD: 1.25, SeatTier.PLATINUM: 1.6}


def seat_price(base_price: float, tier: SeatTier) -> float:
    """Price of one seat for a show, rounded to the nearest 10 rupees."""
    return float(round(base_price * TIER_MULTIPLIER[tier] / 10) * 10)


class BookingService:
    @staticmethod
    async def get_or_create_seat_layout(cinema_id: str, screen_number: int) -> SeatLayoutDocument:
        layout = await SeatLayoutDocument.find_one(
            {"cinema_id": cinema_id, "screen_number": screen_number}
        )
        if layout:
            return layout

        # Generate standard 120-seat auditorium layout
        seats: list[SeatDefinition] = []
        rows = ["A", "B", "C", "D", "E", "F", "G", "H"]

        for row in rows:
            if row in ["A", "B"]:
                tier = SeatTier.SILVER
                price = 150.0
            elif row in ["C", "D", "E"]:
                tier = SeatTier.GOLD
                price = 250.0
            else:
                tier = SeatTier.PLATINUM
                price = 400.0

            for num in range(1, 16):
                seat_id = f"{row}{num:02d}"
                seats.append(
                    SeatDefinition(
                        seat_id=seat_id,
                        row=row,
                        number=num,
                        tier=tier,
                        price=price,
                        status=SeatPhysicalStatus.ACTIVE,
                    )
                )

        layout = SeatLayoutDocument(
            cinema_id=cinema_id,
            screen_number=screen_number,
            version=1,
            total_seats=len(seats),
            seats=seats,
        )
        await layout.insert()
        return layout

    @classmethod
    async def get_seat_map(cls, show_id: str) -> SeatMapResponse:
        try:
            show = await ShowDocument.get(ObjectId(show_id))
        except Exception:
            show = None

        if not show:
            raise AppException("Show not found", status_code=404)

        layout = await cls.get_or_create_seat_layout(show.cinema_id, show.screen_number)

        # 1. Fetch confirmed bookings for this show from MongoDB
        confirmed_bookings = await BookingDocument.find(
            {"show_id": show_id, "status": BookingStatus.CONFIRMED}
        ).to_list()
        booked_seat_set = set()
        for b in confirmed_bookings:
            booked_seat_set.update(b.seat_ids)

        # 2. Fetch active holds from Redis
        held_seats_dict = await RedisHoldEngine.get_held_seats_for_show(show_id)

        # 3. Assemble live seat grid
        seat_items: list[SeatMapItem] = []
        held_count = 0
        booked_count = 0

        for s in layout.seats:
            if s.seat_id in booked_seat_set:
                availability = LiveSeatStatus.BOOKED
                booked_count += 1
                expires_at = None
            elif s.seat_id in held_seats_dict:
                availability = LiveSeatStatus.HELD
                held_count += 1
                expires_at = datetime.now(UTC) + timedelta(seconds=HOLD_TTL_SECONDS)
            else:
                availability = LiveSeatStatus.AVAILABLE
                expires_at = None

            seat_items.append(
                SeatMapItem(
                    seat_id=s.seat_id,
                    row=s.row,
                    number=s.number,
                    tier=s.tier.value,
                    price=seat_price(show.base_price, s.tier),
                    availability=availability,
                    expires_at=expires_at,
                )
            )

        available_count = layout.total_seats - (booked_count + held_count)

        return SeatMapResponse(
            show_id=show_id,
            cinema_id=show.cinema_id,
            screen_number=show.screen_number,
            total_seats=layout.total_seats,
            available_count=available_count,
            held_count=held_count,
            booked_count=booked_count,
            seats=seat_items,
        )

    @classmethod
    async def hold_seats(cls, show_id: str, payload: SeatHoldRequest) -> SeatHoldResponse:
        client = RedisHoldEngine._get_client()

        # 1. Idempotency check
        idemp_key = f"idemp:hold:{payload.user_id}:{payload.idempotency_key}"
        cached_hold_id = await client.get(idemp_key)
        if cached_hold_id:
            meta_raw = await client.get(f"hold:meta:{cached_hold_id}")
            if meta_raw:
                meta = json.loads(meta_raw)
                return SeatHoldResponse(
                    hold_id=cached_hold_id,
                    show_id=show_id,
                    seats=meta["seats"],
                    total_amount=meta["total_amount"],
                    expires_at=datetime.fromisoformat(meta["expires_at"]),
                    message="Existing hold returned via Idempotency-Key",
                )

        # 2. Check if user already has an active hold for this show (max 1 active hold per user)
        user_hold_key = f"user:active_hold:{payload.user_id}:{show_id}"
        existing_user_hold_id = await client.get(user_hold_key)
        if existing_user_hold_id:
            meta_raw = await client.get(f"hold:meta:{existing_user_hold_id}")
            if meta_raw:
                meta = json.loads(meta_raw)
                return SeatHoldResponse(
                    hold_id=existing_user_hold_id,
                    show_id=show_id,
                    seats=meta["seats"],
                    total_amount=meta["total_amount"],
                    expires_at=datetime.fromisoformat(meta["expires_at"]),
                    message="User already has an active hold for this show",
                )

        # 3. Check MongoDB: ensure none of the seats are already permanently booked
        already_booked = await BookingDocument.find_one(
            {
                "show_id": show_id,
                "seat_ids": {"$in": payload.seat_ids},
                "status": BookingStatus.CONFIRMED,
            }
        )
        if already_booked:
            hold_conflict_total.inc()
            raise AppException(
                "One or more requested seats are already booked",
                status_code=409,
                details={"code": "SEAT_ALREADY_BOOKED"},
            )

        # 4. Generate unique hold token
        hold_id = str(uuid.uuid4())
        hold_token = f"{hold_id}:{payload.user_id}"

        # 5. Acquire atomic multi-seat hold in Redis via Lua
        acquired = await RedisHoldEngine.acquire_multi_hold(
            show_id=show_id,
            seat_ids=payload.seat_ids,
            hold_token=hold_token,
            ttl_seconds=HOLD_TTL_SECONDS,
        )

        if not acquired:
            hold_conflict_total.inc()
            raise AppException(
                "One or more requested seats are currently held by another user",
                status_code=409,
                details={"code": "SEAT_ALREADY_HELD", "retry_after": 45},
            )

        # 6. Calculate pricing from layout
        try:
            show = await ShowDocument.get(ObjectId(show_id))
        except Exception:
            show = None
        if not show:
            # Rollback Redis hold if show is invalid
            await RedisHoldEngine.release_hold(show_id, payload.seat_ids, hold_token)
            raise AppException("Show not found", status_code=404)

        layout = await cls.get_or_create_seat_layout(show.cinema_id, show.screen_number)
        price_map = {s.seat_id: seat_price(show.base_price, s.tier) for s in layout.seats}
        unknown = [s_id for s_id in payload.seat_ids if s_id not in price_map]
        if unknown:
            await RedisHoldEngine.release_hold(show_id, payload.seat_ids, hold_token)
            raise AppException(f"Unknown seats: {', '.join(unknown)}", status_code=422)
        total_amount = sum(price_map[s_id] for s_id in payload.seat_ids)

        expires_at = datetime.now(UTC) + timedelta(seconds=HOLD_TTL_SECONDS)

        # 7. Store hold metadata and idempotency in Redis
        meta_payload = {
            "hold_id": hold_id,
            "show_id": show_id,
            "user_id": payload.user_id,
            "seats": payload.seat_ids,
            "total_amount": total_amount,
            "expires_at": expires_at.isoformat(),
        }

        await client.set(f"hold:meta:{hold_id}", json.dumps(meta_payload), ex=HOLD_TTL_SECONDS)
        await client.set(user_hold_key, hold_id, ex=HOLD_TTL_SECONDS)
        await client.set(idemp_key, hold_id, ex=HOLD_TTL_SECONDS)

        hold_success_total.inc()
        active_holds_gauge.inc(len(payload.seat_ids))

        # Broadcast live seat hold event to connected WebSocket clients
        await seat_ws_manager.broadcast_seat_update(
            show_id=show_id,
            event_type="SEAT_HELD",
            seats=payload.seat_ids,
            hold_id=hold_id,
            expires_in=HOLD_TTL_SECONDS,
        )

        return SeatHoldResponse(
            hold_id=hold_id,
            show_id=show_id,
            seats=payload.seat_ids,
            total_amount=total_amount,
            expires_at=expires_at,
        )

    @classmethod
    async def release_seats(cls, show_id: str, payload: SeatReleaseRequest) -> dict:
        hold_token = f"{payload.hold_id}:{payload.user_id}"
        deleted_count = await RedisHoldEngine.release_hold(
            show_id=show_id,
            seat_ids=payload.seat_ids,
            hold_token=hold_token,
        )

        if deleted_count == 0:
            raise AppException("Hold not found or unauthorized", status_code=403)

        active_holds_gauge.dec(deleted_count)

        client = RedisHoldEngine._get_client()
        await client.delete(f"hold:meta:{payload.hold_id}")
        await client.delete(f"user:active_hold:{payload.user_id}:{show_id}")

        # Broadcast live seat release event to connected WebSocket clients
        await seat_ws_manager.broadcast_seat_update(
            show_id=show_id,
            event_type="SEAT_RELEASED",
            seats=payload.seat_ids,
        )

        return {"success": True, "released_seats_count": deleted_count}

    @classmethod
    async def confirm_booking(cls, show_id: str, payload: SeatConfirmRequest) -> BookingResponse:
        client = RedisHoldEngine._get_client()
        meta_raw = await client.get(f"hold:meta:{payload.hold_id}")

        if not meta_raw:
            confirm_after_expiry_total.inc()
            raise AppException(
                "Seat hold has expired or is invalid",
                status_code=410,
                details={"code": "HOLD_EXPIRED"},
            )

        meta = json.loads(meta_raw)
        if meta["user_id"] != payload.user_id:
            raise AppException("Unauthorized confirmation attempt", status_code=403)

        hold_token = f"{payload.hold_id}:{payload.user_id}"

        # 1. Atomically verify hold token in Redis and clear hold keys via Lua
        cleared = await RedisHoldEngine.verify_and_clear_hold(
            show_id=show_id,
            seat_ids=meta["seats"],
            hold_token=hold_token,
        )

        if not cleared:
            confirm_after_expiry_total.inc()
            raise AppException(
                "Hold expired or modified before confirmation",
                status_code=410,
                details={"code": "HOLD_EXPIRED"},
            )

        active_holds_gauge.dec(len(meta["seats"]))

        # 2. Check for existing booking (idempotent confirm)
        existing_booking = await BookingDocument.find_one({"hold_id": payload.hold_id})
        if existing_booking:
            return BookingResponse(
                booking_id=existing_booking.booking_id,
                show_id=existing_booking.show_id,
                user_id=existing_booking.user_id,
                seat_ids=existing_booking.seat_ids,
                total_amount=existing_booking.total_amount,
                status=existing_booking.status.value,
                payment_id=existing_booking.payment_id,
                created_at=existing_booking.created_at,
            )

        # 3. Insert permanent booking into MongoDB
        booking_id = f"bkg_{uuid.uuid4().hex[:12]}"
        booking = BookingDocument(
            booking_id=booking_id,
            show_id=show_id,
            user_id=payload.user_id,
            seat_ids=meta["seats"],
            hold_id=payload.hold_id,
            status=BookingStatus.CONFIRMED,
            total_amount=meta["total_amount"],
            payment_id=payload.payment_id,
        )
        await booking.insert()

        # 4. Clean up Redis hold metadata
        await client.delete(f"hold:meta:{payload.hold_id}")
        await client.delete(f"user:active_hold:{payload.user_id}:{show_id}")

        # Broadcast live seat booked event to connected WebSocket clients
        await seat_ws_manager.broadcast_seat_update(
            show_id=show_id,
            event_type="SEAT_BOOKED",
            seats=meta["seats"],
            booking_id=booking.booking_id,
        )

        return BookingResponse(
            booking_id=booking.booking_id,
            show_id=booking.show_id,
            user_id=booking.user_id,
            seat_ids=booking.seat_ids,
            total_amount=booking.total_amount,
            status=booking.status.value,
            payment_id=booking.payment_id,
            created_at=booking.created_at,
        )

    @staticmethod
    async def get_booking_by_id(booking_id: str, user_id: str) -> BookingResponse:
        booking = await BookingDocument.find_one(
            {"booking_id": booking_id, "user_id": user_id}
        )
        if not booking:
            raise AppException("Booking not found or access denied", status_code=404)

        return BookingResponse(
            booking_id=booking.booking_id,
            show_id=booking.show_id,
            user_id=booking.user_id,
            seat_ids=booking.seat_ids,
            total_amount=booking.total_amount,
            status=booking.status.value,
            payment_id=booking.payment_id,
            created_at=booking.created_at,
        )

    @staticmethod
    async def get_user_bookings(user_id: str) -> list[BookingResponse]:
        bookings = await BookingDocument.find(
            {"user_id": user_id}
        ).sort("-created_at").to_list()
        return [
            BookingResponse(
                booking_id=b.booking_id,
                show_id=b.show_id,
                user_id=b.user_id,
                seat_ids=b.seat_ids,
                total_amount=b.total_amount,
                status=b.status.value,
                payment_id=b.payment_id,
                created_at=b.created_at,
            )
            for b in bookings
        ]


    @staticmethod
    async def get_rankings(days: int = 7, limit: int = 5, city_id: str | None = None) -> dict:
        """Top movies and shows by seats sold in confirmed bookings over the last `days` days."""
        since = datetime.now(UTC) - timedelta(days=days)
        match: dict = {"status": BookingStatus.CONFIRMED.value, "created_at": {"$gte": since}}
        if city_id:
            cinema_ids = [str(c.id) for c in await CinemaDocument.find({"city_id": city_id}).to_list()]
            shows_in_city = await ShowDocument.find({"cinema_id": {"$in": cinema_ids}}).to_list()
            match["show_id"] = {"$in": [str(s.id) for s in shows_in_city]}
        rows = await BookingDocument.get_motor_collection().aggregate(
            [
                {"$match": match},
                {
                    "$group": {
                        "_id": "$show_id",
                        "tickets": {"$sum": {"$size": "$seat_ids"}},
                        "revenue": {"$sum": "$total_amount"},
                    }
                },
            ]
        ).to_list(length=None)

        valid = {r["_id"]: r for r in rows if ObjectId.is_valid(r["_id"])}
        shows = await ShowDocument.find({"_id": {"$in": [ObjectId(i) for i in valid]}}).to_list()

        movies: dict[str, dict] = {}
        show_rows = []
        for show in shows:
            row = valid[str(show.id)]
            movie = movies.setdefault(show.movie_title, {"movie_title": show.movie_title, "tickets": 0, "revenue": 0.0})
            movie["tickets"] += row["tickets"]
            movie["revenue"] += row["revenue"]
            show_rows.append(
                {
                    "show_id": str(show.id),
                    "movie_title": show.movie_title,
                    "cinema_id": show.cinema_id,
                    "start_time": show.start_time,
                    "tickets": row["tickets"],
                    "revenue": row["revenue"],
                }
            )

        top = lambda items: sorted(items, key=lambda r: r["tickets"], reverse=True)[:limit]  # noqa: E731
        return {"days": days, "movies": top(movies.values()), "shows": top(show_rows)}

    @staticmethod
    async def get_sales_summary(days: int = 7, cinema_id: str | None = None) -> dict:
        """
        Plain business numbers for the admin dashboard, in Pakistan time:
        tickets and revenue per day, tickets by show start hour, and occupancy of upcoming shows.
        """
        tz = "+05:00"
        since = datetime.now(UTC) - timedelta(days=days)
        match: dict = {"status": BookingStatus.CONFIRMED.value, "created_at": {"$gte": since}}
        if cinema_id:
            ids = [str(s.id) for s in await ShowDocument.find({"cinema_id": cinema_id}).to_list()]
            match["show_id"] = {"$in": ids}

        daily = await BookingDocument.get_motor_collection().aggregate(
            [
                {"$match": match},
                {
                    "$group": {
                        "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": tz}},
                        "tickets": {"$sum": {"$size": "$seat_ids"}},
                        "revenue": {"$sum": "$total_amount"},
                        "bookings": {"$sum": 1},
                    }
                },
                {"$sort": {"_id": 1}},
            ]
        ).to_list(length=None)

        per_show = await BookingDocument.get_motor_collection().aggregate(
            [{"$match": match}, {"$group": {"_id": "$show_id", "tickets": {"$sum": {"$size": "$seat_ids"}}}}]
        ).to_list(length=None)
        tickets_by_show = {r["_id"]: r["tickets"] for r in per_show if ObjectId.is_valid(r["_id"])}
        shows = await ShowDocument.find({"_id": {"$in": [ObjectId(i) for i in tickets_by_show]}}).to_list()
        by_hour = [0] * 24
        for show in shows:
            hour = (show.start_time.replace(tzinfo=UTC) + timedelta(hours=5)).hour
            by_hour[hour] += tickets_by_show[str(show.id)]

        return {
            "days": days,
            "daily": [{"date": d["_id"], "tickets": d["tickets"], "revenue": d["revenue"], "bookings": d["bookings"]} for d in daily],
            "by_hour": [{"hour": h, "tickets": t} for h, t in enumerate(by_hour) if t],
            "totals": {
                "tickets": sum(d["tickets"] for d in daily),
                "revenue": sum(d["revenue"] for d in daily),
                "bookings": sum(d["bookings"] for d in daily),
            },
        }
