from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from src.bootstrap.config import settings
from src.bootstrap.logger import logger

# Import models from features and modules
from src.features.cities.models import CityDocument
from src.features.cinemas.models import CinemaDocument
from src.features.shows.models import ShowDocument
from src.modules.auth.models import UserDocument
from src.modules.booking.models import BookingDocument, SeatLayoutDocument
from src.modules.payment.models import PaymentDocument
from src.modules.ticket.models import TicketDocument


class DatabaseManager:
    client: AsyncIOMotorClient | None = None

    @classmethod
    async def connect(cls) -> None:
        logger.info("Connecting to MongoDB...", uri=settings.mongo_uri)
        cls.client = AsyncIOMotorClient(
            settings.mongo_uri,
            maxPoolSize=200,
            minPoolSize=20,
            maxIdleTimeMS=45000,
            serverSelectionTimeoutMS=5000,
        )
        db = cls.client[settings.mongo_db_name]

        await init_beanie(
            database=db,
            document_models=[
                CityDocument,
                CinemaDocument,
                ShowDocument,
                SeatLayoutDocument,
                BookingDocument,
                UserDocument,
                PaymentDocument,
                TicketDocument,
            ],
        )
        logger.info("MongoDB and Beanie initialized successfully", db=settings.mongo_db_name)

    @classmethod
    async def disconnect(cls) -> None:
        if cls.client:
            logger.info("Closing MongoDB connection...")
            cls.client.close()
            cls.client = None
