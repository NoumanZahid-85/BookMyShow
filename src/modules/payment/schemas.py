from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from src.modules.payment.models import PaymentProvider, PaymentStatus


class CreatePaymentSessionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    hold_id: str = Field(..., min_length=10)
    show_id: str = Field(..., min_length=5)
    user_id: str = Field(default="", description="Ignored: the signed-in user from the token is used")
    provider: PaymentProvider = PaymentProvider.MOCK
    idempotency_key: str | None = None


class PaymentSessionResponse(BaseModel):
    payment_id: str
    hold_id: str
    show_id: str
    amount: float
    currency: str
    provider: PaymentProvider
    checkout_url: str | None = None
    client_secret: str | None = None
    status: PaymentStatus
    expires_at: datetime | None = None


class SimulatePaymentRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    success: bool = True
    failure_reason: str | None = None


class PaymentStatusResponse(BaseModel):
    payment_id: str
    hold_id: str
    show_id: str
    user_id: str
    status: PaymentStatus
    amount: float
    currency: str
    booking_id: str | None = None
    failure_reason: str | None = None
    created_at: datetime
