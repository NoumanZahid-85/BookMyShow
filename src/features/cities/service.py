import json
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.bootstrap.redis import RedisManager
from src.features.cities.models import CityDocument
from src.features.cities.schemas import CityCreateRequest, CityResponse

CACHE_KEY_ACTIVE_CITIES = "cache:cities:active:v1"
CACHE_KEY_CITY_SLUG_PREFIX = "cache:city:slug:"
CACHE_TTL_SECONDS = 300  # 5 minutes


class CityService:
    @staticmethod
    async def create_city(payload: CityCreateRequest) -> CityResponse:
        existing = await CityDocument.find_one(
            {"$or": [{"slug": payload.slug}, {"name": payload.name}]}
        )
        if existing:
            raise AppException("A city with this name or slug already exists", status_code=409)

        doc = CityDocument(
            name=payload.name,
            slug=payload.slug,
            province=payload.province,
            is_active=True,
        )
        await doc.insert()

        # Invalidate active cities cache
        if RedisManager.client:
            try:
                await RedisManager.client.delete(CACHE_KEY_ACTIVE_CITIES)
            except Exception as exc:
                logger.warning("Redis cache invalidation failed", error=str(exc))

        return CityResponse(
            id=str(doc.id),
            name=doc.name,
            slug=doc.slug,
            province=doc.province,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

    @staticmethod
    async def get_all_active_cities() -> list[CityResponse]:
        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(CACHE_KEY_ACTIVE_CITIES)
                if cached:
                    raw_items = json.loads(cached)
                    return [CityResponse(**item) for item in raw_items]
            except Exception as exc:
                logger.warning("Redis cache read failed, falling back to DB", error=str(exc))

        # 2. Database fallback
        docs = await CityDocument.find({"is_active": True}).to_list()
        cities = [
            CityResponse(
                id=str(doc.id),
                name=doc.name,
                slug=doc.slug,
                province=doc.province,
                is_active=doc.is_active,
                created_at=doc.created_at,
            )
            for doc in docs
        ]

        # 3. Populate Redis cache
        if RedisManager.client and cities:
            try:
                serialized = json.dumps([c.model_dump(mode="json") for c in cities])
                await RedisManager.client.set(
                    CACHE_KEY_ACTIVE_CITIES, serialized, ex=CACHE_TTL_SECONDS
                )
            except Exception as exc:
                logger.warning("Redis cache write failed", error=str(exc))

        return cities

    @staticmethod
    async def get_city_by_slug(slug: str) -> CityResponse:
        cache_key = f"{CACHE_KEY_CITY_SLUG_PREFIX}{slug}"

        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(cache_key)
                if cached:
                    return CityResponse(**json.loads(cached))
            except Exception as exc:
                logger.warning("Redis cache read failed for slug", slug=slug, error=str(exc))

        # 2. Database fallback
        doc = await CityDocument.find_one({"slug": slug})
        if not doc:
            raise AppException(f"City with slug '{slug}' not found", status_code=404)

        city = CityResponse(
            id=str(doc.id),
            name=doc.name,
            slug=doc.slug,
            province=doc.province,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

        # 3. Populate Redis cache
        if RedisManager.client:
            try:
                serialized = json.dumps(city.model_dump(mode="json"))
                await RedisManager.client.set(cache_key, serialized, ex=CACHE_TTL_SECONDS)
            except Exception as exc:
                logger.warning("Redis cache write failed for slug", slug=slug, error=str(exc))

        return city
