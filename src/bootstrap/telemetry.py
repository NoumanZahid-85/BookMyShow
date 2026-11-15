import time
from fastapi import FastAPI, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Histogram,
    generate_latest,
)
from src.bootstrap.logger import logger
import src.modules.booking.metrics  # noqa: F401  Registers bms_* metrics on startup

# Global Prometheus HTTP Metrics
http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests handled by the service",
    ["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)


def setup_telemetry(app: FastAPI) -> None:
    try:
        from opentelemetry import trace
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.trace import TracerProvider

        provider = TracerProvider()
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry instrumented successfully")
    except Exception as exc:
        logger.warning("OpenTelemetry instrumentation skipped", error=str(exc))

    @app.middleware("http")
    async def prometheus_metrics_middleware(request: Request, call_next):
        # Exclude internal metrics endpoint to avoid recursive metric inflation
        if request.url.path in ("/metrics", "/metrics/"):
            return await call_next(request)

        start_time = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            duration = time.perf_counter() - start_time
            route = request.scope.get("route")
            endpoint = route.path if route else "unmatched"
            http_requests_total.labels(
                method=request.method,
                endpoint=endpoint,
                status=str(status_code),
            ).inc()
            http_request_duration_seconds.labels(
                method=request.method,
                endpoint=endpoint,
            ).observe(duration)

    # Native Prometheus /metrics endpoint (avoids 307 redirect)
    @app.get("/metrics", include_in_schema=False)
    @app.get("/metrics/", include_in_schema=False)
    def metrics_endpoint():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

