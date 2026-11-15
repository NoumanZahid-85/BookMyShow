import json
from bson import ObjectId
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.bootstrap.redis import RedisManager
from src.features.cinemas.models import CinemaDocument
from src.features.shows.models import ShowDocument
from src.features.shows.schemas import ShowCreateRequest, ShowResponse, ShowUpdateRequest

CACHE_KEY_SHOWS_BY_CINEMA_PREFIX = "cache:shows:cinema:"
CACHE_KEY_SHOW_ID_PREFIX = "cache:show:id:"
CACHE_TTL_SECONDS = 300  # 5 minutes


class ShowService:
    @staticmethod
    async def create_show(payload: ShowCreateRequest) -> ShowResponse:
        try:
            cinema_exists = await CinemaDocument.get(ObjectId(payload.cinema_id))
        except Exception:
            cinema_exists = None

        if not cinema_exists:
            raise AppException("Cinema referenced by cinema_id does not exist", status_code=404)

        doc = ShowDocument(
            movie_title=payload.movie_title,
            cinema_id=payload.cinema_id,
            screen_number=payload.screen_number,
            start_time=payload.start_time,
            end_time=payload.end_time,
            base_price=payload.base_price,
            total_seats=payload.total_seats,
            available_seats=payload.total_seats,
            is_active=True,
        )
        await doc.insert()

        # Invalidate shows cache for this cinema
        if RedisManager.client:
            try:
                await RedisManager.client.delete(f"{CACHE_KEY_SHOWS_BY_CINEMA_PREFIX}{payload.cinema_id}")
            except Exception as exc:
                logger.warning("Redis cache invalidation failed for shows", error=str(exc))

        return ShowResponse(
            id=str(doc.id),
            movie_title=doc.movie_title,
            cinema_id=doc.cinema_id,
            screen_number=doc.screen_number,
            start_time=doc.start_time,
            end_time=doc.end_time,
            base_price=doc.base_price,
            total_seats=doc.total_seats,
            available_seats=doc.available_seats,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

    @staticmethod
    async def get_shows_by_cinema(cinema_id: str) -> list[ShowResponse]:
        cache_key = f"{CACHE_KEY_SHOWS_BY_CINEMA_PREFIX}{cinema_id}"

        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(cache_key)
                if cached:
                    raw_items = json.loads(cached)
                    return [ShowResponse(**item) for item in raw_items]
            except Exception as exc:
                logger.warning("Redis cache read failed for shows", cinema_id=cinema_id, error=str(exc))

        # 2. Database query
        docs = await ShowDocument.find({"cinema_id": cinema_id, "is_active": True}).to_list()
        shows = [
            ShowResponse(
                id=str(doc.id),
                movie_title=doc.movie_title,
                cinema_id=doc.cinema_id,
                screen_number=doc.screen_number,
                start_time=doc.start_time,
                end_time=doc.end_time,
                base_price=doc.base_price,
                total_seats=doc.total_seats,
                available_seats=doc.available_seats,
                is_active=doc.is_active,
                created_at=doc.created_at,
            )
            for doc in docs
        ]

        # 3. Populate Redis cache
        if RedisManager.client and shows:
            try:
                serialized = json.dumps([s.model_dump(mode="json") for s in shows])
                await RedisManager.client.set(cache_key, serialized, ex=CACHE_TTL_SECONDS)
            except Exception as exc:
                logger.warning("Redis cache write failed for shows", cinema_id=cinema_id, error=str(exc))

        return shows

    @staticmethod
    async def get_show_by_id(show_id: str) -> ShowResponse:
        cache_key = f"{CACHE_KEY_SHOW_ID_PREFIX}{show_id}"

        # 1. Check Redis cache first
        if RedisManager.client:
            try:
                cached = await RedisManager.client.get(cache_key)
                if cached:
                    return ShowResponse(**json.loads(cached))
            except Exception as exc:
                logger.warning("Redis cache read failed for show id", show_id=show_id, error=str(exc))

        # 2. Database query
        try:
            doc = await ShowDocument.get(ObjectId(show_id))
        except Exception:
            doc = None

        if not doc:
            raise AppException("Show not found", status_code=404)

        show = ShowResponse(
            id=str(doc.id),
            movie_title=doc.movie_title,
            cinema_id=doc.cinema_id,
            screen_number=doc.screen_number,
            start_time=doc.start_time,
            end_time=doc.end_time,
            base_price=doc.base_price,
            total_seats=doc.total_seats,
            available_seats=doc.available_seats,
            is_active=doc.is_active,
            created_at=doc.created_at,
        )

        # 3. Populate Redis cache
        if RedisManager.client:
            try:
                serialized = json.dumps(show.model_dump(mode="json"))
                await RedisManager.client.set(cache_key, serialized, ex=CACHE_TTL_SECONDS)
            except Exception as exc:
                logger.warning("Redis cache write failed for show id", show_id=show_id, error=str(exc))

        return show

    @staticmethod
    async def _load(show_id: str) -> ShowDocument:
        try:
            doc = await ShowDocument.get(ObjectId(show_id))
        except Exception:
            doc = None
        if not doc or not doc.is_active:
            raise AppException("Show not found", status_code=404)
        return doc

    @staticmethod
    async def _invalidate(doc: ShowDocument) -> None:
        if RedisManager.client:
            try:
                await RedisManager.client.delete(
                    f"{CACHE_KEY_SHOWS_BY_CINEMA_PREFIX}{doc.cinema_id}",
                    f"{CACHE_KEY_SHOW_ID_PREFIX}{doc.id}",
                )
            except Exception as exc:
                logger.warning("Redis cache invalidation failed for show", show_id=str(doc.id), error=str(exc))

    @classmethod
    async def update_show(cls, show_id: str, payload: ShowUpdateRequest) -> ShowResponse:
        doc = await cls._load(show_id)
        for field, value in payload.model_dump(exclude_none=True).items():
            setattr(doc, field, value)
        if doc.end_time <= doc.start_time:
            raise AppException("end_time must be strictly after start_time", status_code=422)
        await doc.save()
        await cls._invalidate(doc)
        return ShowResponse.model_validate({**doc.model_dump(), "id": str(doc.id)})

    @classmethod
    async def deactivate_show(cls, show_id: str) -> None:
        """Soft delete: existing bookings and tickets keep pointing at a real show."""
        doc = await cls._load(show_id)
        doc.is_active = False
        await doc.save()
        await cls._invalidate(doc)
