from fastapi import APIRouter, status

from src.features.cities.schemas import CityCreateRequest, CityResponse
from src.features.cities.service import CityService
from src.shared.responses import ApiResponse

router = APIRouter()


@router.post(
    "",
    response_model=ApiResponse[CityResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new city",
)
async def create_city(payload: CityCreateRequest):
    city = await CityService.create_city(payload)
    return ApiResponse(data=city, message="City created successfully")


@router.get(
    "",
    response_model=ApiResponse[list[CityResponse]],
    summary="List all active cities",
)
async def list_cities():
    cities = await CityService.get_all_active_cities()
    return ApiResponse(data=cities, message="Active cities retrieved successfully")


@router.get(
    "/{slug}",
    response_model=ApiResponse[CityResponse],
    summary="Get city by slug",
)
async def get_city(slug: str):
    city = await CityService.get_city_by_slug(slug)
    return ApiResponse(data=city, message="City retrieved successfully")
