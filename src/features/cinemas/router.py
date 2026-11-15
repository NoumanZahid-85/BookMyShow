from fastapi import APIRouter, status
from src.features.cinemas.schemas import CinemaCreateRequest, CinemaResponse
from src.features.cinemas.service import CinemaService
from src.shared.responses import ApiResponse

router = APIRouter()


@router.post(
    "",
    response_model=ApiResponse[CinemaResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register a new cinema",
)
async def create_cinema(payload: CinemaCreateRequest):
    cinema = await CinemaService.create_cinema(payload)
    return ApiResponse(data=cinema, message="Cinema created successfully")


@router.get(
    "/city/{city_id}",
    response_model=ApiResponse[list[CinemaResponse]],
    summary="List cinemas in a specific city",
)
async def list_cinemas_by_city(city_id: str):
    cinemas = await CinemaService.get_cinemas_by_city(city_id)
    return ApiResponse(data=cinemas, message="Cinemas retrieved successfully")


@router.get(
    "/{cinema_id}",
    response_model=ApiResponse[CinemaResponse],
    summary="Get cinema details by ID",
)
async def get_cinema(cinema_id: str):
    cinema = await CinemaService.get_cinema_by_id(cinema_id)
    return ApiResponse(data=cinema, message="Cinema retrieved successfully")
