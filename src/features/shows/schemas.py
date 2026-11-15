from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator


class ShowCreateRequest(BaseModel):
    movie_title: str = Field(..., min_length=1, max_length=150, description="Title of the movie")
    cinema_id: str = Field(..., min_length=1, description="Cinema ID where show will run")
    screen_number: int = Field(default=1, ge=1, le=50, description="Screen or auditorium number")
    start_time: datetime = Field(..., description="Show starting timestamp")
    end_time: datetime = Field(..., description="Show ending timestamp")
    base_price: float = Field(..., gt=0, le=10000, description="Ticket starting price")
    total_seats: int = Field(default=100, ge=1, le=1000, description="Auditorium seat capacity")

    @model_validator(mode="after")
    def validate_show_times(self) -> "ShowCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be strictly after start_time")
        return self


class ShowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, frozen=True)

    id: str
    movie_title: str
    cinema_id: str
    screen_number: int
    start_time: datetime
    end_time: datetime
    base_price: float
    total_seats: int
    available_seats: int
    is_active: bool
    created_at: datetime


class ShowUpdateRequest(BaseModel):
    """Partial update. Seat capacity is fixed once a show exists, so it is not editable."""

    model_config = ConfigDict(extra="forbid")

    movie_title: str | None = Field(default=None, min_length=1, max_length=150)
    screen_number: int | None = Field(default=None, ge=1, le=50)
    start_time: datetime | None = None
    end_time: datetime | None = None
    base_price: float | None = Field(default=None, gt=0, le=10000)
