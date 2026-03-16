# Checkpoint 07 — Cleanup + Koyeb Deployment
Date: 2026-03-17
Phase: Full codebase cleanup + switch from Railway to Koyeb

## What Was Done

5 agents ran in parallel to clean, refactor, and prepare the project for Koyeb.
No existing functionality was broken — local demo still works.

## Files Deleted
| File | Reason |
|------|--------|
| `backend/send_serial.py` | Obsolete — simulator.py + Wokwi WiFi POST cover all use cases |
| `backend/railway.json` | Replaced by koyeb.yaml |

## Files Created
| File | Purpose |
|------|---------|
| `backend/koyeb.yaml` | Koyeb deploy config (nixpacks, gunicorn, port 8000) |
| `DEPLOYMENT.md` | Complete Koyeb deployment guide (free forever, no credit card) |

## Files Modified
| File | Changes |
|------|---------|
| `backend/requirements.txt` | Removed pyserial (no longer needed) |
| `backend/Procfile` | Added `--workers 1 --timeout 120` flags |
| `backend/server.py` | No change needed — already clean from checkpoint-06 |
| `backend/database.py` | Removed 2 debug print statements; fixed f-string SQL pattern in get_stats() |
| `backend/bridge.py` | Removed stdin mode entirely; added SMARTROAD_API env var override |
| `backend/simulator.py` | Added SMARTROAD_API env var; shows API target in menu header |
| `wokwi/sketch.ino` | Renamed postToRailway→postDetection, RAILWAY_URL→SERVER_URL (Koyeb placeholder); condensed verbose comments to 1-liners |
| `frontend/map.js` | API_BASE → Koyeb placeholder; vehicle marker + trail unchanged |
| `frontend/index.html` | Title: "Smart Road Hazard..." → "SmartRoadHazard — Nagpur" |
| `frontend/style.css` | Fixed invalid color `#4455880` in #last-updated; removed duplicate property; added `.vehicle-popup` |
| `README.md` | Removed Google Maps, Railway, stdin mode sections; fully updated for Koyeb + Leaflet |

## Security Audit Results
- **1 fix applied:** `get_stats()` in database.py used f-string interpolation in SQL. Rewritten with static SQL strings + `?` bound parameters throughout.
- **7 acceptable items** (CORS all-origins, WiFi credentials in Wokwi sandbox, SRI-less CDN, etc.)
- **No real secrets, no hardcoded URLs, no absolute paths, no XSS vectors**

## Definition of Done — Verified
- [x] No unused imports anywhere
- [x] No commented-out code blocks anywhere
- [x] send_serial.py deleted
- [x] bridge.py has only demo mode
- [x] requirements.txt has no pyserial
- [x] server.py reads PORT from environment (from checkpoint-06)
- [x] server.py has all 7 endpoints (from checkpoint-06)
- [x] sketch.ino: postDetection() + postVehiclePosition() + Serial.println() intact
- [x] map.js: vehicle marker + trail + API_BASE → Koyeb
- [x] Procfile updated with --workers 1 --timeout 120
- [x] runtime.txt exists
- [x] koyeb.yaml created
- [x] DEPLOYMENT.md Koyeb guide complete
- [x] README.md no Railway/Google Maps references
- [x] .gitignore includes hazards.db
- [x] Security audit passed (1 fix applied)
- [x] Local demo still works
- [x] PROJECT_STATUS.md updated

## How to Deploy
Follow DEPLOYMENT.md — 5 steps:
1. Push to GitHub
2. Create Koyeb app (root dir = backend)
3. Verify https://YOUR-APP.koyeb.app/ returns {"status":"ok"}
4. Replace YOUR-KOYEB-APP in sketch.ino + map.js
5. Run Wokwi → drag slider → see pin on map

## How to Run Locally
```bash
# Change map.js API_BASE to http://localhost:5001 first
cd backend && python server.py       # Terminal 1
cd backend && python bridge.py       # Terminal 2 (auto demo)
# OR: python simulator.py            # interactive key-press
open frontend/index.html             # Browser
```
