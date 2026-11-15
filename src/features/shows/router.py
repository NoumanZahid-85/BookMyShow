from fastapi import APIRouter, Depends, status
from src.features.shows.schemas import ShowCreateRequest, ShowResponse, ShowUpdateRequest
from src.modules.auth.dependencies import require_admin
from src.features.shows.service import ShowService
from src.shared.responses import ApiResponse

router = APIRouter()


@router.post(
    "",
    response_model=ApiResponse[ShowResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a new movie show (admin)",
    dependencies=[Depends(require_admin)],
)
async def create_show(payload: ShowCreateRequest):
    show = await ShowService.create_show(payload)
    return ApiResponse(data=show, message="Show created successfully")


@router.get(
    "/cinema/{cinema_id}",
    response_model=ApiResponse[list[ShowResponse]],
    summary="List all shows for a cinema",
)
async def list_shows_by_cinema(cinema_id: str):
    shows = await ShowService.get_shows_by_cinema(cinema_id)
    return ApiResponse(data=shows, message="Shows retrieved successfully")


@router.get(
    "/{show_id}",
    response_model=ApiResponse[ShowResponse],
    summary="Get show details by ID",
)
async def get_show(show_id: str):
    show = await ShowService.get_show_by_id(show_id)
    return ApiResponse(data=show, message="Show retrieved successfully")


@router.patch(
    "/{show_id}",
    response_model=ApiResponse[ShowResponse],
    summary="Update a show (admin)",
    dependencies=[Depends(require_admin)],
)
async def update_show(show_id: str, payload: ShowUpdateRequest):
    show = await ShowService.update_show(show_id, payload)
    return ApiResponse(data=show, message="Show updated successfully")


@router.delete(
    "/{show_id}",
    response_model=ApiResponse[dict],
    summary="Cancel a show (admin, soft delete)",
    dependencies=[Depends(require_admin)],
)
async def delete_show(show_id: str):
    await ShowService.deactivate_show(show_id)
    return ApiResponse(data={"id": show_id}, message="Show cancelled successfully")
