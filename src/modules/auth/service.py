import uuid
from src.bootstrap.config import settings
from src.bootstrap.errors import AppException
from src.bootstrap.logger import logger
from src.modules.auth.models import UserDocument, UserRole
from src.modules.auth.schemas import (
    RefreshTokenRequest,
    TokenRefreshResponse,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)
from src.modules.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


DEMO_ADMIN_EMAIL = "admin@cinema.com"
DEMO_ADMIN_PASSWORD = "demo-admin-123"


class AuthService:
    @classmethod
    async def ensure_demo_admin(cls) -> None:
        """Development only: registration always creates customers, so the demo needs one seeded admin."""
        if settings.app_env != "development":
            return
        if await UserDocument.find_one({"email": DEMO_ADMIN_EMAIL}):
            return
        hashed, salt = hash_password(DEMO_ADMIN_PASSWORD)
        await UserDocument(
            user_id="usr_demo_admin",
            email=DEMO_ADMIN_EMAIL,
            hashed_password=hashed,
            salt=salt,
            full_name="Demo Admin",
            role=UserRole.ADMIN,
            is_active=True,
        ).insert()
        logger.info("Demo admin account created", email=DEMO_ADMIN_EMAIL)

    @classmethod
    async def register(cls, payload: UserRegisterRequest) -> TokenResponse:
        email_clean = payload.email.lower().strip()
        existing = await UserDocument.find_one({"email": email_clean})
        if existing:
            raise AppException(
                "An account with this email already exists",
                status_code=409,
                details={"code": "EMAIL_ALREADY_EXISTS"},
            )

        hashed, salt = hash_password(payload.password)
        user_id = f"usr_{uuid.uuid4().hex[:12]}"

        user = UserDocument(
            user_id=user_id,
            email=email_clean,
            hashed_password=hashed,
            salt=salt,
            full_name=payload.full_name,
            phone=payload.phone,
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        await user.insert()
        logger.info("New user registered successfully", user_id=user_id, email=email_clean)

        token_data = {"sub": user_id, "email": email_clean, "role": user.role.value}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        user_profile = UserProfileResponse(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            created_at=user.created_at,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_profile,
        )

    @classmethod
    async def login(cls, payload: UserLoginRequest) -> TokenResponse:
        email_clean = payload.email.lower().strip()
        user = await UserDocument.find_one({"email": email_clean})
        if not user or not user.is_active:
            raise AppException(
                "Invalid email or password",
                status_code=401,
                details={"code": "INVALID_CREDENTIALS"},
            )

        if not verify_password(payload.password, user.hashed_password, user.salt):
            raise AppException(
                "Invalid email or password",
                status_code=401,
                details={"code": "INVALID_CREDENTIALS"},
            )

        token_data = {"sub": user.user_id, "email": user.email, "role": user.role.value}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        user_profile = UserProfileResponse(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            created_at=user.created_at,
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_profile,
        )

    @classmethod
    async def refresh_access_token(cls, payload: RefreshTokenRequest) -> TokenRefreshResponse:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
        user_id = decoded.get("sub")
        if not user_id:
            raise AppException("Invalid token payload", status_code=401)

        user = await UserDocument.find_one({"user_id": user_id})
        if not user or not user.is_active:
            raise AppException("User inactive or no longer exists", status_code=401)

        token_data = {"sub": user.user_id, "email": user.email, "role": user.role.value}
        new_access_token = create_access_token(token_data)

        return TokenRefreshResponse(access_token=new_access_token)

    @classmethod
    async def get_user_profile(cls, user_id: str) -> UserProfileResponse:
        user = await UserDocument.find_one({"user_id": user_id})
        if not user:
            raise AppException("User not found", status_code=404)

        return UserProfileResponse(
            user_id=user.user_id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=user.role,
            created_at=user.created_at,
        )
