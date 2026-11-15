import json
from bson import ObjectId
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.bootstrap.redis import RedisManager
from src.features.cities.models import CityDocument
from src.features.cinemas.models import CinemaDocument
from src.features.cinemas.schemas import CinemaCreateRequest, CinemaResponse

CACHE_KEY_CINEMAS_BY_CITY_PREFIX = "cache:cinemas:city:"
CACHE_KEY_CINEMA_ID_PREFIX = "cache:cinema:id:"
CACHE_TTL_SECONDS = 300  # 5 minutes


class CinemaService:
    @staticmethod
    async def create_cinema(payload: CinemaCreateRequest) -> CinemaResponse:
        try:
            city_exists = await CityDocument.get(ObjectId(payload.city_id))
        except Exception:
            city_exists = None

        if not city_exists:
            raise AppException("City referenced by city_id does not exist", status_code=404)

        doc = CinemaDocument(
            name=payload.name,
            city_id=payload.city_id,
            address=payload.address,
            total_screens=payload.total_screens,
            is_active=True,
        )
        await doc.insert()

        # Invalidate cache for this city
        if RedisManager.client:
            try:
                await RedisManager.client.delete(f"{CACHE_KEY_CINEMAS_BY_CITY_PREFIX}{payload.city_id}")
            except Exception as exc:
                logger.warning("Redis cache invalidation failed", error=str(exc))

        return CinemaResponse(
            id=str(doc.id),
            name=doc.name,
            city_id=doc.city_id,
            address=doc.address,
            total_screens=doc.total_screens,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

    @staticmethod
    async def get_cinemas_by_city(city_id: str) -> list[CinemaResponse]:
        cache_key = f"{CACHE_KEY_CINEMAS_BY_CITY_PREFIX}{city_id}"

        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(cache_key)
                if cached:
                    raw_items = json.loads(cached)
                    return [CinemaResponse(**item) for item in raw_items]
            except Exception as exc:
                logger.warning("Redis cache read failed for cinemas", city_id=city_id, error=str(exc))

        # 2. Database query
        docs = await CinemaDocument.find({"city_id": city_id, "is_active": True}).to_list()
        cinemas = [
            CinemaResponse(
                id=str(doc.id),
                name=doc.name,
                city_id=doc.city_id,
                address=doc.address,
                total_screens=doc.total_screens,
                is_active=doc.is_active,
                created_at=doc.created_at,
            )
            for doc in docs
        ]

        # 3. Populate Redis cache
        if RedisManager.client and cinemas:
            try:
                serialized = json.dumps([c.model_dump(mode="json") for c in cinemas])
                await RedisManager.client.set(cache_key, serialized, ex=CACHE_TTL_SECONDS)
            except Exception as exc:
                logger.warning("Redis cache write failed for cinemas", city_id=city_id, error=str(exc))

        return cinemas

    @staticmethod
    async def get_cinema_by_id(cinema_id: str) -> CinemaResponse:
        cache_key = f"{CACHE_KEY_CINEMA_ID_PREFIX}{cinema_id}"

        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(cache_key)
                if cached:
                    return CinemaResponse(**json.loads(cached))
            except Exception as exc:
                logger.warning("Redis cache read failed for cinema id", cinema_id=cinema_id, error=str(exc))

        # 2. Database query
        try:
            doc = await CinemaDocument.get(ObjectId(cinema_id))
        except Exception:
            doc = None

        if not doc:
            raise AppException("Cinema not found", status_code=404)

        cinema = CinemaResponse(
            id=str(doc.id),
            name=doc.name,
            city_id=doc.city_id,
            address=doc.address,
            total_screens=doc.total_screens,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

        # 3. Populate Redis cache
        if RedisManager.client:
            try:
                serialized = json.dumps(cinema.model_dump(mode="json"))
                await RedisManager.client.set(cache_key, serialized, ex=CACHE_TTL_SECONDS)
            except Exception as exc:
                logger.warning("Redis cache write failed for cinema id", cinema_id=cinema_id, error=str(exc))

        return cinema
