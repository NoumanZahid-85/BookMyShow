"""
Prometheus Metrics for Seat Booking and Locking Engine
"""

from prometheus_client import Counter, Gauge

# Unlabeled counters initialize immediately to 0 at server start
hold_success_total = Counter(
    "bms_hold_success_total",
    "Total number of successfully acquired seat holds",
)

hold_conflict_total = Counter(
    "bms_hold_conflict_total",
    "Total number of seat hold conflicts (seat already held/booked)",
)

hold_expired_total = Counter(
    "bms_hold_expired_total",
    "Total number of holds that expired before confirmation",
)

confirm_after_expiry_total = Counter(
    "bms_confirm_after_expiry_total",
    "Total number of confirm attempts made after hold expiration",
)

active_holds_gauge = Gauge(
    "bms_active_holds",
    "Current number of seats actively held in Redis",
)

