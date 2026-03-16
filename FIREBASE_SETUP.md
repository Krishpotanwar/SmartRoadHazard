# SmartRoadHazard — Firebase Setup Guide

Free forever. No credit card. No expiry.
No server hosting needed — ESP32 → Firebase → Browser directly!

---

## Why Firebase Realtime Database

- Free forever (Spark plan: 1 GB storage, 10 GB/month transfer)
- No server to host or maintain
- Real-time push updates — no polling needed
- Works with Wokwi's free WiFi (`Wokwi-GUEST`)

---

## Step 1 — Create Firebase Project

1. Go to <https://firebase.google.com> → **Get started** → sign in with Google
2. Click **Add project**
3. Project name: `SmartRoadHazard` → **Continue**
4. Disable Google Analytics (not needed) → **Create project**
5. Wait ~30 seconds for provisioning

---

## Step 2 — Create Realtime Database

1. Left sidebar → **Build** → **Realtime Database**
2. Click **Create Database**
3. Location: `United States (us-central1)` → **Next**
4. Select **Start in test mode** → **Enable**
5. Your database URL will look like:
   `https://smartroadhazard-default-rtdb.firebaseio.com`

---

## Step 3 — Set Open Rules (permanent for demo)

1. Realtime Database → **Rules** tab
2. Replace the existing rules with:
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
3. Click **Publish**

> These open rules are fine for a college demo. See `firebase/rules-notes.md` for production rules.

---

## Step 4 — Get Your Database URL

1. Click **Data** tab in Realtime Database
2. Copy the URL shown at the top: `https://YOUR-PROJECT-default-rtdb.firebaseio.com`

---

## Step 5 — Get Your Web API Key

1. Click the ⚙️ gear icon → **Project settings**
2. Scroll down to **Your apps**
3. Click the **</>** (Web) icon
4. App nickname: `SmartRoadHazard-Web` → **Register app**
5. Copy the `apiKey` value from the `firebaseConfig` shown
6. Click **Continue to console**

---

## Step 6 — Replace Placeholders in 2 Files

Open both files and replace the placeholder values:

### `wokwi/sketch.ino`

Find:
```cpp
#define FIREBASE_URL     "https://YOUR-PROJECT-rtdb.firebaseio.com"
#define FIREBASE_API_KEY "YOUR-WEB-API-KEY"
```

Replace with your actual values:
```cpp
#define FIREBASE_URL     "https://smartroadhazard-default-rtdb.firebaseio.com"
#define FIREBASE_API_KEY "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

### `frontend/map.js`

Find:
```javascript
const FIREBASE_CONFIG = {
  apiKey:      "YOUR-WEB-API-KEY",
  databaseURL: "https://YOUR-PROJECT-rtdb.firebaseio.com",
};
```

Replace with your actual values:
```javascript
const FIREBASE_CONFIG = {
  apiKey:      "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  databaseURL: "https://smartroadhazard-default-rtdb.firebaseio.com",
};
```

---

## Step 7 — Add FirebaseClient Library in Wokwi

1. Open your Wokwi project
2. Click the **library icon** (book) in the top toolbar
3. Search for: `FirebaseClient`
4. Click **Add** next to `FirebaseClient` by Mobizt

---

## Step 8 — Test the Full Pipeline

1. Open [wokwi.com](https://wokwi.com) and load `sketch.ino` + `diagram.json`
2. Click **Run**
3. ESP32 Serial Monitor should show:
   ```
   Connecting to WiFi.....
   WiFi connected! IP: 10.0.0.2
   Firebase initializing.....
   Firebase ready!
   ```
4. Drag the HC-SR04 slider to **45 cm** (deep pothole)
5. Serial Monitor shows:
   ```
   POTHOLE,DEEP,21.145823,79.088156
   Firebase: pushed OK
   ```
6. Open Firebase Console → Realtime Database → Data
7. You should see `/hazards/{key}` appear! ✅
8. Open `frontend/index.html` in a browser
9. Confirm `MODE = 'firebase'` in map.js
10. A grey marker appears on the Nagpur map in real time!

---

## Switching Between Modes

**Firebase mode** (Wokwi demo — needs internet):
In `frontend/map.js`:
```javascript
const MODE = 'firebase';
```

**Local mode** (simulator demo — works offline):
In `frontend/map.js`:
```javascript
const MODE = 'local';
```
Then run: `cd backend && python server.py` + `python simulator.py`

---

## Free Tier Limits

| Resource | Free Limit |
|----------|------------|
| Storage | 1 GB |
| Simultaneous connections | 100 |
| Data transfer | 10 GB / month |
| No expiry | Forever |

More than enough for any college demo.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Firebase failed — serial-only mode` | Check `FIREBASE_URL` and `FIREBASE_API_KEY` in sketch.ino |
| No data in Firebase console | Check WiFi connected (`WiFi connected!` in Serial) |
| Map shows no markers | Confirm `MODE = 'firebase'` in map.js and your `FIREBASE_CONFIG` values |
| `Firebase: error: ...` | Check database rules are published as open (`".read": true, ".write": true`) |
