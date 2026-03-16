"""
database.py — SQLite database layer for SmartRoadHazard.

Handles all DB operations: initialization, hazard insertion with crowd
verification logic, queries, and utility functions.

Schema:
    hazards — stores every unique hazard location detected by the system.
    A hazard starts as unverified (detection_count=1) and becomes verified
    once 3 or more vehicles report a hazard within a 15-metre radius.
"""

import math
import os
import sqlite3
from datetime import datetime
from typing import Optional

# ---------------------------------------------------------------------------
# Path setup — DB file lives next to this script so all relative paths work.
# ---------------------------------------------------------------------------
_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_DIR, "hazards.db")

# Crowd-verification threshold: minimum detections to mark a hazard verified.
VERIFICATION_THRESHOLD = 3

# Radius within which two GPS points are considered the same hazard (metres).
MERGE_RADIUS_METRES = 15


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return the distance in metres between two GPS coordinates.

    Uses the Haversine formula which is accurate enough for short distances
    (< 1 km) relevant to this project.
    """
    R = 6_371_000  # Earth's mean radius in metres

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a plain dict with frontend-friendly keys."""
    return {
        "id": row["id"],
        "type": row["type"],
        "severity": row["severity"],
        "lat": row["latitude"],
        "lng": row["longitude"],
        "detection_count": row["detection_count"],
        "verified": bool(row["verified"]),
        "first_detected": row["first_detected"],
    }


# ---------------------------------------------------------------------------
# Initialisation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Create the hazards table if it does not already exist.

    Safe to call multiple times — uses IF NOT EXISTS.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS hazards (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                type            TEXT    NOT NULL,
                severity        TEXT,
                latitude        REAL    NOT NULL,
                longitude       REAL    NOT NULL,
                detection_count INTEGER DEFAULT 1,
                verified        INTEGER DEFAULT 0,
                first_detected  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_detected   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved        INTEGER DEFAULT 0
            )
        """)
        conn.commit()
    print(f"[DB] Initialised. Path: {DB_PATH}")


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def add_detection(
    hazard_type: str,
    severity: Optional[str],
    lat: float,
    lng: float,
) -> dict:
    """Record a new sensor detection and apply crowd-verification logic.

    Steps:
    1. Fetch all active (resolved=0) hazards from the DB.
    2. For each existing hazard, compute Haversine distance from (lat, lng).
    3. If an existing hazard of the same type is within MERGE_RADIUS_METRES:
       - Increment its detection_count.
       - Update last_detected to now.
       - If detection_count reaches VERIFICATION_THRESHOLD: mark verified=1.
    4. If no nearby match found: insert a new unverified hazard.

    Args:
        hazard_type: 'pothole' or 'speedbreaker' (case-insensitive stored as lower).
        severity:    'shallow', 'medium', 'deep', or None for speedbreakers.
        lat:         Latitude of the detection.
        lng:         Longitude of the detection.

    Returns:
        dict with keys {id, verified, detection_count}.
    """
    hazard_type = hazard_type.lower().strip()
    if severity:
        severity = severity.lower().strip()

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        # Fetch all active hazards of the same type for proximity check.
        existing = conn.execute(
            "SELECT id, latitude, longitude, detection_count, verified "
            "FROM hazards WHERE resolved = 0 AND type = ?",
            (hazard_type,),
        ).fetchall()

        # Find the closest hazard within the merge radius.
        matched_id: Optional[int] = None
        for row in existing:
            dist = haversine_distance(lat, lng, row["latitude"], row["longitude"])
            if dist <= MERGE_RADIUS_METRES:
                matched_id = row["id"]
                break  # Use the first (chronologically oldest) match.

        now = datetime.utcnow().isoformat(sep=" ", timespec="seconds")

        if matched_id is not None:
            # --- Update existing hazard ---
            # Increment count and check if threshold is now reached.
            conn.execute(
                "UPDATE hazards "
                "SET detection_count = detection_count + 1, "
                "    last_detected = ?, "
                "    verified = CASE WHEN detection_count + 1 >= ? THEN 1 ELSE verified END "
                "WHERE id = ?",
                (now, VERIFICATION_THRESHOLD, matched_id),
            )
            conn.commit()

            updated = conn.execute(
                "SELECT id, detection_count, verified FROM hazards WHERE id = ?",
                (matched_id,),
            ).fetchone()

            return {
                "id": updated["id"],
                "verified": bool(updated["verified"]),
                "detection_count": updated["detection_count"],
            }
        else:
            # --- Insert new hazard ---
            cursor = conn.execute(
                "INSERT INTO hazards (type, severity, latitude, longitude, "
                "                     detection_count, verified, "
                "                     first_detected, last_detected, resolved) "
                "VALUES (?, ?, ?, ?, 1, 0, ?, ?, 0)",
                (hazard_type, severity, lat, lng, now, now),
            )
            conn.commit()
            new_id = cursor.lastrowid

            return {
                "id": new_id,
                "verified": False,
                "detection_count": 1,
            }


def clear_all() -> None:
    """Delete every record from the hazards table (used for demo reset)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM hazards")
        conn.commit()
    print("[DB] All hazards cleared.")


def mark_resolved(hazard_id: int) -> None:
    """Mark a single hazard as resolved (soft delete — keeps history).

    Args:
        hazard_id: Primary key of the hazard to resolve.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            "UPDATE hazards SET resolved = 1 WHERE id = ?",
            (hazard_id,),
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_verified_hazards() -> list[dict]:
    """Return all active verified hazards (verified=1, resolved=0)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM hazards WHERE verified = 1 AND resolved = 0 "
            "ORDER BY first_detected DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_all_hazards() -> list[dict]:
    """Return all active hazards, including unverified ones (resolved=0)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM hazards WHERE resolved = 0 "
            "ORDER BY first_detected DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_stats() -> dict:
    """Return aggregate counts for the stats panel.

    Returns:
        dict with keys: total, verified, potholes, speedbreakers,
                        deep, medium, shallow.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row

        def count(where: str, params: tuple = ()) -> int:
            row = conn.execute(
                f"SELECT COUNT(*) AS n FROM hazards WHERE resolved = 0 AND {where}",
                params,
            ).fetchone()
            return row["n"] if row else 0

        return {
            "total":        count("1 = 1"),
            "verified":     count("verified = 1"),
            "potholes":     count("type = ?", ("pothole",)),
            "speedbreakers": count("type = ?", ("speedbreaker",)),
            "deep":         count("severity = ?", ("deep",)),
            "medium":       count("severity = ?", ("medium",)),
            "shallow":      count("severity = ?", ("shallow",)),
        }


# ---------------------------------------------------------------------------
# Auto-initialise when this module is imported.
# ---------------------------------------------------------------------------
init_db()
