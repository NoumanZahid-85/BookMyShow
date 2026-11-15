from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from src.modules.auth.models import UserRole

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


class UserRegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(..., pattern=EMAIL_REGEX, description="Valid email address")
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class UserLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=1)


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    phone: str | None = None
    role: UserRole
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserProfileResponse


class RefreshTokenRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    refresh_token: str = Field(..., min_length=10)


class TokenRefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
