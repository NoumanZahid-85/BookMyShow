import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
import jwt
from src.bootstrap.config import settings
from src.bootstrap.errors import AppException

PBKDF2_ITERATIONS = 100_000


def hash_password(password: str) -> tuple[str, str]:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with a unique random 16-byte salt.
    Returns (hex_hash, hex_salt).
    """
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return key.hex(), salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """
    Verify a password against stored hex hash and salt using constant-time comparison.
    """
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return hmac.compare_digest(key.hex(), hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"exp": expire, "iat": now, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.refresh_token_expire_days)

    to_encode.update({"exp": expire, "iat": now, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if expected_type and payload.get("type") != expected_type:
            raise AppException(
                f"Invalid token type. Expected {expected_type} token",
                status_code=401,
                details={"code": "INVALID_TOKEN_TYPE"},
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise AppException(
            "Token has expired",
            status_code=401,
            details={"code": "TOKEN_EXPIRED"},
        )
    except jwt.InvalidTokenError:
        raise AppException(
            "Invalid authentication token",
            status_code=401,
            details={"code": "INVALID_TOKEN"},
        )
