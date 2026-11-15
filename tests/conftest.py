import pytest
from httpx import ASGITransport, AsyncClient
from src.bootstrap import create_app
from src.bootstrap.database import DatabaseManager
from src.bootstrap.redis import RedisManager
from src.modules.auth.models import UserDocument, UserRole
from src.modules.auth.security import create_access_token


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app):
    try:
        await DatabaseManager.connect()
    except Exception:
        pass

    try:
        await RedisManager.connect()
    except Exception:
        pass

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    try:
        await DatabaseManager.disconnect()
    except Exception:
        pass

    try:
        await RedisManager.disconnect()
    except Exception:
        pass


async def auth_headers(user_id: str, role: UserRole = UserRole.CUSTOMER) -> dict[str, str]:
    """Bearer header for a test user, created on first use. Booking routes take the user from the token."""
    if not await UserDocument.find_one({"user_id": user_id}):
        await UserDocument(
            user_id=user_id,
            email=f"{user_id}@test.local",
            hashed_password="test-only",
            salt="test-only",
            full_name=f"Test {user_id}",
            role=role,
        ).insert()
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}
