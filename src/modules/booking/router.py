from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from src.modules.booking.schemas import (
    BookingResponse,
    SeatConfirmRequest,
    SeatHoldRequest,
    SeatHoldResponse,
    SeatMapResponse,
    SeatReleaseRequest,
)
from src.modules.auth.dependencies import get_current_user, require_admin
from src.modules.auth.models import UserDocument
from src.modules.booking.service import BookingService
from src.modules.booking.websocket import seat_ws_manager
from src.shared.responses import ApiResponse

router = APIRouter()


@router.websocket("/shows/{show_id}/seats/stream")
async def seat_stream_websocket(websocket: WebSocket, show_id: str):
    await seat_ws_manager.connect(show_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        seat_ws_manager.disconnect(show_id, websocket)



@router.get(
    "/shows/{show_id}/seats",
    response_model=ApiResponse[SeatMapResponse],
    summary="Get live auditorium seat map with availability",
)
async def get_seats(show_id: str):
    seat_map = await BookingService.get_seat_map(show_id)
    return ApiResponse(data=seat_map, message="Seat map retrieved successfully")


@router.post(
    "/shows/{show_id}/hold",
    response_model=ApiResponse[SeatHoldResponse],
    status_code=status.HTTP_200_OK,
    summary="Atomically hold 1 to 6 seats for 10 minutes",
)
async def hold_seats(
    show_id: str,
    payload: SeatHoldRequest,
    user: UserDocument = Depends(get_current_user),
):
    payload.user_id = user.user_id  # the token decides who holds, never the request body
    result = await BookingService.hold_seats(show_id, payload)
    return ApiResponse(data=result, message="Seats held successfully")


@router.post(
    "/shows/{show_id}/release",
    response_model=ApiResponse[dict],
    summary="Release active seat hold",
)
async def release_seats(
    show_id: str,
    payload: SeatReleaseRequest,
    user: UserDocument = Depends(get_current_user),
):
    payload.user_id = user.user_id
    result = await BookingService.release_seats(show_id, payload)
    return ApiResponse(data=result, message="Seats released successfully")


@router.post(
    "/shows/{show_id}/confirm",
    response_model=ApiResponse[BookingResponse],
    status_code=status.HTTP_200_OK,
    summary="Confirm booking and transition hold to permanent reservation",
)
async def confirm_booking(
    show_id: str,
    payload: SeatConfirmRequest,
    user: UserDocument = Depends(get_current_user),
):
    payload.user_id = user.user_id
    booking = await BookingService.confirm_booking(show_id, payload)
    return ApiResponse(data=booking, message="Booking confirmed successfully")


@router.get(
    "/bookings/user/my-bookings",
    response_model=ApiResponse[list[BookingResponse]],
    summary="Get all bookings belonging to the current user",
)
async def get_my_bookings(user: UserDocument = Depends(get_current_user)):
    bookings = await BookingService.get_user_bookings(user.user_id)
    return ApiResponse(data=bookings, message="User bookings retrieved successfully")


@router.get(
    "/bookings/{booking_id}",
    response_model=ApiResponse[BookingResponse],
    summary="Get booking details",
)
async def get_booking(
    booking_id: str,
    user: UserDocument = Depends(get_current_user),
):
    booking = await BookingService.get_booking_by_id(booking_id, user.user_id)
    return ApiResponse(data=booking, message="Booking details retrieved successfully")


@router.get(
    "/rankings",
    response_model=ApiResponse[dict],
    summary="Top movies and shows by tickets sold in the last N days",
)
async def get_rankings(days: int = Query(default=7, ge=1, le=90), city_id: str | None = None):
    rankings = await BookingService.get_rankings(days, city_id=city_id)
    return ApiResponse(data=rankings, message="Rankings retrieved successfully")


@router.get(
    "/admin/sales",
    response_model=ApiResponse[dict],
    summary="Tickets and revenue per day and per show hour (admin)",
    dependencies=[Depends(require_admin)],
)
async def get_sales(days: int = Query(default=7, ge=1, le=90), cinema_id: str | None = None):
    summary = await BookingService.get_sales_summary(days, cinema_id)
    return ApiResponse(data=summary, message="Sales summary retrieved successfully")
