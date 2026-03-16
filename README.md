# Smart Road Hazard Detection & Alert System

A full-stack IoT simulation that detects road hazards using an HC-SR04 ultrasonic sensor
on an ESP32 (simulated in Wokwi), processes data through a Python/Flask backend, stores
it in SQLite, and displays live markers on a Leaflet map dashboard.

**Built by:** Krish Potanwar | Ramdeobaba University, Nagpur | B.Tech CSE (AI & ML)

---

## 3 Unique Innovations

1. **Depth Classification** — Potholes graded Shallow / Medium / Deep by distance delta (5 / 15 / 25 cm thresholds).
2. **Crowd Verification** — Hazard only published after 3+ independent detections within a 15 m radius. Prevents false positives.
3. **Hazard Shadow Alert** — Verified deep/medium potholes trigger a dashboard notification to warn nearby drivers.

---

## Prerequisites

- Python 3.10+
- pip
- Modern browser (Chrome, Firefox, Edge)
- (Optional) Free Wokwi account at [wokwi.com](https://wokwi.com)

---

## Quick Start (Local)

```bash
# Terminal 1 — Start Flask backend
cd backend && pip install -r requirements.txt && python server.py

# Terminal 2 — Generate demo detections
cd backend && python bridge.py

# Browser — Open dashboard
open frontend/index.html   # Mac
# OR double-click frontend/index.html on Windows/Linux
```

The dashboard polls `http://localhost:5001` every 2 seconds.
Watch grey (unverified) markers turn colored as detection count reaches 3.

> **Note:** `frontend/map.js` defaults to the Koyeb cloud URL. Change `API_BASE` to
> `http://localhost:5001` for local testing.

---

## Firebase Mode (Real IoT — No Server Needed)

The cleanest demo: ESP32 in Wokwi sends detections directly to Firebase → your browser shows them live. No server to deploy or maintain.

```
ESP32 (Wokwi) → Firebase RTDB → Browser (real-time)
```

**One-time setup (5 minutes):**
See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for complete instructions.

**After setup, just:**
1. Run Wokwi simulation
2. Open `frontend/index.html` with `MODE = 'firebase'` in `map.js`
3. Drag HC-SR04 slider → pin appears on map instantly!

---

## Interactive Simulator

A keyboard-driven simulator replaces Wokwi for instant demo:

```bash
cd backend && python simulator.py
```

Press **1** (deep pothole), **2** (medium), **3** (shallow), **4** (speedbreaker), **5** (normal), **q** (quit).

---

## Using Wokwi (Real IoT Simulation)

1. Go to [wokwi.com](https://wokwi.com) → New Project → ESP32
2. Paste `wokwi/sketch.ino` into the code editor
3. Replace `diagram.json` with `wokwi/diagram.json`
4. Install libraries: `Adafruit SSD1306` and `Adafruit GFX Library`
5. Click **Run**
6. Drag the HC-SR04 slider: `~45 cm` = deep pothole, `~8 cm` = speedbreaker, `~20 cm` = normal
7. ESP32 POSTs detections directly to your Koyeb server via WiFi

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full cloud deployment guide.

---

## API Reference

All endpoints at `http://localhost:5001` (or your Koyeb URL).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hazards` | Verified hazards (count >= 3) |
| GET | `/api/hazards/all` | All hazards including pending |
| POST | `/api/hazards` | Add detection `{type, severity, lat, lng}` |
| GET | `/api/stats` | Total, verified, by type and severity |
| DELETE | `/api/hazards` | Clear all (demo reset) |
| GET | `/api/vehicle` | Last known vehicle position |
| POST | `/api/vehicle` | Update vehicle position |

---

## Demo Day Scenarios

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Deep pothole | Slider to 45 cm in Wokwi | Red pin on Nagpur map after 3 detections |
| Speedbreaker | Slider to 8 cm | Blue pin after 3 detections |
| Crowd verification | Run `bridge.py` | Grey -> colored marker transition |
| Shadow alert | Deep pothole verified | Alert bar: DEEP POTHOLE — Hazard Shadow Alert! |

---

## Project Structure

```
SmartRoadHazard/
├── CLAUDE.md
├── README.md
├── DEPLOYMENT.md          <- Koyeb cloud deployment guide
├── .gitignore
├── wokwi/
│   ├── sketch.ino         <- ESP32 code (sensor + WiFi HTTP POST)
│   └── diagram.json       <- Wokwi circuit layout
├── backend/
│   ├── server.py          <- Flask REST API (7 endpoints)
│   ├── database.py        <- SQLite + Haversine crowd verification
│   ├── bridge.py          <- Demo data generator
│   ├── simulator.py       <- Interactive keyboard simulator
│   ├── requirements.txt
│   ├── Procfile           <- Koyeb/gunicorn start command
│   ├── runtime.txt        <- Python version pin
│   ├── koyeb.yaml         <- Koyeb deploy config
│   └── hazards.db         <- auto-created on first run (gitignored)
└── frontend/
    ├── index.html         <- Dashboard
    ├── map.js             <- Leaflet map + live polling + vehicle tracker
    └── style.css          <- Dark theme styling
```

---

## Team Members

| Name | Role | University ID |
|------|------|---------------|
| | | |
| | | |

*(Fill in before submission)*

---

## License

Academic project — Ramdeobaba University, Nagpur.
