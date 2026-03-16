/**
 * SmartRoadHazard — Map & Live Polling Logic
 * Uses Leaflet.js + OpenStreetMap (FREE, no API key required)
 * Polls Flask API at localhost:5001 every 2 seconds
 */

const API_BASE = 'http://localhost:5001';
const POLL_INTERVAL_MS = 2000;

// Track markers by hazard id so we never duplicate
const markers = {};
const knownHazardIds = new Set();

let map;

// ── Marker colours per severity / type ───────────────────────
const COLORS = {
  deep:         '#e74c3c',   // red
  medium:       '#e67e22',   // orange
  shallow:      '#f1c40f',   // yellow
  speedbreaker: '#3498db',   // blue
  unverified:   '#95a5a6',   // grey
};

function resolveColor(hazard) {
  if (!hazard.verified) return COLORS.unverified;
  if (hazard.type === 'speedbreaker') return COLORS.speedbreaker;
  return COLORS[hazard.severity] || COLORS.unverified;
}

// ── Build a circular SVG icon for Leaflet ────────────────────
function makeIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2.5"/>
  </svg>`;
  return L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(svg),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// ── Initialise Leaflet map ────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([21.1458, 79.0882], 14);

  // OpenStreetMap tile layer — completely free, no key needed
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Hide loading overlay once map is ready
  const overlay = document.getElementById('map-loading');
  if (overlay) overlay.style.display = 'none';

  startPolling();
}

// ── Poll the API every 2 seconds ─────────────────────────────
function startPolling() {
  fetchAndUpdateHazards(); // first call immediately
  setInterval(fetchAndUpdateHazards, POLL_INTERVAL_MS);
}

async function fetchAndUpdateHazards() {
  try {
    const res = await fetch(`${API_BASE}/api/hazards/all`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hazards = await res.json();

    hazards.forEach(h => addOrUpdateMarker(h));
    updateStats(hazards);
    setConnectionStatus(true);

    const ts = document.getElementById('last-updated');
    if (ts) ts.textContent = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Poll error:', err);
    setConnectionStatus(false);
  }
}

// ── Add a new marker or update colour if verified status changed ──
function addOrUpdateMarker(hazard) {
  const color = resolveColor(hazard);
  const icon  = makeIcon(color);

  if (markers[hazard.id]) {
    // Update icon in case verified status changed
    markers[hazard.id].setIcon(icon);
    return;
  }

  // First time seeing this hazard — create marker
  const marker = L.marker([hazard.lat, hazard.lng], { icon })
    .addTo(map)
    .bindPopup(buildPopup(hazard));

  marker.on('click', () => marker.openPopup());
  markers[hazard.id] = marker;

  // Shadow alert for newly verified deep/medium potholes
  if (hazard.verified && (hazard.severity === 'deep' || hazard.severity === 'medium')) {
    if (!knownHazardIds.has(hazard.id)) {
      showAlert(`⚠️ ${(hazard.severity || '').toUpperCase()} POTHOLE detected near (${Number(hazard.lat).toFixed(4)}, ${Number(hazard.lng).toFixed(4)}) — Hazard Shadow Alert active!`);
    }
  }

  knownHazardIds.add(hazard.id);
}

// ── Popup HTML content ────────────────────────────────────────
function buildPopup(h) {
  const type     = (h.type || '').toUpperCase();
  const severity = h.severity ? h.severity.toUpperCase() : '—';
  const status   = h.verified ? '✅ Verified' : `⏳ Pending (${h.detection_count}/3)`;
  const time     = h.first_detected ? new Date(h.first_detected).toLocaleString() : 'Unknown';
  return `
    <div style="min-width:200px;font-family:sans-serif">
      <h3 style="margin:0 0 6px;color:#e94560">🚧 ${type}${h.severity ? ' — ' + severity : ''}</h3>
      <p style="margin:2px 0"><b>Status:</b> ${status}</p>
      <p style="margin:2px 0"><b>Detections:</b> ${h.detection_count}</p>
      <p style="margin:2px 0"><b>First seen:</b> ${time}</p>
      <p style="margin:2px 0"><b>Location:</b> ${Number(h.lat).toFixed(5)}, ${Number(h.lng).toFixed(5)}</p>
    </div>`;
}

// ── Update sidebar stats ──────────────────────────────────────
function updateStats(hazards) {
  const total         = hazards.length;
  const verified      = hazards.filter(h => h.verified).length;
  const potholes      = hazards.filter(h => h.type === 'pothole').length;
  const speedbreakers = hazards.filter(h => h.type === 'speedbreaker').length;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total',        total);
  set('stat-verified',     verified);
  set('stat-potholes',     potholes);
  set('stat-speedbreakers', speedbreakers);
}

// ── Bottom alert bar ─────────────────────────────────────────
function showAlert(message) {
  const bar = document.getElementById('alert-bar');
  const msg = document.getElementById('alert-message');
  if (!bar || !msg) return;
  msg.textContent = message;
  bar.style.display = 'flex';
  clearTimeout(bar._timer);
  bar._timer = setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

// ── Connection status indicator ───────────────────────────────
function setConnectionStatus(ok) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.textContent = ok ? '● Connected' : '● Disconnected';
  el.style.color  = ok ? '#00ff88'     : '#e74c3c';
}

// ── Reset all hazards ─────────────────────────────────────────
async function resetHazards() {
  if (!confirm('Clear all hazards from the database and map?')) return;
  try {
    await fetch(`${API_BASE}/api/hazards`, { method: 'DELETE' });
    Object.values(markers).forEach(m => map.removeLayer(m));
    Object.keys(markers).forEach(k => delete markers[k]);
    knownHazardIds.clear();
    updateStats([]);
    alert('All hazards cleared!');
  } catch (err) {
    alert('Error clearing hazards: ' + err.message);
  }
}

// Start the map when the page loads
window.addEventListener('load', initMap);
