"""
Database Seeding Script for BookMyShow (Pakistan Edition)
Populates realistic Pakistani Cities, Cinemas, and Shows into MongoDB using Beanie.

Run with:
  uv run python scripts/seed.py
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie

from src.bootstrap.config import settings
from src.features.cities.models import CityDocument
from src.features.cinemas.models import CinemaDocument
from src.features.shows.models import ShowDocument


async def seed():
    print(f"Connecting to MongoDB at {settings.mongo_uri}...")
    client = AsyncIOMotorClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    await init_beanie(
        database=db,
        document_models=[CityDocument, CinemaDocument, ShowDocument],
    )

    # Docker runs this on every `up`; only seed a fresh database there, never wipe a filled one.
    if "--if-empty" in sys.argv and await CityDocument.find_one():
        print("Database already has data. Skipping seed.")
        client.close()
        return

    print("Cleaning existing seed documents...")
    await ShowDocument.delete_all()
    await CinemaDocument.delete_all()
    await CityDocument.delete_all()

    # 1. Seed Pakistani Cities
    print("Seeding Pakistani Cities...")
    cities_data = [
        {"name": "Karachi", "slug": "karachi", "province": "Sindh"},
        {"name": "Lahore", "slug": "lahore", "province": "Punjab"},
        {"name": "Islamabad", "slug": "islamabad", "province": "Federal Capital"},
        {"name": "Rawalpindi", "slug": "rawalpindi", "province": "Punjab"},
        {"name": "Faisalabad", "slug": "faisalabad", "province": "Punjab"},
    ]

    city_docs = {}
    for c in cities_data:
        doc = CityDocument(name=c["name"], slug=c["slug"], province=c["province"])
        await doc.insert()
        city_docs[c["slug"]] = doc
    print(f"Inserted {len(city_docs)} cities.")

    # 2. Seed Pakistani Cinemas
    print("Seeding Pakistani Cinemas...")
    cinemas_data = [
        {
            "name": "Nueplex Cinemas The Place",
            "city_slug": "karachi",
            "address": "The Place, Phase 8, DHA, Karachi",
            "total_screens": 5,
        },
        {
            "name": "Nueplex Cinemas Askari 4",
            "city_slug": "karachi",
            "address": "Askari 4, Main Rashid Minhas Road, Karachi",
            "total_screens": 4,
        },
        {
            "name": "Atrium Cinemas",
            "city_slug": "karachi",
            "address": "Atrium Mall, Staff Lines, Saddar, Karachi",
            "total_screens": 3,
        },
        {
            "name": "Cinepax Packages Mall",
            "city_slug": "lahore",
            "address": "Packages Mall, Walton Road, Lahore",
            "total_screens": 6,
        },
        {
            "name": "Universal Cinemas Emporium",
            "city_slug": "lahore",
            "address": "Emporium Mall, Johar Town, Lahore",
            "total_screens": 9,
        },
        {
            "name": "Cue Cinemas Gulberg",
            "city_slug": "lahore",
            "address": "Main Boulevard, Gulberg III, Lahore",
            "total_screens": 4,
        },
        {
            "name": "The Arena Bahria Town",
            "city_slug": "islamabad",
            "address": "Phase 4, Bahria Town, Islamabad",
            "total_screens": 2,
        },
        {
            "name": "Cinepax Giga Mall",
            "city_slug": "islamabad",
            "address": "World Trade Center, Giga Mall, DHA Phase 2, Islamabad",
            "total_screens": 5,
        },
        {
            "name": "Cinepax Jinnah Park",
            "city_slug": "rawalpindi",
            "address": "Jinnah Park, Airport Road, Rawalpindi",
            "total_screens": 4,
        },
        {
            "name": "Cinepax Hotel One",
            "city_slug": "faisalabad",
            "address": "Hotel One, People's Colony, Faisalabad",
            "total_screens": 3,
        },
    ]

    cinema_docs = []
    for cin in cinemas_data:
        city = city_docs[cin["city_slug"]]
        doc = CinemaDocument(
            name=cin["name"],
            city_id=str(city.id),
            address=cin["address"],
            total_screens=cin["total_screens"],
        )
        await doc.insert()
        cinema_docs.append(doc)
    print(f"Inserted {len(cinema_docs)} cinemas.")

    # 3. Seed Movies and Shows
    print("Seeding Shows...")
    movies = [
        {"title": "The Legend of Maula Jatt", "base_price": 1000.0},
        {"title": "Kamli", "base_price": 850.0},
        {"title": "Dune: Part Two", "base_price": 1200.0},
        {"title": "Oppenheimer", "base_price": 1100.0},
        {"title": "Interstellar (IMAX Re-Release)", "base_price": 1500.0},
        {"title": "Spider-Man: Across the Spider-Verse", "base_price": 950.0},
    ]

    now = datetime.now(timezone.utc)
    show_count = 0

    for cinema in cinema_docs:
        for screen_num in range(1, cinema.total_screens + 1):
            # Create 3 show slots per screen
            for slot_idx, movie in enumerate(movies[:3]):
                start_offset = 2 + (slot_idx * 4)
                start_time = now + timedelta(hours=start_offset)
                end_time = start_time + timedelta(hours=3)

                show = ShowDocument(
                    movie_title=movie["title"],
                    cinema_id=str(cinema.id),
                    screen_number=screen_num,
                    start_time=start_time,
                    end_time=end_time,
                    base_price=movie["base_price"],
                    total_seats=150,
                    available_seats=150,
                    is_active=True,
                )
                await show.insert()
                show_count += 1

    print(f"Inserted {show_count} shows across all cinemas and screens.")
    print("Database seeding completed successfully for Pakistan edition!")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
