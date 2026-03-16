# SmartRoadHazard - Project Status
Last updated: 2026-03-17
Built by: Claude Code
Developer: Krish Potanwar, Ramdeobaba University, Nagpur

## Current Status
PRODUCTION READY — Firebase RTDB + Koyeb deployment (dual-mode)

## What This Project Does
A full-stack IoT simulation that detects road hazards (potholes and speedbreakers) using
an HC-SR04 ultrasonic sensor on an ESP32 (simulated in Wokwi browser). Detections are
parsed by a Python bridge script, stored in a local SQLite database via a Flask API, and
displayed as live color-coded markers on a Google Maps web dashboard centered on Nagpur.

## Files Created
| File | Status | Purpose |
|------|--------|---------|
| wokwi/sketch.ino       | Done | ESP32 code: baseline calibration, delta classification, GPS sim, serial output, OLED + LEDs |
| wokwi/diagram.json     | Done | Wokwi circuit: ESP32 + HC-SR04 + SSD1306 + 3 LEDs + resistors, all wired |
| backend/database.py    | Done | SQLite init, add_detection with Haversine (15m radius), crowd verification at count≥3 |
| backend/server.py      | Done | Flask REST API, 5 endpoints, CORS enabled for file:// origin |
| backend/bridge.py      | Done | stdin mode (parse Wokwi CSV) + demo mode (auto-generate Nagpur route detections) |
| backend/requirements.txt | Done | flask, flask-cors, pyserial, requests |
| frontend/index.html    | Done | Full layout: header, sidebar stats+legend+reset, map area, alert bar |
| frontend/map.js        | Done | Google Maps init, 2s polling, marker mgmt, shadow alerts, stats update |
| frontend/style.css     | Done | Dark theme, sidebar, aubergine map complement, pulse animation, alert bar |
| README.md              | Done | Full setup guide, API reference, Wokwi instructions, demo-day scenarios |
| .gitignore             | Done | Excludes hazards.db, __pycache__, .DS_Store, .env |

## How To Run RIGHT NOW
```bash
# Terminal 1 — Start Flask backend
cd backend && pip install -r requirements.txt && python server.py

# Terminal 2 — Start demo bridge
cd backend && python bridge.py --mode demo

# Browser — Open dashboard
open frontend/index.html
```

**IMPORTANT**: Replace `YOUR_GOOGLE_MAPS_API_KEY` in `frontend/index.html` line ~175
with a real key from https://console.cloud.google.com/ to see the map.

## Architecture In One Paragraph
The HC-SR04 sensor on the ESP32 (Wokwi simulation) measures distance to the road
surface every 500ms. The delta from a calibrated baseline classifies the reading as
POTHOLE (deep/medium/shallow) or SPEEDBREAKER and prints a CSV line to Serial. The
Python bridge.py reads this (stdin mode) or generates synthetic data (demo mode) and
POSTs each detection to Flask running at localhost:5000. Flask delegates to database.py
which uses the Haversine formula to find hazards within 15m — incrementing their
detection_count and flipping verified=1 once count≥3 (crowd verification). The frontend
polls GET /api/hazards/all every 2 seconds, renders color-coded Google Maps markers
(red=deep, orange=medium, yellow=shallow, blue=speedbreaker, grey=unverified), and shows
a bottom-bar shadow alert for newly verified deep/medium potholes.

## Key Decisions Made
- SQLite instead of Firebase: fully local, no internet needed for demo
- HC-SR04 used as LiDAR substitute: only sensor Wokwi supports for distance
- Haversine radius = 15m for crowd verification proximity matching
- Polling interval = 2000ms (setInterval) for live map updates
- No frontend frameworks: plain HTML/JS only per project rules
- CORS enabled on Flask to allow requests from file:// origin
- Demo mode auto-generates data along 5 Nagpur waypoints so project works without Wokwi

## Koyeb Deployment + Full Cleanup (2026-03-17)
- Removed: send_serial.py, railway.json, stdin bridge mode, pyserial
- Added: koyeb.yaml, cleaned Procfile (--workers 1 --timeout 120)
- sketch.ino: renamed postToRailway→postDetection, SERVER_URL (Koyeb), condensed comments
- map.js: API_BASE → Koyeb placeholder, vehicle marker + trail intact
- index.html: title → "SmartRoadHazard — Nagpur"
- style.css: fixed duplicate/invalid color in #last-updated, added .vehicle-popup
- bridge.py: stdin mode removed, SMARTROAD_API env var override
- simulator.py: SMARTROAD_API env var, shows API target in header
- database.py: removed debug print statements, fixed SQL pattern in get_stats()
- README.md: removed Google Maps + Railway + stdin refs, fully updated
- DEPLOYMENT.md: switched to Koyeb guide (free forever, no credit card)
- Security audit: 1 issue fixed (f-string in get_stats SQL → static queries)
- URL placeholder: search YOUR-KOYEB-APP in sketch.ino + map.js to replace after deploy

## Railway Deployment (added 2026-03-17 — superseded by Koyeb)
- Deployment status: RAILWAY READY
- Railway files added: backend/Procfile, backend/runtime.txt, backend/railway.json
- gunicorn added to requirements.txt
- New endpoints: GET /api/vehicle, POST /api/vehicle
- sketch.ino now has WiFi (Wokwi-GUEST) + HTTP POST to Railway
- map.js now shows 🚗 moving vehicle marker + green dashed trail
- See DEPLOYMENT.md for step-by-step Railway setup
- URL placeholders: search "YOUR-RAILWAY-URL" in all files to replace after deploy

## Known Issues / TODO
- Google Maps API key is placeholder (map now uses Leaflet/OpenStreetMap — no key needed)
- Railway URL placeholders must be replaced after deploying (search YOUR-RAILWAY-URL)
- Wokwi WebSocket direct bridge not implemented (demo mode + stdin mode cover demo day)
- No auth on Flask API (acceptable for local college demo)
- hazards.db is gitignored and auto-created on first `python server.py` run
- SQLite resets on Railway redeploy (fine for demo)

## Firebase Integration (added 2026-03-17)
- Firebase project: `smartroadhazard` (RTDB at smartroadhazard-default-rtdb.firebaseio.com)
- sketch.ino: pushToFirebase() + pushVehiclePosition() after every detection
- map.js: dual-mode — MODE='firebase' uses real-time RTDB listeners (no server needed)
- map.js: MODE='local' polls Flask at localhost:5001
- index.html: Firebase compat SDK v9.23.0 CDN scripts added
- See FIREBASE_SETUP.md for setup steps
- Real credentials already set in sketch.ino and map.js

## If You Are Resuming This Project
1. Read this file and DEPLOYMENT.md
2. Local demo: `python server.py` + `python bridge.py` + open `frontend/index.html`
   (change API_BASE in map.js to http://localhost:5001 for local)
3. Deploy to internet: follow DEPLOYMENT.md step by step
4. After getting Koyeb URL: replace YOUR-KOYEB-APP in sketch.ino and map.js
