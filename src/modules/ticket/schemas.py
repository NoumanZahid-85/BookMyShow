from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from src.modules.ticket.models import TicketStatus


class TicketGenerateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    booking_id: str = Field(..., min_length=4)


class TicketVerifyRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    qr_payload: str = Field(..., min_length=10)
    gate_id: str = Field(default="MAIN_GATE_01", max_length=50)


class TicketResponse(BaseModel):
    ticket_id: str
    booking_id: str
    show_id: str
    user_id: str
    seat_ids: list[str]
    total_amount: float
    status: TicketStatus
    qr_payload: str
    qr_svg: str
    created_at: datetime


class TicketVerifyResponse(BaseModel):
    valid: bool
    ticket_id: str
    booking_id: str
    show_id: str
    seat_ids: list[str]
    message: str
    scanned_at: datetime | None = None
