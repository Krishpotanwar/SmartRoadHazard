"""
send_serial.py — Paste Wokwi serial output here, then run this script.

Usage:
  1. Copy ALL text from Wokwi serial monitor (Ctrl+A, Ctrl+C)
  2. Run:  python send_serial.py
  3. Paste when prompted, then press Ctrl+D (Mac) to finish
  4. Script sends every valid line to Flask

OR paste lines directly into the SERIAL_DATA string below and run the script.
"""

import sys
import requests

API_URL = "http://localhost:5001/api/hazards"

# ── Option A: Hardcode lines here for instant demo ────────────
# Just replace these with lines copied from Wokwi serial monitor
SERIAL_DATA = """
POTHOLE,DEEP,21.145823,79.088156
POTHOLE,DEEP,21.145801,79.088199
POTHOLE,DEEP,21.145812,79.088207
SPEEDBREAKER,21.146012,79.088445
SPEEDBREAKER,21.146034,79.088421
SPEEDBREAKER,21.146001,79.088460
POTHOLE,MEDIUM,21.146200,79.089100
POTHOLE,MEDIUM,21.146210,79.089110
POTHOLE,MEDIUM,21.146195,79.089090
""".strip()

def send_line(line):
    """Parse one CSV line and POST it to the Flask API."""
    line = line.strip()
    if not line or line.startswith("NORMAL") or line.startswith("Calibrating") or line.startswith("Ready") or line.startswith("Smart"):
        return  # skip non-detection lines

    parts = line.split(",")
    try:
        if parts[0] == "POTHOLE" and len(parts) == 4:
            data = {"type": "pothole", "severity": parts[1].lower(), "lat": float(parts[2]), "lng": float(parts[3])}
        elif parts[0] == "SPEEDBREAKER" and len(parts) == 3:
            data = {"type": "speedbreaker", "severity": None, "lat": float(parts[1]), "lng": float(parts[2])}
        else:
            print(f"  skip: {line}")
            return

        r = requests.post(API_URL, json=data, timeout=3)
        result = r.json()
        verified = "✅ VERIFIED!" if result.get("verified") else f"⏳ count={result.get('detection_count',1)}"
        print(f"  ✓ {parts[0]} {data.get('severity','') or ''} → {verified}")
    except Exception as e:
        print(f"  ✗ Error sending '{line}': {e}")

def main():
    print("\n🚗 SmartRoadHazard — Serial Sender")
    print("====================================")

    # Check if piped input or use hardcoded data
    if not sys.stdin.isatty():
        # Data piped in
        lines = sys.stdin.read().splitlines()
        print(f"Sending {len(lines)} lines from stdin...\n")
    else:
        print("Using hardcoded SERIAL_DATA (edit send_serial.py to change lines)\n")
        print("TIP: You can also pipe Wokwi output:")
        print("     pbpaste | python send_serial.py\n")
        lines = SERIAL_DATA.splitlines()

    for line in lines:
        send_line(line)

    print("\n✅ Done! Check the map dashboard.")

if __name__ == "__main__":
    main()
