"""
Add-only demo data for BookMyShow. Deletes nothing.

Adds more cinemas, two weeks of shows (7 days back, 7 days ahead) and sample
bookings so rankings and the admin dashboard have something to show.
Sample bookings are marked with user_id "usr_seed" and payment_id "seed_...".
Safe to run twice: it exits if the sample bookings already exist.

Run with:
  uv run python scripts/seed_more.py
"""

import asyncio
import random
import uuid
from datetime import UTC, datetime, timedelta

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from src.bootstrap.config import settings
from src.features.cinemas.models import CinemaDocument
from src.features.cities.models import CityDocument
from src.features.shows.models import ShowDocument
from src.modules.booking.models import BookingDocument, BookingStatus

PKT = timedelta(hours=5)  # shows are scheduled in Pakistan local time
SLOTS = [(11, 0), (14, 30), (18, 0), (21, 30)]
TOTAL_SEATS = 120  # 8 rows x 15, the layout the booking engine generates
TIER_OF_ROW = {"A": 1.0, "B": 1.0, "C": 1.25, "D": 1.25, "E": 1.25, "F": 1.6, "G": 1.6, "H": 1.6}  # matches TIER_MULTIPLIER

NEW_CINEMAS = [
    ("Cinepax Ocean Mall", "karachi", "Ocean Mall, Clifton Block 9, Karachi", 4),
    ("Capri Cinema", "karachi", "M.A. Jinnah Road, Saddar, Karachi", 2),
    ("CineStar IMAX Township", "lahore", "Township Sector A2, Lahore", 3),
    ("PAF Cinema Lahore", "lahore", "Falcon Complex, Gulberg III, Lahore", 2),
    ("Centaurus Cineplex", "islamabad", "The Centaurus Mall, F-8, Islamabad", 5),
    ("Cinegold Plex Bahria", "rawalpindi", "Bahria Town Phase 4, Rawalpindi", 3),
    ("Taj Mahal Cinema", "faisalabad", "Kotwali Road, Faisalabad", 2),
    ("Cinepax Lyallpur Galleria", "faisalabad", "Lyallpur Galleria, East Canal Road, Faisalabad", 3),
]

# (title, base price, popularity weight used for sample bookings)
MOVIES = [
    ("Dune: Part Two", 1200, 10),
    ("The Legend of Maula Jatt", 1000, 9),
    ("Interstellar (IMAX Re-Release)", 1500, 8),
    ("Spider-Man: Across the Spider-Verse", 950, 8),
    ("Oppenheimer", 1100, 7),
    ("Top Gun: Maverick", 1000, 7),
    ("The Dark Knight", 900, 6),
    ("Inception", 900, 6),
    ("Avatar: The Way of Water", 1300, 5),
    ("Joker", 850, 5),
    ("Kamli", 850, 4),
    ("Parasite", 800, 3),
]


def sample_bookings(rng: random.Random, show: ShowDocument, count: int, latest: datetime) -> list[BookingDocument]:
    """`count` bookings of 1 to 4 neighbouring seats, never reusing a seat."""
    taken: set[str] = set()
    bookings = []
    for _ in range(count):
        row = rng.choices("ABCDEFGH", weights=[1, 2, 4, 6, 6, 5, 4, 2])[0]
        size = rng.choice([1, 2, 2, 2, 3, 4])
        start = rng.randint(1, 16 - size)
        seats = [f"{row}{n:02d}" for n in range(start, start + size)]
        if taken & set(seats):
            continue
        taken |= set(seats)
        created = show.start_time.replace(tzinfo=UTC) - timedelta(hours=rng.uniform(1, 30))
        if created > latest:  # early buyer of an upcoming show: spread over the last 3 days
            created = latest - timedelta(hours=rng.uniform(0, 72))
        bookings.append(
            BookingDocument(
                booking_id=f"bkg_seed_{uuid.uuid4().hex[:12]}",
                show_id=str(show.id),
                user_id="usr_seed",
                seat_ids=seats,
                hold_id=f"hold_seed_{uuid.uuid4().hex[:12]}",
                status=BookingStatus.CONFIRMED,
                total_amount=float(sum(round(show.base_price * TIER_OF_ROW[s[0]] / 10) * 10 for s in seats)),
                payment_id=f"seed_{uuid.uuid4().hex[:12]}",
                created_at=created,
            )
        )
    return bookings


async def seed_more():
    client = AsyncIOMotorClient(settings.mongo_uri)
    await init_beanie(
        database=client[settings.mongo_db_name],
        document_models=[CityDocument, CinemaDocument, ShowDocument, BookingDocument],
    )

    if await BookingDocument.find_one({"user_id": "usr_seed"}):
        print("Sample data already exists. Nothing added.")
        return

    rng = random.Random(42)
    cities = {c.slug: c for c in await CityDocument.find_all().to_list()}
    existing = {c.name for c in await CinemaDocument.find_all().to_list()}
    for name, slug, address, screens in NEW_CINEMAS:
        if name not in existing and slug in cities:
            await CinemaDocument(name=name, city_id=str(cities[slug].id), address=address, total_screens=screens).insert()
    cinemas = await CinemaDocument.find_all().to_list()
    print(f"Cinemas: {len(cinemas)}")

    now = datetime.now(UTC)
    today_pkt = (now + PKT).replace(hour=0, minute=0, second=0, microsecond=0)
    shows = []
    for ci, cinema in enumerate(cinemas):
        for day in range(-7, 7):
            for si, (hour, minute) in enumerate(SLOTS):
                title, price, _ = MOVIES[(ci * 5 + day * 3 + si) % len(MOVIES)]
                start = today_pkt + timedelta(days=day, hours=hour, minutes=minute) - PKT
                shows.append(
                    ShowDocument(
                        movie_title=title,
                        cinema_id=str(cinema.id),
                        screen_number=si % max(1, min(cinema.total_screens, 3)) + 1,
                        start_time=start,
                        end_time=start + timedelta(hours=2, minutes=45),
                        base_price=float(price),
                        total_seats=TOTAL_SEATS,
                        available_seats=TOTAL_SEATS,
                    )
                )
    await ShowDocument.insert_many(shows)
    # insert_many does not hand ids back to the objects, so read the new shows again.
    shows = await ShowDocument.find({"total_seats": TOTAL_SEATS, "created_at": {"$gte": now}}).to_list()
    print(f"Shows added: {len(shows)}")

    weight = {title: w for title, _, w in MOVIES}
    bookings = []
    for show in shows:
        past = show.start_time.replace(tzinfo=UTC) < now
        # Past shows sold well; upcoming ones have only early buyers so far.
        count = rng.randint(2, 4 + weight[show.movie_title] * 2) if past else rng.randint(0, 2 + weight[show.movie_title] // 2)
        made = sample_bookings(rng, show, count, latest=now)
        if made:
            show.available_seats = TOTAL_SEATS - sum(len(b.seat_ids) for b in made)
            await show.save()
            bookings += made
    await BookingDocument.insert_many(bookings)
    print(f"Sample bookings added: {len(bookings)}")
    print("Done. Cached show lists refresh within 5 minutes.")


if __name__ == "__main__":
    asyncio.run(seed_more())
