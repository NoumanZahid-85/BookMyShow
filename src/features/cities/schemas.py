from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CityBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="City name")
    province: str = Field(..., min_length=2, max_length=50, description="Province name")

    @field_validator("name", "province")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class CityCreateRequest(CityBase):
    slug: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        description="URL-friendly slug (e.g. karachi, lahore)",
    )


class CityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: str = Field(..., description="Unique city ID")
    name: str
    slug: str
    province: str
    is_active: bool
    created_at: datetime
