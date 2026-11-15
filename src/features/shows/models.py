from datetime import datetime, timezone
from beanie import Document, Indexed
from pydantic import Field


class ShowDocument(Document):
    movie_title: Indexed(str)
    cinema_id: Indexed(str)
    screen_number: int = Field(default=1, ge=1)
    start_time: datetime
    end_time: datetime
    base_price: float = Field(..., gt=0)
    total_seats: int = Field(default=100, ge=1)
    available_seats: int = Field(default=100, ge=0)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "shows"
        indexes = [
            "cinema_id",
            "movie_title",
            "start_time",
            "is_active",
        ]
