"""
Lightweight CLI High-Traffic Generator for BookMyShow
Sends concurrent requests to drive Prometheus & Grafana live charts without Locust.

Run with:
  uv run python scripts/traffic_generator.py --requests 1000 --concurrency 50
"""

import argparse
import asyncio
import random
import time
import uuid
import httpx

SHOW_ID = "6af7a2cfa53a3153f66bdd75"
BASE_URL = "http://localhost:8000"


async def worker(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    stats: dict,
    target_requests: int,
):
    rows = ["A", "B", "C", "D", "E", "F", "G", "H"]

    while stats["sent"] < target_requests:
        stats["sent"] += 1
        choice = random.random()

        async with semaphore:
            try:
                # 1. 50% Seat Map Queries
                if choice < 0.50:
                    res = await client.get(f"{BASE_URL}/api/v1/shows/{SHOW_ID}/seats")
                    stats["seats_map"] += 1

                # 2. 30% Seat Hold Attempts (Triggers success / conflict counters)
                elif choice < 0.80:
                    row = random.choice(rows)
                    num = random.randint(1, 15)
                    seat_id = f"{row}{num:02d}"

                    res = await client.post(
                        f"{BASE_URL}/api/v1/shows/{SHOW_ID}/hold",
                        json={
                            "seat_ids": [seat_id],
                            "idempotency_key": str(uuid.uuid4()),
                        },
                    )
                    if res.status_code == 200:
                        stats["hold_success"] += 1
                    elif res.status_code == 409:
                        stats["hold_conflict"] += 1
                    else:
                        stats["errors"] += 1

                # 3. 15% Cities and Catalog Queries
                elif choice < 0.95:
                    res = await client.get(f"{BASE_URL}/api/v1/cities")
                    stats["cities"] += 1

                # 4. 5% Health Check
                else:
                    res = await client.get(f"{BASE_URL}/health")
                    stats["health"] += 1

            except Exception:
                stats["errors"] += 1


async def run_traffic(total_requests: int, concurrency: int):
    print("=" * 60)
    print("Starting High-Traffic Generator")
    print(f"Target: {BASE_URL}")
    print(f"Total Requests: {total_requests} | Concurrency: {concurrency}")
    print("Watch Grafana (:3000) and Prometheus (:9090) in real time!")
    print("=" * 60)

    stats = {
        "sent": 0,
        "seats_map": 0,
        "hold_success": 0,
        "hold_conflict": 0,
        "cities": 0,
        "health": 0,
        "errors": 0,
    }

    semaphore = asyncio.Semaphore(concurrency)
    start_time = time.perf_counter()

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Seat holds need a signed-in customer: register one throwaway load-test user.
        reg = await client.post(
            f"{BASE_URL}/api/v1/auth/register",
            json={"email": f"load-{uuid.uuid4().hex[:8]}@example.com", "password": "Load-test-pass1", "full_name": "Load Test"},
        )
        reg.raise_for_status()
        client.headers["Authorization"] = f"Bearer {reg.json()['access_token']}"
        tasks = [
            worker(client, semaphore, stats, total_requests)
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)

    duration = time.perf_counter() - start_time
    rps = stats["sent"] / duration if duration > 0 else 0

    print("\n" + "=" * 60)
    print("Traffic Generation Completed")
    print(f"Duration: {duration:.2f} seconds | Throughput: {rps:.1f} RPS")
    print(f"Seat Map Lookups:  {stats['seats_map']}")
    print(f"Seat Hold Wins:    {stats['hold_success']}")
    print(f"Seat Hold Blocks:  {stats['hold_conflict']}")
    print(f"City Lookups:      {stats['cities']}")
    print(f"Health Checks:     {stats['health']}")
    print(f"Errors / Timeouts: {stats['errors']}")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CLI Traffic Generator")
    parser.add_argument(
        "--requests", type=int, default=1000, help="Total requests to send"
    )
    parser.add_argument(
        "--concurrency", type=int, default=50, help="Concurrent workers"
    )
    args = parser.parse_args()

    asyncio.run(run_traffic(args.requests, args.concurrency))
