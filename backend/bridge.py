"""
bridge.py — Demo data generator for SmartRoadHazard.

Simulates a vehicle driving along a Nagpur route and auto-generates hazard
detections every 3 seconds. No Wokwi or serial connection needed.

Usage:
    python bridge.py           # connects to localhost:5001
    SMARTROAD_API=https://YOUR-APP.koyeb.app python bridge.py   # cloud target

The ESP32 (Wokwi) now POSTs directly via WiFi — this script is only needed
for demo mode when Wokwi is not running.
"""

import os
import random
import time
from datetime import datetime
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Override with SMARTROAD_API env variable to point at a deployed Koyeb instance.
API_URL = os.environ.get("SMARTROAD_API", "http://localhost:5001") + "/api/hazards"

NAGPUR_ROUTE = [
    (21.145800, 79.088200),  # Sitabuldi
    (21.146200, 79.089100),  # Dharampeth
    (21.146800, 79.089800),  # Sadar
    (21.147200, 79.090500),  # Civil Lines
    (21.147800, 79.091200),  # High Court
]

DEMO_INTERVAL = 3   # seconds between synthetic detections
GPS_JITTER    = 0.0003  # ±degrees (~33m) of random GPS offset per reading

_OUTCOMES         = ["pothole", "speedbreaker", "skip"]
_OUTCOME_WEIGHTS  = [0.60, 0.30, 0.10]
_SEVERITIES       = ["shallow", "medium", "deep"]
_SEVERITY_WEIGHTS = [0.40, 0.40, 0.20]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_nearby(lat: float, lng: float) -> tuple[float, float]:
    """Add small GPS jitter to simulate vehicle movement."""
    return (
        lat + random.uniform(-GPS_JITTER, GPS_JITTER),
        lng + random.uniform(-GPS_JITTER, GPS_JITTER),
    )


def _post(hazard_type: str, severity: Optional[str], lat: float, lng: float) -> None:
    """POST one detection to the Flask API."""
    payload = {"type": hazard_type, "severity": severity, "lat": lat, "lng": lng}
    label = f"{hazard_type.upper()} {severity.upper() if severity else ''}".strip()
    ts = datetime.now().strftime("%H:%M:%S")
    try:
        r = requests.post(API_URL, json=payload, timeout=5)
        r.raise_for_status()
        data = r.json()
        print(f"[{ts}] {label} at {lat:.4f},{lng:.4f} → verified:{data.get('verified')} ({data.get('detection_count')})")
    except requests.exceptions.ConnectionError:
        print(f"[{ts}] ERROR: Cannot reach {API_URL}. Is server.py running?")
    except requests.exceptions.Timeout:
        print(f"[{ts}] ERROR: Request timed out.")
    except Exception as exc:
        print(f"[{ts}] ERROR: {exc}")


# ---------------------------------------------------------------------------
# Demo mode
# ---------------------------------------------------------------------------

def run_demo() -> None:
    """Simulate a vehicle driving the Nagpur route and generating detections."""
    base_url = os.environ.get("SMARTROAD_API", "http://localhost:5001")
    print(f"Demo mode → {base_url}")
    print(f"Route: {len(NAGPUR_ROUTE)} waypoints, interval: {DEMO_INTERVAL}s  (Ctrl+C to stop)")
    print("=" * 60)

    idx = 0
    try:
        while True:
            lat, lng = _random_nearby(*NAGPUR_ROUTE[idx])
            outcome = random.choices(_OUTCOMES, weights=_OUTCOME_WEIGHTS, k=1)[0]

            if outcome == "skip":
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] NORMAL at {lat:.4f},{lng:.4f}")
            elif outcome == "pothole":
                severity = random.choices(_SEVERITIES, weights=_SEVERITY_WEIGHTS, k=1)[0]
                _post("pothole", severity, lat, lng)
            else:
                _post("speedbreaker", None, lat, lng)

            idx = (idx + 1) % len(NAGPUR_ROUTE)
            time.sleep(DEMO_INTERVAL)

    except KeyboardInterrupt:
        print("\nDemo stopped.")


if __name__ == "__main__":
    run_demo()
