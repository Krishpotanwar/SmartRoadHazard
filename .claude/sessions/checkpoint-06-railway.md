# Checkpoint 06 — Railway Deployment Setup
Date: 2026-03-17
Phase: Railway Deployment + Wokwi WiFi Integration

## What Was Done

Added full Railway cloud deployment support and Wokwi WiFi → HTTP POST integration.
Local demo still works exactly as before — nothing was removed or broken.

## Files Modified

| File | What Changed |
|------|-------------|
| `backend/server.py` | Added `import os`; PORT from env var; conditional debug; GET+POST `/api/vehicle` endpoints |
| `backend/requirements.txt` | Added `gunicorn==21.2.0` |
| `backend/bridge.py` | Added Railway URL comment above `API_URL` |
| `wokwi/sketch.ino` | Added WiFi.h + HTTPClient.h; connectWiFi(); postToRailway(); postVehiclePosition(); all called in setup/loop while keeping Serial.println() intact |
| `frontend/map.js` | Added Railway URL comment above API_BASE; vehicleMarker (🚗 emoji); trailLine (green dashed); fetchVehiclePosition() polling at 1s |

## Files Created

| File | Purpose |
|------|---------|
| `backend/Procfile` | Tells Railway how to start the app with gunicorn |
| `backend/runtime.txt` | Pins Python version to 3.11.0 for Railway |
| `backend/railway.json` | Railway build/deploy config (nixpacks, ON_FAILURE restart) |
| `DEPLOYMENT.md` | Complete step-by-step guide: GitHub → Railway → update URLs → test |

## How to Deploy

Follow `DEPLOYMENT.md` step by step. Summary:
1. Push to GitHub
2. Connect to Railway, set Root Directory = `backend`
3. Generate domain → copy URL
4. Replace `YOUR-RAILWAY-URL` in: `sketch.ino`, `map.js`, `bridge.py`
5. Restart Railway app → test at `https://YOUR-APP.up.railway.app/`

## How to Test Locally (unchanged)

```bash
# Terminal 1
cd backend && python server.py

# Terminal 2
cd backend && python bridge.py --mode demo

# Browser
open frontend/index.html
```

## Definition of Done — Verified

- [x] Procfile exists in backend/
- [x] runtime.txt exists in backend/
- [x] railway.json exists in backend/
- [x] gunicorn in requirements.txt
- [x] server.py reads PORT from environment
- [x] server.py has GET /api/vehicle and POST /api/vehicle
- [x] sketch.ino has WiFi connect + postToRailway() + postVehiclePosition()
- [x] sketch.ino still has all Serial.println() lines (fallback preserved)
- [x] map.js shows 🚗 vehicle marker moving on map
- [x] map.js shows green dashed trail
- [x] map.js API_BASE has Railway URL comment
- [x] bridge.py API_URL has Railway URL comment
- [x] DEPLOYMENT.md created with full step-by-step guide
- [x] PROJECT_STATUS.md updated
- [x] checkpoint-06-railway.md created (this file)
- [x] Local demo still works (localhost:5001)
- [x] No hardcoded real URLs anywhere
