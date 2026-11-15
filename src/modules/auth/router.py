from fastapi import APIRouter, Depends, status
from src.modules.auth.dependencies import get_current_user
from src.modules.auth.models import UserDocument
from src.modules.auth.schemas import (
    RefreshTokenRequest,
    TokenRefreshResponse,
    TokenResponse,
    UserLoginRequest,
    UserProfileResponse,
    UserRegisterRequest,
)
from src.modules.auth.service import AuthService

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new customer account",
)
async def register(payload: UserRegisterRequest):
    return await AuthService.register(payload)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate user and return JWT tokens",
)
async def login(payload: UserLoginRequest):
    return await AuthService.login(payload)


@router.post(
    "/refresh",
    response_model=TokenRefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh an expired access token using refresh token",
)
async def refresh_token(payload: RefreshTokenRequest):
    return await AuthService.refresh_access_token(payload)


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get profile of currently authenticated user",
)
async def get_my_profile(current_user: UserDocument = Depends(get_current_user)):
    return await AuthService.get_user_profile(current_user.user_id)
