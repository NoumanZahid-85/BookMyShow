import hashlib
import hmac
import json
import uuid
from datetime import UTC, datetime
import qrcode
import qrcode.image.svg
from src.bootstrap.config import settings
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.modules.booking.models import BookingDocument, BookingStatus
from src.modules.ticket.models import TicketDocument, TicketStatus
from src.modules.ticket.schemas import TicketResponse, TicketVerifyResponse


class TicketService:
    @staticmethod
    def _sign_payload(data: dict) -> str:
        serialized = json.dumps(data, sort_keys=True).encode("utf-8")
        return hmac.new(settings.jwt_secret.encode("utf-8"), serialized, hashlib.sha256).hexdigest()

    @staticmethod
    def _generate_qr_svg(content: str) -> str:
        img = qrcode.make(content, image_factory=qrcode.image.svg.SvgPathImage)
        return img.to_string().decode("utf-8")

    @classmethod
    async def generate_ticket(cls, booking_id: str, requesting_user_id: str | None = None) -> TicketResponse:
        booking = await BookingDocument.find_one({"booking_id": booking_id})
        if not booking:
            raise AppException("Booking not found", status_code=404)

        if requesting_user_id and booking.user_id != requesting_user_id:
            raise AppException("Unauthorized booking access", status_code=403)

        if booking.status != BookingStatus.CONFIRMED:
            raise AppException("Cannot generate ticket for unconfirmed booking", status_code=400)

        # Idempotent: return existing ticket if already generated
        existing = await TicketDocument.find_one({"booking_id": booking_id})
        if existing:
            qr_svg = cls._generate_qr_svg(existing.qr_payload)
            return TicketResponse(
                ticket_id=existing.ticket_id,
                booking_id=existing.booking_id,
                show_id=existing.show_id,
                user_id=existing.user_id,
                seat_ids=existing.seat_ids,
                total_amount=existing.total_amount,
                status=existing.status,
                qr_payload=existing.qr_payload,
                qr_svg=qr_svg,
                created_at=existing.created_at,
            )

        ticket_id = f"tkt_{uuid.uuid4().hex[:12]}"
        data_to_sign = {
            "ticket_id": ticket_id,
            "booking_id": booking.booking_id,
            "show_id": booking.show_id,
            "user_id": booking.user_id,
            "seat_ids": booking.seat_ids,
            "total_amount": booking.total_amount,
        }

        signature = cls._sign_payload(data_to_sign)
        full_qr_payload = json.dumps({"data": data_to_sign, "sig": signature})
        qr_svg = cls._generate_qr_svg(full_qr_payload)

        ticket = TicketDocument(
            ticket_id=ticket_id,
            booking_id=booking.booking_id,
            show_id=booking.show_id,
            user_id=booking.user_id,
            seat_ids=booking.seat_ids,
            total_amount=booking.total_amount,
            qr_payload=full_qr_payload,
            hmac_signature=signature,
            status=TicketStatus.ISSUED,
        )
        await ticket.insert()

        logger.info("Digital QR ticket generated", ticket_id=ticket_id, booking_id=booking_id)

        return TicketResponse(
            ticket_id=ticket.ticket_id,
            booking_id=ticket.booking_id,
            show_id=ticket.show_id,
            user_id=ticket.user_id,
            seat_ids=ticket.seat_ids,
            total_amount=ticket.total_amount,
            status=ticket.status,
            qr_payload=ticket.qr_payload,
            qr_svg=qr_svg,
            created_at=ticket.created_at,
        )

    @classmethod
    async def get_ticket(cls, ticket_id: str) -> TicketResponse:
        ticket = await TicketDocument.find_one({"ticket_id": ticket_id})
        if not ticket:
            raise AppException("Ticket not found", status_code=404)

        qr_svg = cls._generate_qr_svg(ticket.qr_payload)
        return TicketResponse(
            ticket_id=ticket.ticket_id,
            booking_id=ticket.booking_id,
            show_id=ticket.show_id,
            user_id=ticket.user_id,
            seat_ids=ticket.seat_ids,
            total_amount=ticket.total_amount,
            status=ticket.status,
            qr_payload=ticket.qr_payload,
            qr_svg=qr_svg,
            created_at=ticket.created_at,
        )

    @classmethod
    async def verify_at_gate(cls, raw_qr_payload: str, gate_id: str) -> TicketVerifyResponse:
        try:
            parsed = json.loads(raw_qr_payload)
            data = parsed["data"]
            signature = parsed["sig"]
        except Exception:
            return TicketVerifyResponse(
                valid=False,
                ticket_id="UNKNOWN",
                booking_id="UNKNOWN",
                show_id="UNKNOWN",
                seat_ids=[],
                message="MALFORMED_QR_DATA: Unable to parse payload",
            )

        # 1. Verify HMAC cryptographic signature
        expected_sig = cls._sign_payload(data)
        if not hmac.compare_digest(expected_sig, signature):
            logger.warning("Ticket signature verification failed (forged/tampered QR code)", data=data)
            return TicketVerifyResponse(
                valid=False,
                ticket_id=data.get("ticket_id", "UNKNOWN"),
                booking_id=data.get("booking_id", "UNKNOWN"),
                show_id=data.get("show_id", "UNKNOWN"),
                seat_ids=data.get("seat_ids", []),
                message="SECURITY_ALERT: Invalid cryptographic signature (Forged Ticket)",
            )

        # 2. Check ticket record in database
        ticket_id = data["ticket_id"]
        ticket = await TicketDocument.find_one({"ticket_id": ticket_id})
        if not ticket:
            return TicketVerifyResponse(
                valid=False,
                ticket_id=ticket_id,
                booking_id=data.get("booking_id", "UNKNOWN"),
                show_id=data.get("show_id", "UNKNOWN"),
                seat_ids=data.get("seat_ids", []),
                message="TICKET_NOT_FOUND_IN_SYSTEM",
            )

        # 3. Check if already scanned
        if ticket.status == TicketStatus.SCANNED:
            return TicketVerifyResponse(
                valid=False,
                ticket_id=ticket.ticket_id,
                booking_id=ticket.booking_id,
                show_id=ticket.show_id,
                seat_ids=ticket.seat_ids,
                message="TICKET_ALREADY_USED: Entry denied, duplicate scan",
                scanned_at=ticket.scanned_at,
            )

        if ticket.status != TicketStatus.ISSUED:
            return TicketVerifyResponse(
                valid=False,
                ticket_id=ticket.ticket_id,
                booking_id=ticket.booking_id,
                show_id=ticket.show_id,
                seat_ids=ticket.seat_ids,
                message=f"TICKET_STATUS_INVALID: Status is {ticket.status.value}",
            )

        # 4. Mark ticket as SCANNED at gate
        now = datetime.now(UTC)
        ticket.status = TicketStatus.SCANNED
        ticket.scanned_at = now
        ticket.scanned_by_gate = gate_id
        await ticket.save()

        logger.info(
            "Ticket verified and admitted at gate",
            ticket_id=ticket.ticket_id,
            gate_id=gate_id,
            seats=ticket.seat_ids,
        )

        return TicketVerifyResponse(
            valid=True,
            ticket_id=ticket.ticket_id,
            booking_id=ticket.booking_id,
            show_id=ticket.show_id,
            seat_ids=ticket.seat_ids,
            message="VALID_TICKET: Entry permitted. Welcome to the show!",
            scanned_at=now,
        )
