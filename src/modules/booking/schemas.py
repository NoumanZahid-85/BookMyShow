from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LiveSeatStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    HELD = "HELD"
    BOOKED = "BOOKED"


class SeatHoldRequest(BaseModel):
    seat_ids: list[str] = Field(
        ...,
        min_length=1,
        max_length=6,
        description="List of 1 to 6 seat IDs (e.g. ['A01', 'A02'])",
    )
    idempotency_key: str = Field(..., min_length=10, max_length=64)
    user_id: str = Field(default="user_default", min_length=1)

    @field_validator("seat_ids")
    @classmethod
    def validate_unique_seats(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("Requested seat IDs must be unique")
        for s in v:
            if not (len(s) == 3 and s[0] in "ABCDEFGH" and s[1:].isdigit()):
                raise ValueError(f"Invalid seat ID format: {s}. Expected format like A01 to H15")
        return v


class SeatHoldResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    hold_id: str
    show_id: str
    seats: list[str]
    total_amount: float
    expires_at: datetime
    message: str = "Seats held successfully for 10 minutes"


class SeatReleaseRequest(BaseModel):
    hold_id: str
    seat_ids: list[str] = Field(..., min_length=1)
    user_id: str = Field(default="user_default")


class SeatConfirmRequest(BaseModel):
    hold_id: str
    payment_id: str = Field(..., min_length=4)
    user_id: str = Field(default="user_default")


class SeatMapItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    seat_id: str
    row: str
    number: int
    tier: str
    price: float
    availability: LiveSeatStatus
    expires_at: datetime | None = None


class SeatMapResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    show_id: str
    cinema_id: str
    screen_number: int
    total_seats: int
    available_count: int
    held_count: int
    booked_count: int
    seats: list[SeatMapItem]


class BookingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    booking_id: str
    show_id: str
    user_id: str
    seat_ids: list[str]
    total_amount: float
    status: str
    payment_id: str
    created_at: datetime
