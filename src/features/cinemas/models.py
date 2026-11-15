from datetime import datetime, timezone
from beanie import Document, Indexed
from pydantic import Field


class CinemaDocument(Document):
    name: Indexed(str)
    city_id: Indexed(str)
    address: str
    total_screens: int = Field(default=1, ge=1)
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "cinemas"
        indexes = [
            "city_id",
            "name",
            "is_active",
        ]
