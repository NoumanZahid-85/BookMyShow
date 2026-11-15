"""
Atomic Redis Hold Engine using Lua scripts
Enforces zero seat double-bookings across concurrent workers.
"""

from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.bootstrap.redis import RedisManager

# Lua script for atomic all-or-nothing multi-seat hold
LUA_MULTI_HOLD = """
for i = 1, #KEYS do
    if redis.call('EXISTS', KEYS[i]) == 1 then
        return 0
    end
end
for i = 1, #KEYS do
    redis.call('SET', KEYS[i], ARGV[1], 'EX', ARGV[2])
end
return 1
"""

# Lua script for token-authenticated seat release
LUA_RELEASE_HOLD = """
local deleted_count = 0
for i = 1, #KEYS do
    if redis.call('GET', KEYS[i]) == ARGV[1] then
        redis.call('DEL', KEYS[i])
        deleted_count = deleted_count + 1
    end
end
return deleted_count
"""

# Lua script to verify all seats belong to this hold before confirmation
LUA_VERIFY_AND_DELETE_HOLD = """
for i = 1, #KEYS do
    if redis.call('GET', KEYS[i]) ~= ARGV[1] then
        return 0
    end
end
for i = 1, #KEYS do
    redis.call('DEL', KEYS[i])
end
return 1
"""


class RedisHoldEngine:
    @staticmethod
    def _get_client():
        if not RedisManager.client:
            logger.error("Redis client is not connected. Failing closed.")
            raise AppException("Seat locking service is temporarily unavailable", status_code=503)
        return RedisManager.client

    @classmethod
    async def acquire_multi_hold(
        cls,
        show_id: str,
        seat_ids: list[str],
        hold_token: str,
        ttl_seconds: int = 600,
    ) -> bool:
        """
        Atomically holds all requested seats or none.
        Returns True if all seats were successfully held, False if any seat is taken.
        """
        client = cls._get_client()
        keys = [f"hold:{show_id}:{seat_id}" for seat_id in seat_ids]

        try:
            result = await client.eval(
                LUA_MULTI_HOLD,
                len(keys),
                *keys,
                hold_token,
                ttl_seconds,
            )
            return result == 1
        except Exception as exc:
            logger.error("Redis Lua multi-hold execution failed", error=str(exc))
            raise AppException("Seat locking service is temporarily unavailable", status_code=503)

    @classmethod
    async def release_hold(
        cls,
        show_id: str,
        seat_ids: list[str],
        hold_token: str,
    ) -> int:
        """
        Releases held seats if and only if hold_token matches.
        """
        client = cls._get_client()
        keys = [f"hold:{show_id}:{seat_id}" for seat_id in seat_ids]

        try:
            deleted_count = await client.eval(
                LUA_RELEASE_HOLD,
                len(keys),
                *keys,
                hold_token,
            )
            return int(deleted_count)
        except Exception as exc:
            logger.error("Redis Lua release execution failed", error=str(exc))
            raise AppException("Seat locking service is temporarily unavailable", status_code=503)

    @classmethod
    async def verify_and_clear_hold(
        cls,
        show_id: str,
        seat_ids: list[str],
        hold_token: str,
    ) -> bool:
        """
        Verifies all seats still belong to the hold token, then clears the hold keys.
        Returns True if hold was valid and cleared; False if any seat expired or was lost.
        """
        client = cls._get_client()
        keys = [f"hold:{show_id}:{seat_id}" for seat_id in seat_ids]

        try:
            result = await client.eval(
                LUA_VERIFY_AND_DELETE_HOLD,
                len(keys),
                *keys,
                hold_token,
            )
            return result == 1
        except Exception as exc:
            logger.error("Redis Lua verify-and-delete execution failed", error=str(exc))
            raise AppException("Seat locking service is temporarily unavailable", status_code=503)

    @classmethod
    async def get_held_seats_for_show(cls, show_id: str) -> dict[str, str]:
        """
        Retrieves all currently active seat holds for a show.
        Returns a dict of {seat_id: hold_token}.
        """
        client = cls._get_client()
        pattern = f"hold:{show_id}:*"
        held_seats = {}

        try:
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    values = await client.mget(keys)
                    for k, v in zip(keys, values):
                        if v:
                            seat_id = k.split(":")[-1]
                            held_seats[seat_id] = v
                if cursor == 0:
                    break
            return held_seats
        except Exception as exc:
            logger.warning("Failed to scan active holds from Redis", error=str(exc))
            return {}
