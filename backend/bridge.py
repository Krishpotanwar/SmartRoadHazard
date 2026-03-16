"""
bridge.py — Serial-to-API bridge for SmartRoadHazard.

Connects the Wokwi ESP32 simulation to the Flask backend.
Supports two operating modes selected via the --mode argument:

  stdin  — Read sensor output lines from stdin (paste / pipe Wokwi serial log).
  demo   — Auto-generate realistic detections along a Nagpur route (no hardware needed).

Usage:
    python bridge.py --mode stdin   # Pipe or type Wokwi serial output
    python bridge.py --mode demo    # Standalone demo without Wokwi
    python bridge.py                # Defaults to demo mode

Expected serial line format from the ESP32 (sketch.ino):
    POTHOLE,DEEP,21.145823,79.088156
    POTHOLE,MEDIUM,21.146012,79.088445
    SPEEDBREAKER,21.145634,79.087923
    NORMAL                              ← ignored
"""

import argparse
import random
import sys
import time
from datetime import datetime
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_URL = "http://localhost:5001/api/hazards"

# Simulated GPS waypoints along a real Nagpur city route.
NAGPUR_ROUTE = [
    (21.145800, 79.088200),  # Sitabuldi (city centre)
    (21.146200, 79.089100),  # Near Dharampeth
    (21.146800, 79.089800),  # Sadar
    (21.147200, 79.090500),  # Civil Lines
    (21.147800, 79.091200),  # Near High Court
]

# Seconds between synthetic detections in demo mode.
DEMO_INTERVAL = 3

# Max random GPS jitter added to each waypoint (degrees ≈ ±33 m at this latitude).
GPS_JITTER = 0.0003


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _post_detection(
    hazard_type: str,
    severity: Optional[str],
    lat: float,
    lng: float,
) -> None:
    """POST one detection to the Flask API and print the outcome.

    Args:
        hazard_type: 'pothole' or 'speedbreaker'.
        severity:    Pothole depth ('shallow', 'medium', 'deep') or None.
        lat:         Latitude.
        lng:         Longitude.
    """
    payload = {
        "type": hazard_type,
        "severity": severity,
        "lat": lat,
        "lng": lng,
    }

    # Human-readable label for console output.
    label = f"{hazard_type.upper()} {severity.upper() if severity else ''}".strip()
    timestamp = datetime.now().strftime("%H:%M:%S")

    try:
        response = requests.post(API_URL, json=payload, timeout=5)
        response.raise_for_status()
        data = response.json()
        verified = data.get("verified", False)
        count = data.get("detection_count", "?")
        print(
            f"[{timestamp}] Sent: {label} at {lat:.4f}, {lng:.4f} "
            f"→ verified: {verified}  (reports: {count})"
        )
    except requests.exceptions.ConnectionError:
        print(
            f"[{timestamp}] ERROR: Cannot reach {API_URL}. "
            "Is server.py running? (python server.py)"
        )
    except requests.exceptions.Timeout:
        print(f"[{timestamp}] ERROR: Request timed out.")
    except requests.exceptions.HTTPError as exc:
        print(f"[{timestamp}] ERROR: HTTP {exc.response.status_code} — {exc.response.text}")
    except Exception as exc:  # noqa: BLE001
        print(f"[{timestamp}] ERROR: Unexpected error — {exc}")


# ---------------------------------------------------------------------------
# Mode: stdin
# ---------------------------------------------------------------------------

def _parse_line(line: str) -> Optional[tuple[str, Optional[str], float, float]]:
    """Parse one serial output line from the ESP32.

    Returns:
        (type, severity, lat, lng) tuple, or None if line should be skipped.

    Expected formats:
        POTHOLE,DEEP,21.145823,79.088156
        SPEEDBREAKER,21.145634,79.087923
        NORMAL                             ← returns None
    """
    line = line.strip()

    # Skip blank lines and normal readings.
    if not line or line.upper().startswith("NORMAL"):
        return None

    parts = [p.strip() for p in line.split(",")]

    if parts[0].upper() == "POTHOLE":
        # Expected: POTHOLE, severity, lat, lng  (4 fields)
        if len(parts) < 4:
            print(f"  [WARN] Malformed POTHOLE line (expected 4 fields): '{line}'")
            return None
        try:
            return ("pothole", parts[1].lower(), float(parts[2]), float(parts[3]))
        except ValueError:
            print(f"  [WARN] Cannot parse coordinates in: '{line}'")
            return None

    if parts[0].upper() == "SPEEDBREAKER":
        # Expected: SPEEDBREAKER, lat, lng  (3 fields)
        if len(parts) < 3:
            print(f"  [WARN] Malformed SPEEDBREAKER line (expected 3 fields): '{line}'")
            return None
        try:
            return ("speedbreaker", None, float(parts[1]), float(parts[2]))
        except ValueError:
            print(f"  [WARN] Cannot parse coordinates in: '{line}'")
            return None

    # Unknown prefix — skip silently (could be debug output from ESP32).
    return None


def run_stdin_mode() -> None:
    """Read serial lines from stdin and forward each detection to the API.

    How to use:
        1. Open Wokwi in a browser tab and start the simulation.
        2. Copy the serial output and paste it into this terminal, OR
           pipe a file:  cat serial_log.txt | python bridge.py --mode stdin
    """
    print("Stdin mode: paste or pipe Wokwi serial output. Press Ctrl+C to stop.")
    print("-" * 60)

    try:
        for raw_line in sys.stdin:
            parsed = _parse_line(raw_line)
            if parsed:
                hazard_type, severity, lat, lng = parsed
                _post_detection(hazard_type, severity, lat, lng)
    except KeyboardInterrupt:
        print("\nStopped by user.")


# ---------------------------------------------------------------------------
# Mode: demo
# ---------------------------------------------------------------------------

# Probability weights for the three detection outcomes in demo mode.
_DEMO_OUTCOMES = ["pothole", "speedbreaker", "skip"]
_DEMO_OUTCOME_WEIGHTS = [0.60, 0.30, 0.10]

# Pothole severity distribution.
_SEVERITIES = ["shallow", "medium", "deep"]
_SEVERITY_WEIGHTS = [0.40, 0.40, 0.20]


def _random_nearby(lat: float, lng: float) -> tuple[float, float]:
    """Add a small random jitter to simulate vehicle movement."""
    return (
        lat + random.uniform(-GPS_JITTER, GPS_JITTER),
        lng + random.uniform(-GPS_JITTER, GPS_JITTER),
    )


def run_demo_mode() -> None:
    """Simulate a vehicle driving along the Nagpur route and generating detections.

    Cycles through NAGPUR_ROUTE waypoints indefinitely, posting randomised
    detections to the API every DEMO_INTERVAL seconds.  Grey (unverified)
    markers in the frontend will turn coloured after 3 detections at the same
    location — which happens naturally as the route loops.
    """
    print("Demo mode started. Generating detections along Nagpur route...")
    print(f"Route: {len(NAGPUR_ROUTE)} waypoints, interval: {DEMO_INTERVAL}s")
    print("Press Ctrl+C to stop.")
    print("=" * 60)

    waypoint_index = 0

    try:
        while True:
            base_lat, base_lng = NAGPUR_ROUTE[waypoint_index]
            lat, lng = _random_nearby(base_lat, base_lng)

            # Choose what type of event this reading produces.
            outcome = random.choices(_DEMO_OUTCOMES, weights=_DEMO_OUTCOME_WEIGHTS, k=1)[0]

            if outcome == "skip":
                ts = datetime.now().strftime("%H:%M:%S")
                print(f"[{ts}] NORMAL — no hazard at {lat:.4f}, {lng:.4f}")
            elif outcome == "pothole":
                severity = random.choices(_SEVERITIES, weights=_SEVERITY_WEIGHTS, k=1)[0]
                _post_detection("pothole", severity, lat, lng)
            else:  # speedbreaker
                _post_detection("speedbreaker", None, lat, lng)

            # Advance to the next waypoint, wrapping around the end of the route.
            waypoint_index = (waypoint_index + 1) % len(NAGPUR_ROUTE)

            time.sleep(DEMO_INTERVAL)

    except KeyboardInterrupt:
        print("\nDemo mode stopped.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="SmartRoadHazard bridge — sends sensor data to the Flask API.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python bridge.py                  # demo mode (default)\n"
            "  python bridge.py --mode demo      # same as above\n"
            "  python bridge.py --mode stdin     # read from stdin / pipe\n"
            "  cat log.txt | python bridge.py --mode stdin\n"
        ),
    )
    parser.add_argument(
        "--mode",
        choices=["stdin", "demo"],
        default="demo",
        help="Operating mode: 'stdin' (pipe serial output) or 'demo' (auto-generate). Default: demo.",
    )
    args = parser.parse_args()

    if args.mode == "stdin":
        run_stdin_mode()
    else:
        run_demo_mode()


if __name__ == "__main__":
    main()
