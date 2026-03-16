/**
 * SmartRoadHazard — Map & Live Polling Logic
 * Uses Leaflet.js + OpenStreetMap (FREE, no API key required)
 *
 * MODE = 'firebase' → real-time updates from Firebase RTDB (Wokwi demo)
 * MODE = 'local'    → polls Flask at localhost:5001 (simulator demo)
 */

// ── Firebase config — replace placeholders after Firebase setup ──
// See FIREBASE_SETUP.md for step-by-step instructions
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBg9oGwgQGzD5UZCOyBOjU2hFFEPUX1-0A",
  authDomain:        "smartroadhazard.firebaseapp.com",
  databaseURL:       "https://smartroadhazard-default-rtdb.firebaseio.com",
  projectId:         "smartroadhazard",
  storageBucket:     "smartroadhazard.firebasestorage.app",
  messagingSenderId: "495982184999",
  appId:             "1:495982184999:web:901e9ed1c880286d025c02",
  measurementId:     "G-XDTZ5V4V0P",
};

// Change to 'local' when running the offline simulator demo
const MODE = 'firebase';

// Flask backend URL (used when MODE = 'local')
// Replace YOUR-RENDER-APP with your actual Render domain after deployment
// render.com — free, no credit card required
const API_BASE = 'https://YOUR-RENDER-APP.onrender.com';
const POLL_INTERVAL_MS = 2000;

// ── State ────────────────────────────────────────────────────────
const markers = {};
const knownHazardIds = new Set();

let map;
let vehicleMarker;
let trailLine;
const vehicleTrail = [];

// GPS state — real device location supplied by the browser
let currentGps    = null;   // {lat, lng, accuracy} — null until first fix
let gpsReady      = false;  // true after first valid position received
const pendingQueue = [];     // pending_hazard events that arrived before GPS was ready

// ── Marker colours per severity / type ───────────────────────────
const COLORS = {
  deep:         '#e74c3c',
  medium:       '#e67e22',
  shallow:      '#f1c40f',
  speedbreaker: '#3498db',
  unverified:   '#95a5a6',
};

function resolveColor(hazard) {
  if (!hazard.verified) return COLORS.unverified;
  if (hazard.type === 'speedbreaker') return COLORS.speedbreaker;
  return COLORS[hazard.severity] || COLORS.unverified;
}

// ── SVG circle icon for hazard markers ───────────────────────────
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

// ── Initialise Leaflet map ────────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([21.1458, 79.0882], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Vehicle emoji marker
  const vehicleIcon = L.divIcon({
    className: '',
    html: '<div style="font-size:26px;transform:translate(-50%,-50%)">🚗</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

  vehicleMarker = L.marker([21.145800, 79.088200], {
    icon: vehicleIcon,
    zIndexOffset: 1000,
  }).addTo(map);

  // Green dashed trail
  trailLine = L.polyline([], {
    color: '#00ff88',
    weight: 2,
    opacity: 0.5,
    dashArray: '5, 8',
  }).addTo(map);

  const overlay = document.getElementById('map-loading');
  if (overlay) overlay.style.display = 'none';

  // Branch on mode — Firebase uses real-time listeners, local uses polling
  if (MODE === 'firebase') {
    initFirebase();
    updateModeIndicator('🔥 Firebase Mode');
  } else {
    startPolling();
    updateModeIndicator('🖥 Local Mode');
  }
}

// ── Firebase mode ────────────────────────────────────────────────
// Initialise Firebase app and attach real-time listeners
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();

    // Start real GPS — browser supplies coordinates; ESP32 no longer sends them
    startGPS(db);

    // Real-time hazard listener — fires on every new/changed hazard
    db.ref('/hazards').on('value', (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      // Attach Firebase key as 'id' so addOrUpdateMarker can track duplicates
      const hazards = Object.entries(data).map(([key, val]) => ({
        ...val,
        id: key,
      }));
      hazards.forEach(h => addOrUpdateMarker(h));
      updateStats(hazards);
      setConnectionStatus(true);
      const ts = document.getElementById('last-updated');
      if (ts) ts.textContent = new Date().toLocaleTimeString();
    });

    // Real-time vehicle position listener — now comes from browser GPS (via onGpsSuccess)
    db.ref('/vehicle/position').on('value', (snapshot) => {
      const v = snapshot.val();
      if (!v) return;
      updateVehicleMarker(v.lat, v.lng, v.speed);
    });

    // Listen for pending hazards pushed by the ESP32 (no GPS coordinates yet)
    // Browser stamps current GPS location and moves them to /hazards
    db.ref('/pending_hazards').on('child_added', (snapshot) => {
      const key   = snapshot.key;
      const event = snapshot.val();
      if (!event) return;
      if (gpsReady) {
        resolveAndPostHazard(db, key, event);
      } else {
        pendingQueue.push({ key, event });
      }
    });

  } catch (err) {
    console.error('Firebase init error:', err);
    setConnectionStatus(false);
    // Fallback to local polling if Firebase fails
    startPolling();
  }
}

// ── Real Device GPS ───────────────────────────────────────────────
// Requests the browser's GPS and keeps a live position watch.
// The vehicle marker moves to the real location; pending hazards
// from the ESP32 get stamped with these coordinates.
function startGPS(db) {
  if (!navigator.geolocation) {
    updateGpsStatus('unavailable');
    return;
  }
  updateGpsStatus('requesting');
  navigator.geolocation.watchPosition(
    (position) => onGpsSuccess(db, position),
    onGpsError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
  );
}

function onGpsSuccess(db, position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  currentGps = { lat, lng, accuracy };

  if (!gpsReady) {
    gpsReady = true;
    updateGpsStatus('active');
    processPendingQueue(db);
  }

  // Move vehicle marker to real location
  updateVehicleMarker(lat, lng, null);

  // Publish real position to Firebase so other clients see the vehicle
  db.ref('/vehicle/position').set({
    lat, lng, accuracy,
    ts: Math.floor(Date.now() / 1000),
    source: 'browser',
  });
}

function onGpsError(err) {
  if (err.code === err.PERMISSION_DENIED) {
    updateGpsStatus('denied');
    showAlert('GPS permission denied — hazard pins will use approximate location.');
  } else {
    // Non-fatal: watchPosition keeps trying
    updateGpsStatus('unavailable');
  }
}

function updateGpsStatus(state) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  const map = {
    requesting:  { text: '📡 GPS initialising…',   color: '#f39c12' },
    active:      { text: '📍 GPS Active',           color: '#00ff88' },
    denied:      { text: '🚫 GPS Denied',           color: '#e74c3c' },
    unavailable: { text: '⚠️ GPS Unavailable',      color: '#e67e22' },
  };
  const s = map[state] || map.requesting;
  el.textContent  = s.text;
  el.style.color  = s.color;
}

// Drain any pending_hazard events that arrived before GPS was ready
function processPendingQueue(db) {
  while (pendingQueue.length > 0) {
    const { key, event } = pendingQueue.shift();
    resolveAndPostHazard(db, key, event);
  }
}

// Stamp current GPS onto a pending hazard, write to /hazards, delete from /pending_hazards
function resolveAndPostHazard(db, key, event) {
  if (!currentGps) return; // Should not happen after gpsReady, but guard anyway
  const { lat, lng, accuracy } = currentGps;
  db.ref('/hazards/' + key).set({
    type:            event.type,
    severity:        event.severity || null,
    lat,
    lng,
    accuracy,
    verified:        false,
    detection_count: 1,
    timestamp:       event.timestamp || Math.floor(Date.now() / 1000),
    gps_source:      'browser',
  })
  .then(() => db.ref('/pending_hazards/' + key).remove())
  .catch(err => console.error('resolveAndPostHazard failed for key', key, err));
}

// ── Shared vehicle marker updater (used by both modes) ───────────
function updateVehicleMarker(lat, lng, speed) {
  if (!vehicleMarker) return;
  const pos = [lat, lng];
  vehicleMarker.setLatLng(pos);
  vehicleMarker.bindPopup(
    `<b>🚗 Vehicle</b><br/>` +
    `Lat: ${Number(lat).toFixed(5)}<br/>` +
    `Lng: ${Number(lng).toFixed(5)}<br/>` +
    `Speed: ${speed || 30} km/h`
  );
  vehicleTrail.push(pos);
  if (vehicleTrail.length > 15) vehicleTrail.shift();
  trailLine.setLatLngs(vehicleTrail);
}

// ── Local mode — poll Flask API ──────────────────────────────────
async function fetchVehiclePosition() {
  try {
    const res = await fetch(`${API_BASE}/api/vehicle`);
    if (!res.ok) return;
    const v = await res.json();
    updateVehicleMarker(v.lat, v.lng, v.speed);
  } catch (e) {}
}

function startPolling() {
  fetchAndUpdateHazards();
  setInterval(fetchAndUpdateHazards, POLL_INTERVAL_MS);
  fetchVehiclePosition();
  setInterval(fetchVehiclePosition, 1000);
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

// ── Marker management (shared by both modes) ─────────────────────
function addOrUpdateMarker(hazard) {
  const color = resolveColor(hazard);
  const icon  = makeIcon(color);

  if (markers[hazard.id]) {
    markers[hazard.id].setIcon(icon);
    return;
  }

  const marker = L.marker([hazard.lat, hazard.lng], { icon })
    .addTo(map)
    .bindPopup(buildPopup(hazard));
  marker.on('click', () => marker.openPopup());
  markers[hazard.id] = marker;

  if (hazard.verified && (hazard.severity === 'deep' || hazard.severity === 'medium')) {
    if (!knownHazardIds.has(hazard.id)) {
      showAlert(`⚠️ ${(hazard.severity || '').toUpperCase()} POTHOLE detected near (${Number(hazard.lat).toFixed(4)}, ${Number(hazard.lng).toFixed(4)}) — Hazard Shadow Alert active!`);
    }
  }

  knownHazardIds.add(hazard.id);
}

// ── Popup HTML — handles both Flask (first_detected) and Firebase (timestamp) fields ──
function buildPopup(h) {
  const type     = (h.type || '').toUpperCase();
  const severity = h.severity ? h.severity.toUpperCase() : '—';
  const status   = h.verified ? '✅ Verified' : `⏳ Pending (${h.detection_count}/3)`;
  const time     = h.first_detected
    ? new Date(h.first_detected).toLocaleString()
    : (h.timestamp ? new Date(h.timestamp * 1000).toLocaleString() : 'Unknown');
  return `
    <div style="min-width:200px;font-family:sans-serif">
      <h3 style="margin:0 0 6px;color:#e94560">🚧 ${type}${h.severity ? ' — ' + severity : ''}</h3>
      <p style="margin:2px 0"><b>Status:</b> ${status}</p>
      <p style="margin:2px 0"><b>Detections:</b> ${h.detection_count}</p>
      <p style="margin:2px 0"><b>First seen:</b> ${time}</p>
      <p style="margin:2px 0"><b>Location:</b> ${Number(h.lat).toFixed(5)}, ${Number(h.lng).toFixed(5)}</p>
    </div>`;
}

// ── Stats panel ───────────────────────────────────────────────────
function updateStats(hazards) {
  const total         = hazards.length;
  const verified      = hazards.filter(h => h.verified).length;
  const potholes      = hazards.filter(h => h.type === 'pothole').length;
  const speedbreakers = hazards.filter(h => h.type === 'speedbreaker').length;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total',         total);
  set('stat-verified',      verified);
  set('stat-potholes',      potholes);
  set('stat-speedbreakers', speedbreakers);
}

// ── Alert bar ─────────────────────────────────────────────────────
function showAlert(message) {
  const bar = document.getElementById('alert-bar');
  const msg = document.getElementById('alert-message');
  if (!bar || !msg) return;
  msg.textContent = message;
  bar.style.display = 'flex';
  clearTimeout(bar._timer);
  bar._timer = setTimeout(() => { bar.style.display = 'none'; }, 5000);
}

// ── Connection status ─────────────────────────────────────────────
function setConnectionStatus(ok) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.textContent = ok ? '● Connected' : '● Disconnected';
  el.style.color  = ok ? '#00ff88'     : '#e74c3c';
}

// ── Mode indicator ────────────────────────────────────────────────
function updateModeIndicator(text) {
  const el = document.getElementById('mode-indicator');
  if (el) el.textContent = text;
}

// ── Reset all hazards ─────────────────────────────────────────────
async function resetHazards() {
  if (!confirm('Clear all hazards from the database and map?')) return;
  try {
    if (MODE === 'firebase') {
      firebase.database().ref('/hazards').remove();
      firebase.database().ref('/pending_hazards').remove();
      firebase.database().ref('/vehicle').remove();
    } else {
      await fetch(`${API_BASE}/api/hazards`, { method: 'DELETE' });
    }
    Object.values(markers).forEach(m => map.removeLayer(m));
    Object.keys(markers).forEach(k => delete markers[k]);
    knownHazardIds.clear();
    updateStats([]);
    alert('All hazards cleared!');
  } catch (err) {
    alert('Error clearing hazards: ' + err.message);
  }
}

window.addEventListener('load', initMap);
