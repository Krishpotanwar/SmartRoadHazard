# SmartRoadHazard — Koyeb Deployment Guide

Free forever. No credit card. No expiry.

---

## Why Koyeb

- Free forever (not a trial)
- No credit card required
- 512 MB RAM, always on (no cold starts)
- Auto-deploys from GitHub on every push

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "SmartRoadHazard v1.0"
git remote add origin https://github.com/YOUR_USERNAME/SmartRoadHazard
git push -u origin main
```

---

## Step 2 — Deploy on Koyeb

1. Go to <https://koyeb.com> → Sign up free (GitHub login)
2. Click **Create App** → **GitHub**
3. Select your `SmartRoadHazard` repository
4. Set **Root Directory** to: `backend`
5. Build command: `pip install -r requirements.txt`
6. Run command: `gunicorn server:app --bind 0.0.0.0:$PORT --workers 1`
7. Click **Deploy**
8. Wait ~2 minutes for the build
9. Your URL: `https://smartroadhazard-yourname.koyeb.app`

---

## Step 3 — Verify Deployment

Open your Koyeb URL in a browser:

```
https://YOUR-APP.koyeb.app/
```

Expected response:
```json
{ "status": "ok", "message": "SmartRoadHazard API is running" }
```

---

## Step 4 — Replace YOUR-KOYEB-APP in 3 Files

Search for `YOUR-KOYEB-APP` and replace with your actual app name.

**`wokwi/sketch.ino`**
```cpp
const char* SERVER_URL  = "https://YOUR-APP.koyeb.app/api/hazards";
const char* VEHICLE_URL = "https://YOUR-APP.koyeb.app/api/vehicle";
```

**`frontend/map.js`**
```js
const API_BASE = 'https://YOUR-APP.koyeb.app';
```

**`backend/bridge.py`** (optional — only needed if running demo mode against cloud)
```bash
SMARTROAD_API=https://YOUR-APP.koyeb.app python bridge.py
```

After replacing, commit and push:
```bash
git add .
git commit -m "Set Koyeb URL"
git push
```

---

## Step 5 — Test the Full IoT Pipeline

1. Open [wokwi.com](https://wokwi.com) → load `wokwi/sketch.ino` and `wokwi/diagram.json`
2. Run the simulation — ESP32 connects to `Wokwi-GUEST` WiFi automatically
3. Drag the HC-SR04 slider to **45 cm** (deep pothole)
4. Serial Monitor shows: `POST → HTTP 200`
5. Open `frontend/index.html` in a browser (with Koyeb URL in `API_BASE`)
6. Red pin appears on the Nagpur map after 3 detections!
7. Vehicle marker moves along the route

---

## Local Demo Fallback (No Internet Needed)

```bash
# Terminal 1 — Flask backend
cd backend && python server.py

# Terminal 2 — Demo data generator
cd backend && python bridge.py

# OR interactive simulator
cd backend && python simulator.py

# Browser
open frontend/index.html
```

Change `API_BASE` in `frontend/map.js` back to `http://localhost:5001` for local mode.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/hazards` | Verified hazards only |
| GET | `/api/hazards/all` | All hazards including unverified |
| POST | `/api/hazards` | Add detection `{type, severity, lat, lng}` |
| GET | `/api/stats` | Aggregate statistics |
| DELETE | `/api/hazards` | Clear all (demo reset) |
| GET | `/api/vehicle` | Last known vehicle position |
| POST | `/api/vehicle` | Update vehicle position |

---

## Notes

- SQLite data resets on Koyeb redeploy — fine for demo purposes
- Free tier is always on — no cold start delays
- CORS is enabled for all origins in `server.py`
- Wokwi WiFi (`Wokwi-GUEST`) is built-in and free — no setup needed
