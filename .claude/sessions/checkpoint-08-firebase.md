# Checkpoint 08 — Firebase RTDB Integration
Date: 2026-03-17
Phase: Firebase real-time path (Wokwi → Firebase → Leaflet map)

## What Was Done

4 agents ran in parallel to add Firebase as a zero-server hosting path.
The project now has TWO live data paths: Firebase RTDB (cloud) and Flask/SQLite (local).

## Files Created
| File | Purpose |
|------|---------|
| `firebase/rules.json` | RTDB security rules (open for demo) |
| `firebase/schema.md` | Documents /hazards and /vehicle/position structure |
| `firebase/rules-notes.md` | Security warning + production auth rules |
| `FIREBASE_SETUP.md` | 8-step setup guide |
| `wokwi/libraries.txt` | Wokwi library list (added FirebaseClient) |

## Files Modified
| File | Changes |
|------|---------|
| `wokwi/sketch.ino` | Added Firebase_ESP_Client includes, initFirebase(), pushToFirebase(), pushVehiclePosition(); real credentials set |
| `frontend/map.js` | Full dual-mode rewrite: MODE='firebase' uses RTDB listeners, MODE='local' polls Flask; real FIREBASE_CONFIG set |
| `frontend/index.html` | Added Firebase SDK CDN scripts (compat v9.23.0), mode-indicator div |
| `.gitignore` | Added .firebase/, firebase-debug logs, .firebaserc |
| `README.md` | Added Firebase section, links to FIREBASE_SETUP.md |
| `.claude/sessions/PROJECT_STATUS.md` | Updated with Firebase status |

## Real Firebase Project
- Project ID: `smartroadhazard`
- RTDB URL: `https://smartroadhazard-default-rtdb.firebaseio.com`
- API key set in both sketch.ino and map.js

## Architecture After This Checkpoint

```
[Wokwi ESP32]
  → POST https://YOUR-KOYEB-APP.koyeb.app/api/hazards  (Koyeb path, if deployed)
  → Firebase RTDB /hazards/{millis-key}                 (Firebase path, always works)

[frontend/map.js MODE='firebase']
  → Real-time listener on /hazards
  → Real-time listener on /vehicle/position
  → No server needed!

[frontend/map.js MODE='local']
  → Polls Flask at localhost:5001 every 2s
```

## How to Run (Firebase Mode)
1. Open `frontend/index.html` in browser — it uses Firebase real-time listeners
2. Open Wokwi with sketch.ino + diagram.json
3. Run simulation — drag HC-SR04 slider
4. Hazard pins appear on map in real time via Firebase

## Definition of Done — Verified
- [x] sketch.ino: initFirebase() + pushToFirebase() + pushVehiclePosition() added
- [x] sketch.ino: Real Firebase URL + API key set
- [x] map.js: initFirebase() attaches /hazards and /vehicle/position listeners
- [x] map.js: Real FIREBASE_CONFIG with all 8 fields set
- [x] map.js: buildPopup() handles both first_detected (Flask) and timestamp (Firebase)
- [x] map.js: resetHazards() removes Firebase /hazards and /vehicle nodes
- [x] index.html: Firebase compat SDK CDN scripts added before Leaflet
- [x] index.html: mode-indicator div in sidebar
- [x] FIREBASE_SETUP.md: complete 8-step guide
- [x] firebase/rules.json: open read/write rules for demo
- [x] wokwi/libraries.txt: FirebaseClient added
- [x] .gitignore: Firebase artifacts excluded
