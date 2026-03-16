# SmartRoadHazard — Full Chat Summary
**Project:** Smart Road Hazard Detection & Alert System
**Developer:** Krish Potanwar, B.Tech CSE (AI & ML), Ramdeobaba University, Nagpur
**Date:** 2026-03-16

---

## What Was Built

A full-stack IoT simulation project that detects road hazards (potholes and speedbreakers),
stores them in a local SQLite database, and displays live color-coded markers on a Nagpur map.

**3 Unique Innovations:**
1. Depth Classification — Shallow / Medium / Deep pothole based on distance delta
2. Crowd Verification — Hazard only marked verified after 3+ detections at same GPS location
3. Hazard Shadow Alerting — Alert bar fires when a deep/medium pothole is verified

---

## Files Created

| File | Purpose |
|------|---------|
| `wokwi/sketch.ino` | ESP32 Arduino code — baseline calibration, delta classification, GPS sim, serial output, OLED + LEDs |
| `wokwi/diagram.json` | Wokwi circuit layout — ESP32 + HC-SR04 + SSD1306 OLED + 3 LEDs + resistors |
| `wokwi/wokwi.toml` | Wokwi VS Code extension config |
| `wokwi/libraries.txt` | Required libraries: Adafruit SSD1306, Adafruit GFX |
| `backend/database.py` | SQLite operations — schema, Haversine 15m proximity, crowd verification |
| `backend/server.py` | Flask REST API — 5 endpoints, CORS enabled for file:// origin |
| `backend/bridge.py` | Stdin mode (paste Wokwi serial) + demo mode (auto-generates Nagpur route detections) |
| `backend/simulator.py` | Interactive key-press simulator — replaces Wokwi, press 1-4 to trigger hazards |
| `backend/send_serial.py` | Paste Wokwi serial output and send to Flask in bulk |
| `backend/requirements.txt` | flask, flask-cors, pyserial, requests |
| `frontend/index.html` | Web dashboard — sidebar + Leaflet map + alert bar |
| `frontend/map.js` | Leaflet.js map, 2s polling, color markers, shadow alerts, stats update |
| `frontend/style.css` | Dark theme — sidebar, pulsing live dot, alert bar animation |
| `run.sh` | One-click launcher — installs deps, starts Flask + bridge, opens dashboard |
| `open_wokwi.sh` | Opens Wokwi in browser with step-by-step instructions |
| `README.md` | Full setup guide, API reference, demo-day scenarios |
| `.gitignore` | Excludes hazards.db, __pycache__, .DS_Store |

---

## How the System Works (Data Flow)

```
[simulator.py / Wokwi / bridge.py]
  User presses key (or slider dragged in Wokwi)
         ↓
  Classifies hazard: POTHOLE,DEEP / SPEEDBREAKER / NORMAL
  Assigns simulated Nagpur GPS coordinates
         ↓
[Flask API — localhost:5001]
  POST /api/hazards
  database.py checks Haversine distance (15m radius)
  Increments detection_count
  If count >= 3 → verified = 1
         ↓
[frontend/index.html — Leaflet map]
  Polls GET /api/hazards/all every 2 seconds
  Grey marker → colored marker when verified
  🔴 Deep  🟠 Medium  🟡 Shallow  🔵 Speedbreaker
  Alert bar fires for deep/medium verified potholes
```

---

## How to Run

### Quickest (fully automatic demo):
```bash
bash run.sh
```
Opens map + auto-generates detections. No other action needed.

### With interactive simulator (for professor demo):
```bash
# Terminal 1
bash run.sh

# Terminal 2 (new window)
cd backend && python simulator.py
```
Press keys to trigger hazards:
- `1` → Deep Pothole 🔴
- `2` → Medium Pothole 🟠
- `3` → Shallow Pothole 🟡
- `4` → Speedbreaker 🔵
- `5` → Normal road
- `q` → Quit

### API Endpoints:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/hazards | Verified hazards only |
| GET | /api/hazards/all | All including unverified |
| POST | /api/hazards | Add new detection |
| GET | /api/stats | Count summary |
| DELETE | /api/hazards | Clear all (demo reset) |

---

## Problems Solved During This Chat

### 1. Port 5000 blocked by macOS AirPlay
**Problem:** Flask couldn't start on port 5000 — macOS reserves it for AirPlay Receiver.
**Fix:** Changed all references from port 5000 → port 5001 across server.py, bridge.py, map.js, run.sh.

### 2. Google Maps requires credit card
**Problem:** Google Maps JavaScript API requires a billing account even for the free tier.
**Fix:** Replaced Google Maps entirely with **Leaflet.js + OpenStreetMap** — completely free,
no API key, no credit card, no account needed. Just loads from CDN.

### 3. Wokwi serial output too fast to copy
**Problem:** HC-SR04 slider in Wokwi detects hazard for ~1ms then snaps back.
With COOLDOWN_MS=3000 it only prints once and stops. User couldn't copy it in time.
**Fix 1:** Changed COOLDOWN_MS to 0 in sketch.ino so it keeps printing while slider is held.
**Fix 2:** Created `send_serial.py` — copy all serial text at once, pipe with `pbpaste | python send_serial.py`.
**Fix 3 (best):** Created `simulator.py` — replaces Wokwi entirely with a terminal key-press interface.

### 4. No GPS hardware
**Problem:** Wokwi ESP32 has no real GPS module — coordinates can't come from hardware.
**Solution:** GPS is simulated using hardcoded Nagpur base coordinates with small random offsets
(±0.0005 degrees), cycling through 5 real Nagpur waypoints (Sitabuldi → Dharampeth → Sadar →
Civil Lines → High Court). This is standard IoT prototyping practice.

---

## Key Technical Decisions

| Decision | Reason |
|----------|--------|
| SQLite instead of Firebase | Fully local, no internet needed, no account required |
| Leaflet.js instead of Google Maps | Free, no API key, no credit card |
| Flask on port 5001 | macOS reserves 5000 for AirPlay |
| CORS enabled on Flask | Frontend loads from file:// origin |
| Haversine radius = 15 metres | Matches real pothole cluster size |
| Polling every 2 seconds | Simple, no WebSocket complexity |
| Plain HTML/JS, no React | Per project rules; simpler to explain |
| simulator.py replaces Wokwi | Wokwi serial is hard to copy; simulator is interactive and direct |

---

## What to Say to Professor

> "The system detects road hazards using an HC-SR04 ultrasonic sensor on an ESP32,
> simulated in Wokwi. The sensor measures distance to the road surface — a sudden increase
> in distance means a pothole, a decrease means a speedbreaker. The classification thresholds
> are 25cm for deep, 15cm for medium, 5cm for shallow.
>
> Since physical GPS hardware wasn't available, coordinates are simulated using Nagpur's
> real road coordinates with small random offsets — standard practice in IoT prototyping.
>
> The crowd verification feature ensures a hazard is only marked verified after 3 independent
> vehicle detections within a 15-metre radius, using the Haversine formula.
>
> The dashboard polls the Flask API every 2 seconds and shows live color-coded markers on
> an OpenStreetMap-based map of Nagpur."

---

## Notes / Known Limitations

- `hazards.db` is auto-created on first run, gitignored
- No authentication on Flask API (acceptable for local college demo)
- Wokwi simulation works but serial copy is inconvenient — use `simulator.py` instead
- WiFi upload from ESP32 to Flask not implemented (bridge.py handles the connection instead)
- Demo mode and simulator both generate realistic Nagpur GPS coordinates
