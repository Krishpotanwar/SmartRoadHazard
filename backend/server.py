"""
server.py — Flask REST API for SmartRoadHazard.

Exposes endpoints consumed by the frontend dashboard and the bridge script.
CORS is fully enabled so the frontend can call the API from a file:// origin
(when index.html is opened directly in a browser without a local HTTP server).

Run:
    python server.py

Server starts at http://localhost:5001
"""

from flask import Flask, jsonify, request
from flask_cors import CORS

import database  # local module — handles all SQLite operations

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)

# Allow requests from any origin — necessary because the frontend is served
# from the filesystem (file://) rather than a web server.
CORS(app, resources={r"/*": {"origins": "*"}})


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _json(data: dict | list, status: int = 200):
    """Return a JSON response with the correct Content-Type header."""
    response = jsonify(data)
    response.status_code = status
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def root():
    """Health-check endpoint — confirms the server is running."""
    return _json({
        "status": "ok",
        "message": "SmartRoadHazard API is running",
        "endpoints": [
            "GET  /api/hazards",
            "GET  /api/hazards/all",
            "POST /api/hazards",
            "GET  /api/stats",
            "DELETE /api/hazards",
        ],
    })


@app.route("/api/hazards", methods=["GET"])
def get_verified_hazards():
    """Return all *verified* active hazards (detection_count >= 3).

    Used by the frontend to show confirmed hazard markers on the map.
    """
    hazards = database.get_verified_hazards()
    return _json(hazards)


@app.route("/api/hazards/all", methods=["GET"])
def get_all_hazards():
    """Return ALL active hazards, including unverified (pending) ones.

    Used by the frontend to show grey 'pending' markers alongside verified ones.
    """
    hazards = database.get_all_hazards()
    return _json(hazards)


@app.route("/api/hazards", methods=["POST"])
def add_hazard():
    """Record a new hazard detection from a sensor reading.

    Expected JSON body:
        {
            "type":     "pothole" | "speedbreaker",
            "severity": "shallow" | "medium" | "deep" | null,
            "lat":      float,
            "lng":      float
        }

    Returns:
        {
            "success":         true,
            "message":         str,
            "verified":        bool,
            "detection_count": int,
            "id":              int
        }
    """
    body = request.get_json(silent=True)

    # Validate that the request body exists and contains mandatory fields.
    if not body:
        return _json({"success": False, "message": "Request body must be JSON"}, 400)

    missing = [f for f in ("type", "lat", "lng") if f not in body]
    if missing:
        return _json(
            {"success": False, "message": f"Missing required fields: {', '.join(missing)}"},
            400,
        )

    hazard_type = body["type"]
    severity = body.get("severity")  # Optional — None is valid for speedbreakers.
    lat = body["lat"]
    lng = body["lng"]

    # Basic type validation.
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return _json({"success": False, "message": "lat and lng must be numbers"}, 400)

    result = database.add_detection(hazard_type, severity, float(lat), float(lng))

    status_word = "verified" if result["verified"] else "pending verification"
    return _json({
        "success": True,
        "message": f"Detection recorded — {status_word} ({result['detection_count']} reports)",
        "id": result["id"],
        "verified": result["verified"],
        "detection_count": result["detection_count"],
    })


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return aggregate statistics for the dashboard stats panel.

    Returns:
        {
            "total":         int,
            "verified":      int,
            "potholes":      int,
            "speedbreakers": int,
            "deep":          int,
            "medium":        int,
            "shallow":       int
        }
    """
    stats = database.get_stats()
    return _json(stats)


@app.route("/api/hazards", methods=["DELETE"])
def clear_hazards():
    """Delete all hazard records from the database.

    Intended for demo resets — lets the presenter start fresh without
    restarting the server.
    """
    database.clear_all()
    return _json({"success": True, "message": "All hazards cleared"})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 50)
    print("  SmartRoadHazard API Server")
    print("  http://localhost:5001")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5001, debug=True)
