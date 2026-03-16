"""
simulator.py — Interactive ESP32 Sensor Simulator
Replaces Wokwi for demo purposes.

Press keys to simulate the HC-SR04 sensor distance and send detections
directly to Flask. No copying, no serial monitor, no Wokwi needed.

Usage:
    python simulator.py

Controls:
    1 → Simulate DEEP pothole    (distance = 50cm)
    2 → Simulate MEDIUM pothole  (distance = 38cm)
    3 → Simulate SHALLOW pothole (distance = 27cm)
    4 → Simulate SPEEDBREAKER    (distance = 10cm)
    5 → Simulate NORMAL road     (distance = 20cm)
    q → Quit
"""

import sys
import time
import random
import requests

API_URL = "http://localhost:5001/api/hazards"
BASELINE = 20.0  # Normal road distance in cm (same as sketch.ino)

# Nagpur base coordinates — same as sketch.ino
BASE_LAT = 21.145800
BASE_LNG = 79.088200

# Route waypoints to cycle through (simulates vehicle moving)
NAGPUR_ROUTE = [
    (21.145800, 79.088200),  # Sitabuldi
    (21.146200, 79.089100),  # Dharampeth
    (21.146800, 79.089800),  # Sadar
    (21.147200, 79.090500),  # Civil Lines
    (21.147800, 79.091200),  # High Court
]
route_index = 0

def get_gps():
    """Return current GPS position with tiny random offset (like sketch.ino)."""
    global route_index
    base_lat, base_lng = NAGPUR_ROUTE[route_index % len(NAGPUR_ROUTE)]
    lat = base_lat + random.randint(-5, 5) / 10000.0
    lng = base_lng + random.randint(-5, 5) / 10000.0
    route_index += 1
    return round(lat, 6), round(lng, 6)

def classify(distance):
    """Same classification logic as sketch.ino."""
    delta = distance - BASELINE
    if delta > 25:
        return "pothole", "deep", delta
    elif delta > 15:
        return "pothole", "medium", delta
    elif delta > 5:
        return "pothole", "shallow", delta
    elif delta < -5:
        return "speedbreaker", None, delta
    else:
        return "normal", None, delta

def send_detection(hazard_type, severity, lat, lng):
    """POST detection to Flask API."""
    try:
        r = requests.post(API_URL, json={
            "type": hazard_type,
            "severity": severity,
            "lat": lat,
            "lng": lng
        }, timeout=3)
        result = r.json()
        count = result.get("detection_count", 1)
        verified = result.get("verified", False)
        return count, verified
    except Exception as e:
        return None, None

def print_oled(hazard_type, severity, distance, delta):
    """Simulate OLED display output in terminal."""
    print("\n  ┌─────────────────────────┐")
    print(f"  │ {hazard_type.upper():<23} │")
    print(f"  │ {('SEVERITY: ' + severity.upper()) if severity else 'RAISED SURFACE':<23} │")
    print(f"  │ Dist: {distance:.1f}cm{'':<14} │")
    print(f"  │ Delta: {delta:+.1f}cm{'':<13} │")
    print("  └─────────────────────────┘")

def print_menu():
    """Print the key controls."""
    print("\n" + "═"*50)
    print("  🚗 SmartRoadHazard — Interactive Simulator")
    print("  Simulates ESP32 + HC-SR04 sensor output")
    print("═"*50)
    print("  Press a key and Enter:")
    print("")
    print("  [1] DEEP POTHOLE     (distance ~50cm)")
    print("  [2] MEDIUM POTHOLE   (distance ~38cm)")
    print("  [3] SHALLOW POTHOLE  (distance ~27cm)")
    print("  [4] SPEEDBREAKER     (distance ~10cm)")
    print("  [5] NORMAL road      (distance ~20cm)")
    print("  [q] Quit")
    print("═"*50)

DISTANCE_MAP = {
    "1": 50.0,   # deep pothole:    delta = +30cm
    "2": 38.0,   # medium pothole:  delta = +18cm
    "3": 27.0,   # shallow pothole: delta = +7cm
    "4": 10.0,   # speedbreaker:    delta = -10cm
    "5": 20.0,   # normal:          delta = 0cm
}

def main():
    print_menu()

    while True:
        try:
            key = input("\n  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n\n  Simulator stopped. Goodbye!")
            break

        if key == "q":
            print("\n  Simulator stopped. Goodbye!")
            break

        if key not in DISTANCE_MAP:
            print("  ⚠️  Invalid key. Use 1-5 or q.")
            continue

        distance = DISTANCE_MAP[key]
        hazard_type, severity, delta = classify(distance)
        lat, lng = get_gps()

        # Print serial output exactly like sketch.ino would
        if hazard_type == "normal":
            serial_line = "NORMAL"
            print(f"\n  Serial → {serial_line}")
            print_oled("NORMAL", "road ok", distance, delta)
            print("\n  ℹ️  No hazard detected.")
            continue

        if hazard_type == "pothole":
            serial_line = f"POTHOLE,{severity.upper()},{lat},{lng}"
        else:
            serial_line = f"SPEEDBREAKER,{lat},{lng}"

        print(f"\n  Serial → {serial_line}")
        print_oled(hazard_type, severity or "—", distance, delta)

        # Send to Flask
        print(f"\n  📡 Sending to Flask API...")
        count, verified = send_detection(hazard_type, severity, lat, lng)

        if count is None:
            print("  ✗ Could not reach Flask. Is server.py running?")
            print("    Run: python server.py")
        else:
            bar = "█" * count + "░" * (3 - min(count, 3))
            status = "✅ VERIFIED — marker now colored on map!" if verified else f"⏳ [{bar}] {count}/3 detections"
            print(f"  {status}")

        if verified:
            emoji = {"deep": "🔴", "medium": "🟠", "shallow": "🟡"}.get(severity, "🔵")
            print(f"\n  {emoji} New marker on map at ({lat}, {lng})")
            if hazard_type == "pothole" and severity in ("deep", "medium"):
                print("  ⚠️  HAZARD SHADOW ALERT fired on dashboard!")

if __name__ == "__main__":
    main()
