from datetime import UTC, datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field


class TicketStatus(str, Enum):
    ISSUED = "ISSUED"
    SCANNED = "SCANNED"
    CANCELLED = "CANCELLED"
    VOID = "VOID"


class TicketDocument(Document):
    ticket_id: Indexed(str, unique=True)
    booking_id: Indexed(str, unique=True)
    show_id: Indexed(str)
    user_id: Indexed(str)
    seat_ids: list[str]
    total_amount: float
    qr_payload: str
    hmac_signature: str
    status: TicketStatus = TicketStatus.ISSUED
    scanned_at: datetime | None = None
    scanned_by_gate: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "tickets"
