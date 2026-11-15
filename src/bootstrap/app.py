from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from src.bootstrap.config import settings
from src.bootstrap.cors import setup_cors
from src.bootstrap.database import DatabaseManager
from src.bootstrap.errors import setup_error_handlers
from src.bootstrap.logger import configure_logger, logger
from src.bootstrap.redis import RedisManager
from src.bootstrap.telemetry import setup_telemetry

# Import Feature and Module Routers
from src.features.cities.router import router as cities_router
from src.features.cinemas.router import router as cinemas_router
from src.features.shows.router import router as shows_router
from src.modules.auth.router import router as auth_router
from src.modules.auth.service import AuthService
from src.modules.booking.router import router as booking_router
from src.modules.payment.router import router as payment_router
from src.modules.ticket.router import router as ticket_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Starting up BookMyShow service...", app_name=settings.app_name)
    try:
        await DatabaseManager.connect()
        await AuthService.ensure_demo_admin()
    except Exception as exc:
        logger.error("Failed to connect to MongoDB", error=str(exc))

    try:
        await RedisManager.connect()
    except Exception as exc:
        logger.error("Failed to connect to Redis", error=str(exc))

    yield

    # Shutdown sequence
    logger.info("Shutting down BookMyShow service...")
    await DatabaseManager.disconnect()
    await RedisManager.disconnect()


def create_app() -> FastAPI:
    # 1. Configure Logging
    configure_logger()

    # 2. Instantiate FastAPI with orjson for ultra-fast serialization
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="High-concurrency movie and event ticket booking API",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # 3. Setup Middlewares and Handlers
    setup_cors(app)
    setup_error_handlers(app)
    setup_telemetry(app)

    # 4. Health Check Endpoint
    @app.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.app_name,
            "environment": settings.app_env,
        }

    # 5. Register Feature and Module Routers
    api_prefix = "/api/v1"
    app.include_router(auth_router, prefix=f"{api_prefix}/auth", tags=["Auth"])
    app.include_router(cities_router, prefix=f"{api_prefix}/cities", tags=["Cities"])
    app.include_router(cinemas_router, prefix=f"{api_prefix}/cinemas", tags=["Cinemas"])
    app.include_router(shows_router, prefix=f"{api_prefix}/shows", tags=["Shows"])
    app.include_router(booking_router, prefix=api_prefix, tags=["Booking"])
    app.include_router(payment_router, prefix=f"{api_prefix}/payments", tags=["Payments"])
    app.include_router(ticket_router, prefix=f"{api_prefix}/tickets", tags=["Tickets"])

    return app
