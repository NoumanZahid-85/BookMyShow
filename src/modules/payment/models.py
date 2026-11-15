from datetime import UTC, datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class PaymentProvider(str, Enum):
    STRIPE = "STRIPE"
    MOCK = "MOCK"


class PaymentDocument(Document):
    payment_id: Indexed(str, unique=True)
    hold_id: Indexed(str)
    show_id: Indexed(str)
    user_id: Indexed(str)
    amount: float
    currency: str = "PKR"
    status: PaymentStatus = PaymentStatus.PENDING
    provider: PaymentProvider = PaymentProvider.STRIPE
    provider_session_id: str | None = None
    provider_payment_intent: str | None = None
    idempotency_key: str | None = None
    booking_id: str | None = None
    failure_reason: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "payments"
