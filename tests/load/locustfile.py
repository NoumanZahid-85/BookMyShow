"""
Locust Stress & Load Testing Suite for BookMyShow (Pakistan Edition)

Simulates realistic human user browsing journeys on a single machine:
  1. User arrives and browses Pakistani cities.
  2. User pauses to read city options (1 - 2.5 seconds).
  3. User selects a cinema and checks available screens.
  4. User views show schedules and ticket prices.

Usage:
  1. Web UI Mode:
     uv run locust -f tests/load/locustfile.py --host http://localhost:8000
     Then open http://localhost:8089 in your browser.

  2. Automated Headless Run (500 users, ramp 25/sec, run 30s):
     uv run locust -f tests/load/locustfile.py --headless -u 500 -r 25 -t 30s --host http://localhost:8000
"""

import random
from locust import HttpUser, task, between


class BookMyShowStressUser(HttpUser):
    # Realistic human browsing wait time (1 to 2.5 seconds between clicks)
    # Prevents single-machine CPU exhaustion while simulating heavy user load
    wait_time = between(1.0, 2.5)

    def on_start(self):
        self.cached_cities = []
        self.cached_cinemas = []
        # Pre-fetch cities on user session start
        res = self.client.get("/api/v1/cities", name="/api/v1/cities [Init]")
        if res.status_code == 200:
            payload = res.json()
            self.cached_cities = payload.get("data", [])

    @task(5)
    def browse_cities(self):
        """Browse active cities (Karachi, Lahore, Islamabad, etc.)."""
        self.client.get("/api/v1/cities", name="/api/v1/cities")

    @task(4)
    def view_city_by_slug(self):
        """Lookup city details by slug."""
        if self.cached_cities:
            city = random.choice(self.cached_cities)
            self.client.get(f"/api/v1/cities/{city['slug']}", name="/api/v1/cities/[slug]")
        else:
            slugs = ["karachi", "lahore", "islamabad", "rawalpindi", "faisalabad"]
            slug = random.choice(slugs)
            self.client.get(f"/api/v1/cities/{slug}", name="/api/v1/cities/[slug]")

    @task(4)
    def browse_cinemas_by_city(self):
        """Browse cinemas in a selected city."""
        if self.cached_cities:
            city = random.choice(self.cached_cities)
            res = self.client.get(
                f"/api/v1/cinemas/city/{city['id']}",
                name="/api/v1/cinemas/city/[city_id]",
            )
            if res.status_code == 200:
                cinemas = res.json().get("data", [])
                if cinemas:
                    self.cached_cinemas = cinemas

    @task(3)
    def browse_shows_for_cinema(self):
        """View available movie shows for a selected cinema."""
        if self.cached_cinemas:
            cinema = random.choice(self.cached_cinemas)
            self.client.get(
                f"/api/v1/shows/cinema/{cinema['id']}",
                name="/api/v1/shows/cinema/[cinema_id]",
            )

    @task(1)
    def health_check(self):
        """Monitor server health status."""
        self.client.get("/health", name="/health")
