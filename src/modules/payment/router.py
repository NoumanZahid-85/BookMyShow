from fastapi import APIRouter, Depends, Header, Request, status
from src.modules.auth.dependencies import get_current_user
from src.modules.auth.models import UserDocument
from src.modules.payment.schemas import (
    CreatePaymentSessionRequest,
    PaymentSessionResponse,
    PaymentStatusResponse,
    SimulatePaymentRequest,
)
from src.modules.payment.service import PaymentService

router = APIRouter()


@router.post(
    "/create-session",
    response_model=PaymentSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a checkout/payment session for held seats",
)
async def create_payment_session(
    payload: CreatePaymentSessionRequest,
    user: UserDocument = Depends(get_current_user),
):
    payload.user_id = user.user_id  # must match the hold owner, checked in the service
    return await PaymentService.create_payment_session(payload)


@router.post(
    "/{payment_id}/simulate",
    response_model=PaymentStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Simulate payment gateway callback (success or card decline) for testing",
)
async def simulate_payment(payment_id: str, payload: SimulatePaymentRequest):
    return await PaymentService.simulate_payment(
        payment_id=payment_id,
        success=payload.success,
        failure_reason=payload.failure_reason,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current payment and reconciliation status",
)
async def get_payment_status(payment_id: str):
    return await PaymentService.get_payment_status(payment_id)


@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Stripe webhook endpoint for asynchronous payment reconciliation",
)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
):
    body = await request.body()
    return await PaymentService.process_stripe_webhook(body, stripe_signature)
