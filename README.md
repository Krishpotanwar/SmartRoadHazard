# 🚗 Smart Road Hazard Detection & Alert System

A full-stack IoT project that detects road hazards using an HC-SR04 ultrasonic sensor
on an ESP32 (simulated in Wokwi), pushes detections to Firebase RTDB in real-time,
and displays live color-coded markers on a Leaflet map dashboard.

**Built by:** Krish Potanwar | Ramdeobaba University, Nagpur | B.Tech CSE (AI & ML)

| | |
|---|---|
| 🔴 **Live Dashboard** | [smart-road-hazard.vercel.app](https://smart-road-hazard.vercel.app) |
| ⚡ **Wokwi Simulation** | [wokwi.com/projects/458668521911516161](https://wokwi.com/projects/458668521911516161) |
| ☁️ **Backend API** | [smartroadhazard.onrender.com](https://smartroadhazard.onrender.com) |

---

## 3 Unique Innovations

1. **Depth Classification** — Potholes graded Shallow / Medium / Deep by distance delta (5 / 15 / 25 cm thresholds).
2. **Crowd Verification** — Hazard only confirmed after 3+ independent detections within a 15 m radius. Prevents false positives.
3. **Hazard Shadow Alert** — Verified deep/medium potholes trigger a live dashboard notification to warn nearby drivers.

---

## Try the Simulation (No Setup Needed)

> **Anyone can run the full IoT simulation directly in the browser — no hardware required.**

1. Open the **[Wokwi Simulation](https://wokwi.com/projects/458668521911516161)** in one tab
2. Open the **[Live Dashboard](https://smart-road-hazard.vercel.app)** in another tab
3. In Wokwi, click **▶ Run** to start the ESP32
4. Click on the **HC-SR04 sensor** and drag the distance slider:
   - `45+ cm` → 🔴 DEEP POTHOLE detected
   - `20-30 cm` → 🟠 MEDIUM POTHOLE detected
   - `10-20 cm` → 🟡 SHALLOW POTHOLE detected
   - `< 15 cm` → 🔵 SPEEDBREAKER detected
   - `~20 cm` → NORMAL (no detection)
5. Watch the map update **live** as the ESP32 pushes to Firebase!

> **No Wokwi?** Use the **🔴 Simulate Deep Pothole** / **🔵 Simulate Speedbreaker** buttons on the dashboard sidebar.

---

## How It Works

```
[Wokwi ESP32 — HC-SR04 Sensor]
         ↓  detects hazard (type + severity)
         ↓  WiFi PUT to Firebase RTDB /hazards/
         ↓
[Firebase Realtime Database]
         ↓  real-time push to all connected clients
         ↓
[Browser — smart-road-hazard.vercel.app]
         ↓  receives hazard with lat=0
         ↓  stamps real GPS from navigator.geolocation
         ↓  renders color-coded pin on Leaflet map
```

---

## Map Features

| Interaction | Result |
|---|---|
| **Hover** over a pin | Tooltip shows hazard type, severity, verification status |
| **Click** a pin | Pin glows + grows, all others dim |
| **Click again** | Deselects |
| **Reset button** | Clears all hazards from Firebase and map |

---

## Prerequisites (Local Dev Only)

- Python 3.10+
- pip
- Modern browser (Chrome, Firefox, Edge)

---

## Local Development

```bash
# Terminal 1 — Start Flask backend
cd backend
pip install -r requirements.txt
python server.py

# Terminal 2 — Generate demo detections
cd backend
python bridge.py

# Browser — Open dashboard (switch MODE to 'local' in map.js first)
open frontend/index.html
```

---

## API Reference

Backend at `https://smartroadhazard.onrender.com`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/hazards` | Verified hazards (detection_count >= 3) |
| GET | `/api/hazards/all` | All hazards including pending |
| POST | `/api/hazards` | Add detection `{type, severity, lat, lng}` |
| GET | `/api/stats` | Totals by type and severity |
| DELETE | `/api/hazards` | Clear all (demo reset) |

---

## Demo Day Scenarios

| Scenario | Action | Expected Result |
|----------|--------|-----------------|
| Deep pothole | Slider to 45+ cm in Wokwi | Grey pin → red after 3 detections |
| Speedbreaker | Slider to 8 cm | Blue pin on map |
| Crowd verification | 3 detections at same spot | `⏳ 1/3` → `⏳ 2/3` → `✅ Verified` in tooltip |
| Hazard Shadow Alert | Deep pothole verified | Orange alert bar at bottom of screen |
| GPS stamping | Allow location in browser | Pins appear at your real physical location |

---

## Project Structure

```
SmartRoadHazard/
├── README.md
├── wokwi/
│   ├── sketch.ino         ← ESP32 code (sensor + WiFi + Firebase REST)
│   └── diagram.json       ← Wokwi circuit layout
├── backend/
│   ├── server.py          ← Flask REST API
│   ├── database.py        ← SQLite + Haversine crowd verification
│   ├── bridge.py          ← Demo data generator
│   ├── simulator.py       ← Keyboard-driven simulator
│   ├── requirements.txt
│   ├── Procfile           ← Render/gunicorn start command
│   └── render.yaml        ← Render deploy config
├── frontend/
│   ├── index.html         ← Dashboard
│   ├── map.js             ← Leaflet map + Firebase real-time + GPS
│   └── style.css          ← Dark theme
└── firebase/
    ├── rules.json         ← Firebase security rules
    └── schema.md          ← RTDB data structure docs
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
