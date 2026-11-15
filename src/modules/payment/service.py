import json
import uuid
from datetime import UTC, datetime
import stripe
from src.bootstrap.config import settings
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.modules.booking.redis_hold import RedisHoldEngine
from src.modules.booking.schemas import SeatConfirmRequest, SeatReleaseRequest
from src.modules.booking.service import BookingService
from src.modules.payment.models import PaymentDocument, PaymentProvider, PaymentStatus
from src.modules.payment.schemas import (
    CreatePaymentSessionRequest,
    PaymentSessionResponse,
    PaymentStatusResponse,
)


class PaymentService:
    @classmethod
    async def create_payment_session(
        cls, payload: CreatePaymentSessionRequest
    ) -> PaymentSessionResponse:
        client = RedisHoldEngine._get_client()

        # 1. Verify hold exists in Redis
        meta_raw = await client.get(f"hold:meta:{payload.hold_id}")
        if not meta_raw:
            raise AppException(
                "Seat hold has expired or is invalid. Please select seats again.",
                status_code=410,
                details={"code": "HOLD_EXPIRED"},
            )

        meta = json.loads(meta_raw)
        if meta.get("user_id") != payload.user_id or meta.get("show_id") != payload.show_id:
            raise AppException("Unauthorized hold access", status_code=403)

        # 2. Check if a pending payment session already exists for this hold (idempotency)
        existing_payment = await PaymentDocument.find_one(
            {"hold_id": payload.hold_id, "status": PaymentStatus.PENDING}
        )
        if existing_payment:
            return PaymentSessionResponse(
                payment_id=existing_payment.payment_id,
                hold_id=existing_payment.hold_id,
                show_id=existing_payment.show_id,
                amount=existing_payment.amount,
                currency=existing_payment.currency,
                provider=existing_payment.provider,
                checkout_url=existing_payment.provider_session_id,
                status=existing_payment.status,
                expires_at=datetime.fromisoformat(meta["expires_at"]),
            )

        # 3. Create payment document
        payment_id = f"pay_{uuid.uuid4().hex[:12]}"
        amount = float(meta["total_amount"])
        checkout_url = None
        client_secret = None

        if payload.provider == PaymentProvider.STRIPE and settings.stripe_secret_key != "sk_test_placeholder":
            try:
                stripe.api_key = settings.stripe_secret_key
                session = stripe.checkout.Session.create(
                    payment_method_types=["card"],
                    line_items=[
                        {
                            "price_data": {
                                "currency": "pkr",
                                "product_data": {
                                    "name": f"BookMyShow - Show {payload.show_id} Seats {','.join(meta['seats'])}",
                                },
                                "unit_amount": int(amount * 100),
                            },
                            "quantity": 1,
                        }
                    ],
                    mode="payment",
                    success_url="http://localhost:3000/booking/success?payment_id=" + payment_id,
                    cancel_url="http://localhost:3000/booking/cancel?payment_id=" + payment_id,
                    metadata={"payment_id": payment_id, "hold_id": payload.hold_id},
                )
                checkout_url = session.url
            except Exception as exc:
                logger.warning("Stripe session creation failed, falling back to mock checkout", error=str(exc))
                checkout_url = f"https://checkout.stripe.mock/pay/{payment_id}"
        else:
            checkout_url = f"https://checkout.mock/pay/{payment_id}"

        payment = PaymentDocument(
            payment_id=payment_id,
            hold_id=payload.hold_id,
            show_id=payload.show_id,
            user_id=payload.user_id,
            amount=amount,
            currency="PKR",
            status=PaymentStatus.PENDING,
            provider=payload.provider,
            provider_session_id=checkout_url,
            idempotency_key=payload.idempotency_key,
        )
        await payment.insert()

        return PaymentSessionResponse(
            payment_id=payment.payment_id,
            hold_id=payment.hold_id,
            show_id=payment.show_id,
            amount=payment.amount,
            currency=payment.currency,
            provider=payment.provider,
            checkout_url=checkout_url,
            client_secret=client_secret,
            status=payment.status,
            expires_at=datetime.fromisoformat(meta["expires_at"]),
        )

    @classmethod
    async def reconcile_successful_payment(cls, payment: PaymentDocument) -> PaymentStatusResponse:
        # Idempotent: already confirmed
        if payment.status == PaymentStatus.SUCCESS and payment.booking_id:
            return PaymentStatusResponse(
                payment_id=payment.payment_id,
                hold_id=payment.hold_id,
                show_id=payment.show_id,
                user_id=payment.user_id,
                status=payment.status,
                amount=payment.amount,
                currency=payment.currency,
                booking_id=payment.booking_id,
                created_at=payment.created_at,
            )

        confirm_req = SeatConfirmRequest(
            hold_id=payment.hold_id,
            user_id=payment.user_id,
            payment_id=payment.payment_id,
        )

        booking = await BookingService.confirm_booking(payment.show_id, confirm_req)

        payment.status = PaymentStatus.SUCCESS
        payment.booking_id = booking.booking_id
        payment.updated_at = datetime.now(UTC)
        await payment.save()

        logger.info(
            "Payment reconciled successfully, booking confirmed",
            payment_id=payment.payment_id,
            booking_id=booking.booking_id,
        )

        return PaymentStatusResponse(
            payment_id=payment.payment_id,
            hold_id=payment.hold_id,
            show_id=payment.show_id,
            user_id=payment.user_id,
            status=payment.status,
            amount=payment.amount,
            currency=payment.currency,
            booking_id=payment.booking_id,
            created_at=payment.created_at,
        )

    @classmethod
    async def reconcile_failed_payment(
        cls, payment: PaymentDocument, failure_reason: str = "Payment failed"
    ) -> PaymentStatusResponse:
        if payment.status == PaymentStatus.FAILED:
            return PaymentStatusResponse(
                payment_id=payment.payment_id,
                hold_id=payment.hold_id,
                show_id=payment.show_id,
                user_id=payment.user_id,
                status=payment.status,
                amount=payment.amount,
                currency=payment.currency,
                booking_id=None,
                failure_reason=payment.failure_reason,
                created_at=payment.created_at,
            )

        # Free the held seats immediately
        client = RedisHoldEngine._get_client()
        meta_raw = await client.get(f"hold:meta:{payment.hold_id}")
        if meta_raw:
            meta = json.loads(meta_raw)
            release_req = SeatReleaseRequest(
                hold_id=payment.hold_id,
                user_id=payment.user_id,
                seat_ids=meta.get("seats", []),
            )
            try:
                await BookingService.release_seats(payment.show_id, release_req)
            except Exception as exc:
                logger.warning("Auto-release seats on payment failure skipped", error=str(exc))

        payment.status = PaymentStatus.FAILED
        payment.failure_reason = failure_reason
        payment.updated_at = datetime.now(UTC)
        await payment.save()

        logger.info(
            "Payment marked failed and held seats released",
            payment_id=payment.payment_id,
            reason=failure_reason,
        )

        return PaymentStatusResponse(
            payment_id=payment.payment_id,
            hold_id=payment.hold_id,
            show_id=payment.show_id,
            user_id=payment.user_id,
            status=payment.status,
            amount=payment.amount,
            currency=payment.currency,
            booking_id=None,
            failure_reason=failure_reason,
            created_at=payment.created_at,
        )

    @classmethod
    async def simulate_payment(
        cls, payment_id: str, success: bool, failure_reason: str | None = None
    ) -> PaymentStatusResponse:
        payment = await PaymentDocument.find_one({"payment_id": payment_id})
        if not payment:
            raise AppException("Payment not found", status_code=404)

        if success:
            return await cls.reconcile_successful_payment(payment)
        else:
            return await cls.reconcile_failed_payment(
                payment, failure_reason or "Payment declined by issuing bank"
            )

    @classmethod
    async def get_payment_status(cls, payment_id: str) -> PaymentStatusResponse:
        payment = await PaymentDocument.find_one({"payment_id": payment_id})
        if not payment:
            raise AppException("Payment not found", status_code=404)

        return PaymentStatusResponse(
            payment_id=payment.payment_id,
            hold_id=payment.hold_id,
            show_id=payment.show_id,
            user_id=payment.user_id,
            status=payment.status,
            amount=payment.amount,
            currency=payment.currency,
            booking_id=payment.booking_id,
            failure_reason=payment.failure_reason,
            created_at=payment.created_at,
        )

    @classmethod
    async def process_stripe_webhook(
        cls, payload_bytes: bytes, sig_header: str | None
    ) -> dict:
        event = None
        if settings.stripe_webhook_secret != "whsec_placeholder" and sig_header:
            try:
                event = stripe.Webhook.construct_event(
                    payload_bytes, sig_header, settings.stripe_webhook_secret
                )
            except Exception as exc:
                raise AppException(f"Invalid webhook signature: {str(exc)}", status_code=400)
        else:
            # Test / mock mode parsing
            try:
                event = json.loads(payload_bytes.decode("utf-8"))
            except Exception:
                raise AppException("Invalid JSON payload", status_code=400)

        event_type = event.get("type", "")
        data_object = event.get("data", {}).get("object", {})
        metadata = data_object.get("metadata", {})
        payment_id = metadata.get("payment_id")

        if not payment_id:
            logger.info("Webhook event received with no payment_id metadata", event_type=event_type)
            return {"received": True, "processed": False}

        payment = await PaymentDocument.find_one({"payment_id": payment_id})
        if not payment:
            logger.warning("Webhook received for unknown payment_id", payment_id=payment_id)
            return {"received": True, "processed": False}

        if event_type in ("checkout.session.completed", "payment_intent.succeeded"):
            await cls.reconcile_successful_payment(payment)
        elif event_type in ("checkout.session.expired", "payment_intent.payment_failed"):
            await cls.reconcile_failed_payment(payment, f"Stripe event {event_type}")

        return {"received": True, "processed": True}
