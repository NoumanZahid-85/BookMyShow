from datetime import UTC, datetime

from beanie import Document, Indexed
from pydantic import Field


class CityDocument(Document):
    name: Indexed(str, unique=True)
    slug: Indexed(str, unique=True)
    province: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "cities"
        indexes = [
            "name",
            "slug",
            "is_active",
            [("is_active", 1), ("slug", 1)],
        ]
