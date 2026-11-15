from fastapi import APIRouter, Depends, status
from src.modules.auth.dependencies import get_current_user, require_admin
from src.modules.auth.models import UserDocument
from src.modules.ticket.schemas import (
    TicketResponse,
    TicketVerifyRequest,
    TicketVerifyResponse,
)
from src.modules.ticket.service import TicketService

router = APIRouter()


@router.post(
    "/generate/{booking_id}",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate HMAC-signed digital QR ticket for a confirmed booking",
)
async def generate_ticket(
    booking_id: str,
    user: UserDocument = Depends(get_current_user),
):
    return await TicketService.generate_ticket(booking_id, requesting_user_id=user.user_id)


@router.get(
    "/{ticket_id}",
    response_model=TicketResponse,
    status_code=status.HTTP_200_OK,
    summary="Get digital ticket details and renderable SVG QR code",
)
async def get_ticket(ticket_id: str):
    return await TicketService.get_ticket(ticket_id)


@router.post(
    "/verify",
    response_model=TicketVerifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Gate scanner endpoint to cryptographically verify QR ticket and admit customer",
)
async def verify_ticket_at_gate(payload: TicketVerifyRequest, _staff: UserDocument = Depends(require_admin)):
    return await TicketService.verify_at_gate(payload.qr_payload, payload.gate_id)
