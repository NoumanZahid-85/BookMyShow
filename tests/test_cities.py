import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_cities_endpoint_structure(client: AsyncClient):
    response = await client.get("/api/v1/cities")
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "data" in data
    assert isinstance(data["data"], list)


@pytest.mark.asyncio
async def test_metrics_endpoint(client: AsyncClient):
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "bms_hold_success_total" in response.text or "python_gc_objects_collected_total" in response.text
