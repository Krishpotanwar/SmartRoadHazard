# Firebase Realtime Database Schema

## /pending_hazards/{millis-key}

Written by the **ESP32** when a hazard is detected. No GPS coordinates — the browser
(map.js) watches this path via `child_added`, stamps its real device GPS, writes the
completed entry to `/hazards`, then deletes the pending entry.

```json
{
  "type": "pothole",
  "severity": "deep",
  "timestamp": 12345,
  "status": "pending"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"pothole"` or `"speedbreaker"` |
| `severity` | string | `"shallow"`, `"medium"`, `"deep"`, or `""` for speedbreaker |
| `timestamp` | int | Seconds since ESP32 boot |
| `status` | string | Always `"pending"` — signals browser to act |

**Lifecycle:** ESP32 PUTs → browser `child_added` fires → `resolveAndPostHazard()` writes to `/hazards` → entry deleted. If the browser is not open when the ESP32 fires, the entry stays in `/pending_hazards` and is processed when the page next loads (self-healing via re-fire on `child_added`).

---

## /hazards/{millis-key}

Each entry is one hazard detection with **real browser GPS coordinates**.
The key is the same `millis()` key from `/pending_hazards` (preserving traceability).

```json
{
  "type": "pothole",
  "severity": "deep",
  "lat": 21.145823,
  "lng": 79.088156,
  "accuracy": 5.0,
  "verified": false,
  "detection_count": 1,
  "timestamp": 1710000000,
  "gps_source": "browser"
}
```

**Fields:**
| Field | Type | Values |
|-------|------|--------|
| `type` | string | `"pothole"` or `"speedbreaker"` |
| `severity` | string | `"shallow"`, `"medium"`, `"deep"`, or `null` for speedbreaker |
| `lat` | float | Real device latitude (from `navigator.geolocation`) |
| `lng` | float | Real device longitude |
| `accuracy` | float | GPS accuracy in metres |
| `verified` | bool | `false` — crowd verification happens in Flask/SQLite (local mode) |
| `detection_count` | int | Always `1` per Firebase entry |
| `timestamp` | int | Seconds since ESP32 boot |
| `gps_source` | string | Always `"browser"` to distinguish from old simulated coords |

**Note on crowd verification:**
In local mode (Flask/SQLite), the Python backend groups nearby detections within 15m radius
and marks `verified = true` after 3 reports. In Firebase mode, each entry is `verified: false`.
For the demo, grey (unverified) pins will still appear immediately — red/orange after the
professor sees 3 detections in local mode.

---

## /vehicle/position

Current vehicle GPS position — now written by the **browser** (`onGpsSuccess` in map.js),
not the ESP32. Updated continuously via `navigator.geolocation.watchPosition`.

```json
{
  "lat": 21.145823,
  "lng": 79.088156,
  "accuracy": 5.0,
  "ts": 1710000000,
  "source": "browser"
}
```

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `lat` | float | Real device latitude |
| `lng` | float | Real device longitude |
| `accuracy` | float | GPS accuracy radius in metres |
| `ts` | int | Unix timestamp (seconds) |
| `source` | string | Always `"browser"` |
