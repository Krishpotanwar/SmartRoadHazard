#!/bin/bash
# ============================================================
#  SmartRoadHazard — One-Click Launcher
#  Usage: bash run.sh
#  Starts Flask server, demo bridge, and opens the dashboard
# ============================================================

set -e  # Exit on any error

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"  # Absolute path to this script's folder
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🚗 Smart Road Hazard Detection System      ║"
echo "║   Ramdeobaba University, Nagpur              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Install Python dependencies ─────────────────────
echo "📦 Installing Python dependencies..."
pip install -r "$BACKEND_DIR/requirements.txt" --quiet
echo "   ✓ Dependencies ready"

# ── Step 2: Kill any process already using port 5000 ────────
echo "🔍 Checking port 5000..."
if lsof -ti:5000 > /dev/null 2>&1; then
    echo "   ⚠️  Port 5000 in use — killing existing process..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    sleep 1
fi
echo "   ✓ Port 5000 is free"

# ── Step 3: Start Flask server in background ────────────────
echo "🐍 Starting Flask backend on http://localhost:5001 ..."
cd "$BACKEND_DIR"
python server.py > /tmp/smartroad_server.log 2>&1 &
SERVER_PID=$!
echo "   ✓ Flask server started (PID $SERVER_PID)"

# Wait until Flask is ready
echo "   ⏳ Waiting for server to be ready..."
for i in {1..10}; do
    if curl -s http://localhost:5001/ > /dev/null 2>&1; then
        echo "   ✓ Server is responding"
        break
    fi
    sleep 1
done

# ── Step 4: Start demo bridge in background ─────────────────
echo "🛰️  Starting demo bridge (auto-generating Nagpur route detections)..."
python bridge.py --mode demo > /tmp/smartroad_bridge.log 2>&1 &
BRIDGE_PID=$!
echo "   ✓ Bridge started (PID $BRIDGE_PID)"

# ── Step 5: Open dashboard in browser ───────────────────────
echo "🌐 Opening dashboard..."
sleep 1
open "$FRONTEND_DIR/index.html"
echo "   ✓ Dashboard opened in browser"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ All systems running!"
echo ""
echo "  Dashboard : file://$FRONTEND_DIR/index.html"
echo "  API       : http://localhost:5001"
echo "  Server log: tail -f /tmp/smartroad_server.log"
echo "  Bridge log: tail -f /tmp/smartroad_bridge.log"
echo ""
echo "  ── Optional: Interactive Simulator ────────────"
echo "  Open a NEW terminal and run:"
echo "  cd $BACKEND_DIR && python simulator.py"
echo "  Then press 1-4 to trigger hazards manually"
echo "  (replaces Wokwi — no copy/paste needed)"
echo ""
echo "  Press Ctrl+C to stop everything"
echo "═══════════════════════════════════════════════"
echo ""

# ── Cleanup on Ctrl+C ───────────────────────────────────────
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $SERVER_PID 2>/dev/null && echo "   ✓ Flask server stopped"
    kill $BRIDGE_PID 2>/dev/null && echo "   ✓ Bridge stopped"
    echo "   Goodbye!"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Keep script alive so Ctrl+C works
wait
