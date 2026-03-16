# 🚗 Smart Road Hazard Detection & Alert System
## Claude Code Instructions — Read This Fully Before Writing Any Code

---

## 🧠 Who You Are Working With

- **Developer:** Krish Potanwar
- **Course:** B.Tech CSE (AI & ML), Ramdeobaba University, Nagpur
- **Purpose:** Graded college project — must be fully functional and demonstrable
- **Experience Level:** Intermediate — understands Python, basic web dev, Arduino C++
- **Machine:** MacOS (Apple Silicon / Intel Mac)

---

## 📌 Project Overview

This is a **full-stack IoT simulation project** that detects road hazards (potholes and speedbreakers) using an HC-SR04 ultrasonic sensor simulated in **Wokwi**, processes the data through a **Python backend**, stores it in a **local SQLite database**, and displays live hazard markers on a **Google Maps web dashboard**.

**The system has 3 unique innovations:**
1. **Depth Classification** — Shallow / Medium / Deep pothole based on distance delta
2. **Crowd Verification** — Hazard only published after 3+ vehicle detections at same GPS location
3. **Hazard Shadow Alerting** — Alert nearby vehicles about hazards hidden behind large vehicles

---

## 🗂️ Exact Project Folder Structure to Create

```
SmartRoadHazard/
├── CLAUDE.md                  ← this file
├── README.md                  ← setup instructions for humans
├── wokwi/
│   ├── sketch.ino             ← ESP32 Arduino code
│   └── diagram.json           ← Wokwi circuit layout
├── backend/
│   ├── bridge.py              ← reads Wokwi serial output → pushes to DB
│   ├── server.py              ← Flask REST API server
│   ├── database.py            ← all SQLite operations
│   ├── requirements.txt       ← Python dependencies
│   └── hazards.db             ← auto-created on first run (DO NOT commit)
├── frontend/
│   ├── index.html             ← main web dashboard
│   ├── map.js                 ← Google Maps logic + live polling
│   └── style.css              ← clean professional styling
└── .gitignore
```

---

## 🔌 How The System Works — Data Flow

```
[Wokwi Browser Tab]
  HC-SR04 slider dragged by user
         ↓
  ESP32 reads distance in cm
  Calculates delta from baseline (20cm)
  Classifies hazard type + severity
  Gets GPS coordinates (hardcoded simulation)
  Prints to Serial: "POTHOLE,DEEP,21.145800,79.088200"
         ↓
[bridge.py on Mac — runs in terminal]
  Connects to Wokwi via WebSocket
  OR reads from stdin (pipe mode for demo)
  Parses CSV line
  Applies crowd verification logic
  Saves to SQLite via database.py
         ↓
[server.py — Flask at localhost:5000]
  GET  /api/hazards        → all verified hazards
  GET  /api/hazards/all    → all including unverified
  POST /api/hazards        → add new detection (used by bridge.py)
  GET  /api/stats          → count of potholes, speedbreakers, verified
  DELETE /api/hazards      → clear all (for demo reset)
         ↓
[frontend/index.html — open in browser]
  Google Maps centered on Nagpur (21.1458, 79.0882)
  Polls /api/hazards every 2 seconds
  Shows color-coded markers:
    🔴 Red    = Deep pothole (verified)
    🟠 Orange = Medium pothole (verified)
    🟡 Yellow = Shallow pothole (verified)
    🔵 Blue   = Speedbreaker (verified)
    ⚪ Grey   = Unverified (pending more detections)
  Shows live stats panel (total detections, verified count)
  Shows hazard shadow alerts as popup notifications
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Simulation | Wokwi (browser) + ESP32 | Latest |
| Embedded | Arduino C++ | — |
| Serial Bridge | Python + pyserial | 3.10+ |
| Backend | Flask | 3.x |
| Database | SQLite3 | Built into Python |
| Frontend | HTML5 + Vanilla JS | — |
| Maps | Google Maps JavaScript API | v3 |
| Real-time | setInterval polling (2s) | — |

---

## 📡 Wokwi Circuit — `wokwi/diagram.json`

Build this exact circuit:

| Component | Wokwi Part ID | Purpose |
|---|---|---|
| ESP32 Dev Board | `wokwi-esp32-devkit-v1` | Main microcontroller |
| HC-SR04 | `wokwi-hc-sr04` | Distance sensor (LiDAR substitute) |
| SSD1306 OLED | `board-ssd1306` | Display hazard info |
| Red LED | `wokwi-led` color=red | Deep pothole indicator |
| Yellow LED | `wokwi-led` color=yellow | Shallow/medium indicator |
| Blue LED | `wokwi-led` color=blue | Speedbreaker indicator |
| Resistors 220Ω | `wokwi-resistor` | LED current limiting |

**Pin Connections:**
```
HC-SR04 VCC  → ESP32 VIN (5V)
HC-SR04 GND  → ESP32 GND
HC-SR04 TRIG → ESP32 GPIO 5
HC-SR04 ECHO → ESP32 GPIO 18

OLED VCC → ESP32 3.3V
OLED GND → ESP32 GND
OLED SDA → ESP32 GPIO 21
OLED SCL → ESP32 GPIO 22

Red LED    → 220Ω → ESP32 GPIO 15
Yellow LED → 220Ω → ESP32 GPIO 2
Blue LED   → 220Ω → ESP32 GPIO 4
```

---

## 🔧 ESP32 Code — `wokwi/sketch.ino`

### Must implement these features:

1. **Baseline calibration** — first 10 readings averaged = normal road distance
2. **Delta calculation** — current reading minus baseline
3. **Classification logic:**
   ```
   delta > +25cm  → POTHOLE, DEEP
   delta > +15cm  → POTHOLE, MEDIUM
   delta > +5cm   → POTHOLE, SHALLOW
   delta < -5cm   → SPEEDBREAKER
   |delta| < 5cm  → NORMAL (no output)
   ```
4. **GPS simulation** — hardcode Nagpur coordinates with tiny random offset per reading:
   ```cpp
   float baseLat = 21.145800;
   float baseLng = 79.088200;
   // Add small random offset: +/- 0.0005 to simulate vehicle movement
   ```
5. **Serial output format** — MUST be exactly this CSV:
   ```
   POTHOLE,DEEP,21.145823,79.088156
   POTHOLE,MEDIUM,21.146012,79.088445
   SPEEDBREAKER,21.145634,79.087923
   NORMAL
   ```
6. **OLED display** — show last detected hazard type and severity
7. **LED indicators:**
   - Red blinks 3x → Deep pothole
   - Yellow blinks 2x → Shallow/Medium
   - Blue blinks 2x → Speedbreaker
8. **Reading rate** — every 500ms (2 readings per second)
9. **Cooldown** — after detecting a hazard, wait 3 seconds before next detection (avoid duplicate entries for same pothole)

### Libraries needed (add to Wokwi Library Manager):
```
Adafruit SSD1306
Adafruit GFX Library
```

---

## 🐍 Python Backend

### `backend/database.py`

Create SQLite database with this schema:

```sql
CREATE TABLE hazards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,              -- 'pothole' or 'speedbreaker'
    severity TEXT,                   -- 'shallow', 'medium', 'deep', null for speedbreaker
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    detection_count INTEGER DEFAULT 1,
    verified INTEGER DEFAULT 0,      -- 0 = unverified, 1 = verified
    first_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_detected TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved INTEGER DEFAULT 0       -- 0 = active, 1 = resolved
);
```

**Key functions to implement:**
- `init_db()` — create tables if not exist
- `add_detection(type, severity, lat, lng)` — add or increment existing nearby hazard
- `get_verified_hazards()` — return all verified=1 hazards
- `get_all_hazards()` — return all hazards including unverified
- `get_stats()` — return counts by type and verification status
- `clear_all()` — delete all records (for demo reset)
- `mark_resolved(id)` — mark a hazard as resolved

**Crowd verification logic inside `add_detection()`:**
```python
# Check if hazard already exists within 15 meter radius
# If yes: increment detection_count
# If detection_count >= 3: set verified = 1
# If no: insert as new unverified hazard
# Use Haversine formula for distance calculation between GPS points
```

---

### `backend/bridge.py`

This script connects Wokwi to the database. It should support TWO modes:

**Mode 1 — Stdin mode (for demo, pipe Wokwi output):**
```bash
python bridge.py --mode stdin
# Then paste/pipe Wokwi serial output into terminal
```

**Mode 2 — Auto demo mode (generates realistic test data):**
```bash
python bridge.py --mode demo
# Automatically generates detections along a Nagpur route every 3 seconds
# Useful when Wokwi serial bridge isn't set up
```

The demo mode should simulate a vehicle driving along a real Nagpur road:
```python
NAGPUR_ROUTE = [
    (21.145800, 79.088200),  # Start - Sitabuldi
    (21.146200, 79.089100),  # Near Dharampeth
    (21.146800, 79.089800),  # Sadar
    (21.147200, 79.090500),  # Civil Lines
    (21.147800, 79.091200),  # Near High Court
]
```

**Parsing logic for stdin mode:**
```python
# Parse lines like: "POTHOLE,DEEP,21.145823,79.088156"
# Call POST /api/hazards with parsed data
# Print confirmation to terminal
# Skip lines that start with "NORMAL" or are empty
```

---

### `backend/server.py`

Flask server with these exact endpoints:

```
GET  /api/hazards
     Returns: JSON array of verified hazards
     Each hazard: {id, type, severity, lat, lng, detection_count, verified, first_detected}

GET  /api/hazards/all  
     Returns: all hazards including unverified

POST /api/hazards
     Body: {type, severity, lat, lng}
     Action: calls database.add_detection()
     Returns: {success, message, verified}

GET  /api/stats
     Returns: {total, verified, potholes, speedbreakers, deep, medium, shallow}

DELETE /api/hazards
     Action: clears all hazards
     Returns: {success, message}
```

**Important Flask config:**
```python
# Enable CORS for frontend to call API
# Use port 5000
# Debug mode ON for development
# Add CORS headers to all responses
```

---

### `backend/requirements.txt`

```
flask==3.0.0
flask-cors==4.0.0
pyserial==3.5
requests==2.31.0
```

---

## 🗺️ Frontend — `frontend/index.html`

### Layout:
```
┌─────────────────────────────────────────┐
│  🚗 Smart Road Hazard Detection System  │
│  [Live] ● Nagpur, Maharashtra           │
├──────────────┬──────────────────────────┤
│  STATS PANEL │                          │
│              │    GOOGLE MAPS           │
│  Total: 12   │    (full remaining area) │
│  Verified: 8 │                          │
│  Potholes: 9 │    Color-coded pins      │
│  Speedbrkr:3 │    Click pin = popup     │
│              │    with hazard details   │
│  [LEGEND]    │                          │
│  🔴 Deep     │                          │
│  🟠 Medium   │                          │
│  🟡 Shallow  │                          │
│  🔵 Speedbkr │                          │
│  ⚪ Pending  │                          │
│              │                          │
│  [RESET BTN] │                          │
└──────────────┴──────────────────────────┘
│  ⚠️ ALERT NOTIFICATION BAR (bottom)    │
└─────────────────────────────────────────┘
```

### Must implement in `frontend/map.js`:

1. **Google Maps initialization** — centered on Nagpur (21.1458, 79.0882), zoom 14
2. **Polling** — call `GET /api/hazards/all` every 2000ms
3. **Marker management** — add new markers, don't duplicate existing ones (track by id)
4. **Marker colors:**
   ```javascript
   const MARKER_COLORS = {
     'deep': '🔴',        // red circle
     'medium': '🟠',      // orange circle  
     'shallow': '🟡',     // yellow circle
     'speedbreaker': '🔵', // blue circle
     'unverified': '⚪'   // grey circle
   }
   ```
5. **Info window on marker click** — show: type, severity, detection count, verified status, timestamp
6. **Stats panel update** — live count updates every poll
7. **Hazard shadow alert** — if a new deep/medium hazard appears, show notification bar:
   ```
   ⚠️ DEEP POTHOLE detected at [location] — Hazard Shadow Alert active!
   ```
   Auto-dismiss after 5 seconds.
8. **Map style** — use Google Maps "Aubergine" or "Dark" style for cool look
9. **Google Maps API key** — use a placeholder `YOUR_GOOGLE_MAPS_API_KEY` with a comment explaining how to get one for free

---

## 📝 README.md — Must Include

Write a clear README with these sections:
1. Project description (2-3 lines)
2. Prerequisites (Python 3.10+, pip, browser)
3. Setup steps (numbered, exact commands)
4. How to run (3 terminal commands)
5. How to use with Wokwi (step by step)
6. How to use demo mode (without Wokwi)
7. API reference (all endpoints)
8. Project structure
9. Team members section (leave blank for Krish to fill)

---

## ⚡ Exact Commands to Run the Project

After building, the project must start with these 3 commands:

```bash
# Terminal 1 — Start backend
cd SmartRoadHazard/backend
pip install -r requirements.txt
python server.py

# Terminal 2 — Start bridge (demo mode)
cd SmartRoadHazard/backend
python bridge.py --mode demo

# Browser — Open dashboard
open frontend/index.html
```

---

## ✅ Definition of Done — Project is Complete When:

- [ ] Wokwi circuit opens and runs without errors
- [ ] HC-SR04 slider at 45cm → Serial prints "POTHOLE,DEEP,..."
- [ ] HC-SR04 slider at 8cm → Serial prints "SPEEDBREAKER,..."
- [ ] HC-SR04 slider at 20cm → Serial prints "NORMAL"
- [ ] `python server.py` starts Flask at localhost:5000 with no errors
- [ ] `python bridge.py --mode demo` starts generating detections
- [ ] `GET localhost:5000/api/hazards` returns JSON array
- [ ] Opening `index.html` shows Google Maps centered on Nagpur
- [ ] After 3 demo detections at same location → marker appears on map
- [ ] Deep pothole marker is RED, speedbreaker is BLUE
- [ ] Clicking a marker shows hazard details popup
- [ ] Stats panel shows live counts
- [ ] Hazard shadow alert notification appears for deep potholes
- [ ] Reset button clears all hazards from DB and map
- [ ] No hardcoded absolute paths anywhere (all relative paths)
- [ ] No crashes on Mac (macOS compatible)

---

## ⚠️ Important Rules — Follow Strictly

1. **Never use Firebase** — this is a fully local project, SQLite only
2. **Never use React or any framework** — plain HTML + Vanilla JS only for frontend
3. **Never use absolute paths** — all paths must be relative
4. **Always add comments** to Arduino code — Krish needs to understand and explain it
5. **Keep ESP32 code simple** — no complex classes, straightforward procedural code
6. **Flask must have CORS enabled** — frontend calls API from file:// origin
7. **SQLite DB file** must be created automatically on first run
8. **Demo mode must work without Wokwi** — project must be demonstrable even if Wokwi has issues
9. **Google Maps API key** — use placeholder, add clear comment with link to get free key
10. **All Python code** must be compatible with Python 3.10+

---

## 🧪 Test Scenarios for Demo Day

When demonstrating to professor, use these test scenarios:

**Scenario 1 — Pothole Detection:**
- Set HC-SR04 slider to 45cm
- System should print DEEP POTHOLE to serial
- After 3 detections → red marker appears on Nagpur map

**Scenario 2 — Speedbreaker Detection:**
- Set HC-SR04 slider to 8cm  
- System should print SPEEDBREAKER to serial
- Blue marker appears after 3 detections

**Scenario 3 — Crowd Verification (demo mode):**
- Run `python bridge.py --mode demo`
- Watch markers appear gradually as verification count reaches 3
- Grey (unverified) → colored (verified) transition visible

**Scenario 4 — Hazard Shadow Alert:**
- When a deep pothole is verified
- Alert bar at bottom appears: "⚠️ DEEP POTHOLE — Hazard Shadow Alert!"

---

## 📬 Contact / Questions

Developer: Krish Potanwar  
University: Ramdeobaba University, Nagpur  
Project Type: College Graded Project  
Simulation Tool: Wokwi (wokwi.com)
