# SmartRoadHazard — Deployment Guide

Deploy the Flask backend to Railway (free) so the Wokwi ESP32 simulation can
POST data to a real public URL.

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "SmartRoadHazard — ready for deployment"
git remote add origin https://github.com/YOUR_USERNAME/SmartRoadHazard
git push -u origin main
```

---

## Step 2 — Deploy to Railway (free)

1. Go to <https://railway.app> → Sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `SmartRoadHazard` repository
4. Set **Root Directory** to: `backend`
5. Railway auto-detects Python via `runtime.txt` and installs `requirements.txt`
6. Click **Settings → Networking → Generate Domain**
7. Copy your URL — it looks like: `https://smartroadhazard-production.up.railway.app`

> Railway's free tier gives 500 hours/month — more than enough for a demo.
> SQLite data resets on each redeploy, which is fine for demo purposes.

---

## Step 3 — Update 3 Files With Your Railway URL

Search for `YOUR-RAILWAY-URL` in the project and replace with your actual domain.

### `wokwi/sketch.ino`
```cpp
const char* RAILWAY_URL = "https://YOUR-APP.up.railway.app/api/hazards";
const char* VEHICLE_URL = "https://YOUR-APP.up.railway.app/api/vehicle";
```

### `frontend/map.js`
```js
const API_BASE = 'https://YOUR-APP.up.railway.app';
```

### `backend/bridge.py`
```python
API_URL = "https://YOUR-APP.up.railway.app/api/hazards"
```

---

## Step 4 — Verify Deployment

Open your Railway URL in a browser:

```
https://YOUR-APP.up.railway.app/
```

You should see:
```json
{"status": "ok", "message": "SmartRoadHazard API is running", ...}
```

Also test the hazards endpoint:
```
https://YOUR-APP.up.railway.app/api/hazards
```

---

## Step 5 — Run Wokwi With Real WiFi

1. Open [wokwi.com](https://wokwi.com) → load `wokwi/sketch.ino` and `wokwi/diagram.json`
2. Start the simulation
3. ESP32 connects to `"Wokwi-GUEST"` WiFi automatically (free, built-in to Wokwi)
4. Serial Monitor shows: `WiFi connected! IP: ...`
5. Drag the HC-SR04 slider to **45 cm** (deep pothole)
6. Serial Monitor shows: `POTHOLE,DEEP,...` then `POST → HTTP 200`
7. Open `frontend/index.html` in a browser
8. **Red pin appears on the Nagpur map after 3 detections!**

---

## Step 6 — Demo Day Setup

### Option A — Full Internet Demo (recommended)
- Wokwi running in browser tab
- `frontend/index.html` open in another tab
- `API_BASE` in `map.js` pointing to Railway URL
- Drag HC-SR04 slider → pin appears on map (real IoT data flow!)

### Option B — Local Fallback (no internet needed)
```bash
# Terminal 1
cd backend && python server.py

# Terminal 2
cd backend && python bridge.py --mode demo
# OR for interactive:
cd backend && python simulator.py

# Browser
open frontend/index.html
```
`API_BASE` must be `http://localhost:5001` for this mode.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/hazards` | Verified hazards only |
| GET | `/api/hazards/all` | All hazards including unverified |
| POST | `/api/hazards` | Add new detection |
| GET | `/api/stats` | Aggregate statistics |
| DELETE | `/api/hazards` | Clear all (demo reset) |
| GET | `/api/vehicle` | Last known vehicle position |
| POST | `/api/vehicle` | Update vehicle position |

---

## Environment Variables (Railway)

Railway sets `PORT` automatically. No other env vars are required.

| Variable | Set by | Default |
|----------|--------|---------|
| `PORT` | Railway (automatic) | 5001 (local) |
| `FLASK_ENV` | Optional — set to `development` for debug mode | production |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `POST → HTTP -1` in Wokwi | Railway URL not set in sketch.ino — update `RAILWAY_URL` |
| Map shows no markers | `API_BASE` in map.js still points to localhost — update to Railway URL |
| Railway build fails | Check that Root Directory is set to `backend` in Railway settings |
| WiFi failed in Wokwi | Normal if using older Wokwi project — WiFi only works in new ESP32 projects |
