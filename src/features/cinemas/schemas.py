from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CinemaCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Cinema or multiplex name")
    city_id: str = Field(..., min_length=1, description="Associated city ID")
    address: str = Field(..., min_length=5, max_length=255, description="Full address of cinema")
    total_screens: int = Field(default=1, ge=1, le=50, description="Number of auditoriums")

    @field_validator("name", "address")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CinemaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: str
    name: str
    city_id: str
    address: str
    total_screens: int
    is_active: bool
    created_at: datetime
