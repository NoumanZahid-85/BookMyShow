from datetime import UTC, datetime
from enum import Enum
from beanie import Document, Indexed
from pydantic import Field


class UserRole(str, Enum):
    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"


class UserDocument(Document):
    user_id: Indexed(str, unique=True)
    email: Indexed(str, unique=True)
    hashed_password: str
    salt: str
    full_name: str
    phone: str | None = None
    role: UserRole = UserRole.CUSTOMER
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "users"
