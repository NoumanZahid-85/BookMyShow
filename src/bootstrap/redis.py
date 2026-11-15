import redis.asyncio as aioredis
from src.bootstrap.config import settings
from src.bootstrap.logger import logger


class RedisManager:
    client: aioredis.Redis | None = None

    @classmethod
    async def connect(cls) -> None:
        logger.info("Connecting to Redis...", url=settings.redis_url)
        cls.client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        try:
            await cls.client.ping()
            logger.info("Redis connected successfully")
        except Exception as exc:
            logger.warning("Redis ping failed", error=str(exc))

    @classmethod
    async def disconnect(cls) -> None:
        if cls.client:
            logger.info("Closing Redis connection...")
            await cls.client.aclose()
            cls.client = None
