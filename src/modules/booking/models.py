from datetime import UTC, datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class SeatTier(str, Enum):
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"


class SeatPhysicalStatus(str, Enum):
    ACTIVE = "ACTIVE"
    BROKEN = "BROKEN"
    WHEELCHAIR = "WHEELCHAIR"


class BookingStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class SeatDefinition(BaseModel):
    seat_id: str = Field(..., pattern=r"^[A-H](0[1-9]|1[0-5])$")  # A01 to H15
    row: str = Field(..., min_length=1, max_length=1)
    number: int = Field(..., ge=1, le=15)
    tier: SeatTier
    price: float
    status: SeatPhysicalStatus = SeatPhysicalStatus.ACTIVE


class SeatLayoutDocument(Document):
    cinema_id: Indexed(str)
    screen_number: int
    version: int = 1
    total_seats: int = 120
    seats: list[SeatDefinition] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "seat_layouts"
        indexes = [
            "cinema_id",
            [("cinema_id", 1), ("screen_number", 1)],
        ]


class BookingDocument(Document):
    booking_id: Indexed(str, unique=True)
    show_id: Indexed(str)
    user_id: Indexed(str)
    seat_ids: list[str]
    hold_id: Indexed(str, unique=True)
    status: BookingStatus = BookingStatus.CONFIRMED
    total_amount: float
    payment_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "bookings"
        indexes = [
            "show_id",
            "hold_id",
            "user_id",
            [("show_id", 1), ("seat_ids", 1)],
            [("user_id", 1), ("created_at", -1)],
        ]
