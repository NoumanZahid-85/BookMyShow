import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_register_and_login_flow(client: AsyncClient):
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "SuperSecurePassword123!"

    # 1. Register new user
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": password,
            "full_name": "Hamza Tariq",
            "phone": "+923001234567",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert "refresh_token" in reg_data
    assert reg_data["user"]["email"] == unique_email
    assert reg_data["user"]["full_name"] == "Hamza Tariq"
    user_id = reg_data["user"]["user_id"]

    # 2. Duplicate registration attempt must fail with 409
    dup_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": password,
            "full_name": "Duplicate User",
        },
    )
    assert dup_res.status_code == 409

    # 3. Login with wrong password must fail with 401
    bad_login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": "WrongPassword!",
        },
    )
    assert bad_login_res.status_code == 401

    # 4. Login with correct password must succeed
    login_res = await client.post(
        "/api/v1/auth/login",
        json={
            "email": unique_email,
            "password": password,
        },
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]
    assert login_data["user"]["user_id"] == user_id

    # 5. Access protected /me endpoint with Bearer token
    me_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["user_id"] == user_id
    assert me_data["email"] == unique_email

    # 6. Access protected /me endpoint without token must fail with 401
    unauth_res = await client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401

    # 7. Refresh access token using refresh_token
    ref_res = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert ref_res.status_code == 200
    assert "access_token" in ref_res.json()
