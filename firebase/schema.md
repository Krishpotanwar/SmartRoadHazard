# Firebase Realtime Database Schema

## /hazards/{millis-key}

Each entry is one hazard detection pushed from the ESP32.
The key is the value of `millis()` at detection time (unique enough for demo).

```json
{
  "type": "pothole",
  "severity": "deep",
  "lat": 21.145823,
  "lng": 79.088156,
  "verified": false,
  "detection_count": 1,
  "timestamp": 1710000000
}
```

**Fields:**
| Field | Type | Values |
|-------|------|--------|
| `type` | string | `"pothole"` or `"speedbreaker"` |
| `severity` | string | `"shallow"`, `"medium"`, `"deep"`, or `""` for speedbreaker |
| `lat` | float | Latitude (e.g. `21.145823`) |
| `lng` | float | Longitude (e.g. `79.088156`) |
| `verified` | bool | Always `false` from ESP32 (crowd verification not implemented in Firebase mode) |
| `detection_count` | int | Always `1` from ESP32 (each push is one detection) |
| `timestamp` | int | Seconds since ESP32 boot (`millis() / 1000`) |

**Note on crowd verification:**
In local mode (Flask/SQLite), the Python backend groups nearby detections within 15m radius
and marks `verified = true` after 3 reports. In Firebase mode, each ESP32 push creates a
new entry — crowd verification would require a Cloud Function or client-side logic.
For the demo, all Firebase hazards show as unverified (grey) unless manually toggled.

---

## /vehicle/position

Current vehicle GPS position, overwritten on every detection.

```json
{
  "lat": 21.145823,
  "lng": 79.088156,
  "speed": 30,
  "ts": 1710000000
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `lat` | float | Current latitude |
| `lng` | float | Current longitude |
| `speed` | int | Simulated speed in km/h (always 30) |
| `ts` | int | Timestamp in seconds since ESP32 boot |
