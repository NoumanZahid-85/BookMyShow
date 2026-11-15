from fastapi import Depends, Header
from src.bootstrap.errors import AppException
from src.modules.auth.models import UserDocument, UserRole
from src.modules.auth.security import decode_token


async def get_current_user(authorization: str | None = Header(default=None)) -> UserDocument:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppException(
            "Missing or malformed Authorization header. Bearer token required.",
            status_code=401,
            details={"code": "AUTHENTICATION_REQUIRED"},
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_token(token, expected_type="access")
    user_id = payload.get("sub")

    if not user_id:
        raise AppException("Invalid token subject", status_code=401)

    user = await UserDocument.find_one({"user_id": user_id, "is_active": True})
    if not user:
        raise AppException(
            "User not found or account is deactivated",
            status_code=401,
            details={"code": "USER_NOT_FOUND"},
        )

    return user


async def get_optional_current_user(
    authorization: str | None = Header(default=None),
) -> UserDocument | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = decode_token(token, expected_type="access")
        user_id = payload.get("sub")
        if not user_id:
            return None
        return await UserDocument.find_one({"user_id": user_id, "is_active": True})
    except Exception:
        return None


async def require_admin(user: UserDocument = Depends(get_current_user)) -> UserDocument:
    if user.role != UserRole.ADMIN:
        raise AppException(
            "Administrator role required",
            status_code=403,
            details={"code": "ADMIN_REQUIRED"},
        )
    return user
