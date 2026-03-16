# Smart Road Hazard Detection & Alert System

A full-stack IoT simulation project that detects road hazards (potholes and speedbreakers) using an HC-SR04 ultrasonic sensor simulated in Wokwi, processes data through a Python/Flask backend, stores it in a local SQLite database, and displays live hazard markers on a Google Maps web dashboard.

**Built by:** Krish Potanwar | Ramdeobaba University, Nagpur | B.Tech CSE (AI & ML)

---

## 3 Unique Innovations

1. **Depth Classification** — Potholes are classified as Shallow / Medium / Deep based on the distance delta from baseline road surface (5 cm, 15 cm, 25 cm thresholds).
2. **Crowd Verification** — A hazard is only published to the map after 3 or more independent vehicle detections at the same GPS location (within a 15-meter radius). Prevents false positives.
3. **Hazard Shadow Alerting** — When a verified deep or medium hazard is detected, a real-time alert notification is shown on the dashboard to warn nearby drivers about hazards that may be hidden behind large vehicles.

---

## Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- A modern browser (Chrome, Firefox, Edge)
- (Optional) A free Wokwi account at [wokwi.com](https://wokwi.com) for hardware simulation

---

## Setup

1. Clone or download this project to your machine.
2. Navigate to the backend directory:
   ```bash
   cd SmartRoadHazard/backend
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

That's it. The SQLite database (`hazards.db`) is created automatically on first run — no additional database setup needed.

---

## How to Run

Open three separate terminals:

```bash
# Terminal 1 — Start Flask backend
cd backend && python server.py
```

```bash
# Terminal 2 — Start demo bridge (auto-generates detections)
cd backend && python bridge.py --mode demo
```

```bash
# Browser — Open dashboard (Mac)
open frontend/index.html
```

On Windows/Linux, open `frontend/index.html` directly in your browser instead of using `open`.

The Flask API runs at `http://localhost:5000`. The dashboard polls it every 2 seconds. Watch grey (unverified) markers turn colored as the detection count reaches 3.

---

## Google Maps API Key

The dashboard requires a Google Maps JavaScript API key. The free tier is sufficient for this project.

**Steps to get a free key:**

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com) and sign in with your Google account.
2. Create a new project (e.g., "SmartRoadHazard").
3. Navigate to **APIs & Services** → **Library**.
4. Search for **Maps JavaScript API** and click **Enable**.
5. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**.
6. Copy the generated key.

**Where to paste it:**

Open `frontend/index.html` and find this line near the bottom:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&callback=initMap" async defer></script>
```

Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual key.

> Note: For a college demo on localhost, you can leave the key unrestricted. For any public deployment, restrict the key to your domain in the Google Cloud Console.

---

## How to Use with Wokwi

1. Go to [wokwi.com](https://wokwi.com) and sign in (free account).
2. Click **New Project** → select **ESP32**.
3. Open `wokwi/sketch.ino` in this project and copy its entire contents into the Wokwi code editor.
4. Click the **diagram.json** tab in Wokwi and replace its contents with the contents of `wokwi/diagram.json` from this project.
5. Open the **Library Manager** (book icon) and add:
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
6. Click the green **Run** button to start the simulation.
7. Click on the HC-SR04 sensor and drag its distance slider:
   - Slider at ~45 cm → deep pothole detection
   - Slider at ~25 cm → medium pothole detection
   - Slider at ~8 cm → speedbreaker detection
   - Slider at ~20 cm → normal road (no output)
8. Watch the Serial Monitor panel for CSV output lines like `POTHOLE,DEEP,21.145823,79.088156`.
9. Copy those lines and pipe them into the bridge in stdin mode:
   ```bash
   cd backend && python bridge.py --mode stdin
   # Then paste the serial output lines and press Enter
   ```

---

## How to Use Demo Mode (Without Wokwi)

If Wokwi is unavailable or you want a quick demonstration:

```bash
cd backend && python bridge.py --mode demo
```

- The bridge automatically generates realistic detections every 3 seconds along a Nagpur city route (Sitabuldi → Dharampeth → Sadar → Civil Lines → High Court area).
- Open `frontend/index.html` in your browser and watch markers appear on the map.
- Grey markers (unverified) gradually turn colored once the detection count reaches 3 for a location.
- Deep pothole detections trigger the Hazard Shadow Alert notification bar.
- Use the **Reset** button on the dashboard to clear all data and start fresh.

---

## API Reference

All endpoints are served at `http://localhost:5000`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hazards` | All verified hazards (detection_count >= 3) |
| GET | `/api/hazards/all` | All hazards including unverified |
| POST | `/api/hazards` | Add a new detection `{type, severity, lat, lng}` |
| GET | `/api/stats` | Statistics: total, verified, potholes, speedbreakers, by severity |
| DELETE | `/api/hazards` | Clear all hazard records (use for demo reset) |

**Example POST body:**
```json
{
  "type": "pothole",
  "severity": "deep",
  "lat": 21.145823,
  "lng": 79.088156
}
```

**Example GET /api/stats response:**
```json
{
  "total": 12,
  "verified": 8,
  "potholes": 9,
  "speedbreakers": 3,
  "deep": 3,
  "medium": 4,
  "shallow": 2
}
```

---

## Test Scenarios for Demo Day

### Scenario 1 — Pothole Detection (Wokwi)
- Set HC-SR04 slider to 45 cm in Wokwi.
- Serial monitor prints `POTHOLE,DEEP,21.14xxxx,79.08xxxx`.
- After 3 detections at the same location, a red marker appears on the Nagpur map.

### Scenario 2 — Speedbreaker Detection (Wokwi)
- Set HC-SR04 slider to 8 cm in Wokwi.
- Serial monitor prints `SPEEDBREAKER,21.14xxxx,79.08xxxx`.
- After 3 detections, a blue marker appears on the map.

### Scenario 3 — Crowd Verification (Demo Mode)
- Run `python bridge.py --mode demo`.
- Observe grey (unverified) markers appearing first.
- As detection count reaches 3, markers transition to their color-coded verified state.
- Demonstrates the anti-false-positive crowd verification system.

### Scenario 4 — Hazard Shadow Alert
- When a deep pothole is verified (3+ detections), the alert bar at the bottom of the dashboard displays:
  `⚠️ DEEP POTHOLE detected — Hazard Shadow Alert active!`
- The alert auto-dismisses after 5 seconds.
- Demonstrates the innovation of warning nearby drivers about hidden hazards.

---

## Project Structure

```
SmartRoadHazard/
├── CLAUDE.md                  ← Claude Code instructions
├── README.md                  ← this file
├── .gitignore
├── wokwi/
│   ├── sketch.ino             ← ESP32 Arduino code
│   └── diagram.json           ← Wokwi circuit layout
├── backend/
│   ├── bridge.py              ← Wokwi serial bridge + demo data generator
│   ├── server.py              ← Flask REST API server
│   ├── database.py            ← SQLite operations + crowd verification logic
│   ├── requirements.txt       ← Python dependencies
│   └── hazards.db             ← auto-created on first run (not committed)
└── frontend/
    ├── index.html             ← main web dashboard
    ├── map.js                 ← Google Maps logic + live polling
    └── style.css              ← dashboard styling
```

---

## Team Members

| Name | Role | University ID |
|------|------|---------------|
| | | |
| | | |
| | | |

*(Fill in your details here before submission)*

---

## License

This project is developed for academic purposes at Ramdeobaba University, Nagpur.
