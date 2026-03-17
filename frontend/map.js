/**
 * SmartRoadHazard — Map & Live Polling Logic
 * Uses Leaflet.js + OpenStreetMap (FREE, no API key required)
 *
 * MODE = 'firebase' → real-time updates from Firebase RTDB (Wokwi demo)
 * MODE = 'local'    → polls Flask at localhost:5001 (simulator demo)
 */

// ── Firebase config ───────────────────────────────────────────────
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

const MODE = 'firebase';

// Flask backend URL (used when MODE = 'local')
const API_BASE = 'https://smartroadhazard.onrender.com';
const POLL_INTERVAL_MS = 2000;

// ── State ─────────────────────────────────────────────────────────
const markers = {};
const knownHazardIds = new Set();

let map;
let vehicleMarker;
let trailLine;
const vehicleTrail = [];

// GPS — real device location from browser
let currentGps = null;   // {lat, lng, accuracy}
let gpsReady   = false;

// ── Marker colours ────────────────────────────────────────────────
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

// ── SVG circle icon ───────────────────────────────────────────────
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

  trailLine = L.polyline([], {
    color: '#00ff88',
    weight: 2,
    opacity: 0.5,
    dashArray: '5, 8',
  }).addTo(map);

  const overlay = document.getElementById('map-loading');
  if (overlay) overlay.style.display = 'none';

  if (MODE === 'firebase') {
    initFirebase();
    updateModeIndicator('🔥 Firebase Mode');
  } else {
    startPolling();
    updateModeIndicator('🖥 Local Mode');
  }
}

// ── Firebase mode ─────────────────────────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();

    // Start GPS — browser supplies real coordinates
    startGPS(db);

    // Real-time hazard listener
    db.ref('/hazards').on('value', (snapshot) => {
      // Mark connected regardless of whether data exists
      setConnectionStatus(true);
      const ts = document.getElementById('last-updated');
      if (ts) ts.textContent = new Date().toLocaleTimeString();

      const data = snapshot.val();
      if (!data) { updateStats([]); return; }

      const hazards = Object.entries(data).map(([key, val]) => ({ ...val, id: key }));

      // Patch any lat=0 entries with real GPS if available
      if (gpsReady && currentGps) {
        hazards.forEach(h => {
          if (Number(h.lat) === 0 && Number(h.lng) === 0) {
            db.ref('/hazards/' + h.id).update({
              lat: currentGps.lat,
              lng: currentGps.lng,
              accuracy: currentGps.accuracy,
              gps_source: 'browser',
            });
            // Update locally so marker renders at correct position immediately
            h.lat = currentGps.lat;
            h.lng = currentGps.lng;
          }
        });
      }

      // Only render hazards that have valid coordinates
      const mappable = hazards.filter(h => Number(h.lat) !== 0 || Number(h.lng) !== 0);
      mappable.forEach(h => addOrUpdateMarker(h));
      updateStats(hazards);
    });

    // Vehicle position listener
    db.ref('/vehicle/position').on('value', (snapshot) => {
      const v = snapshot.val();
      if (!v) return;
      updateVehicleMarker(v.lat, v.lng, v.speed);
    });

  } catch (err) {
    console.error('Firebase init error:', err);
    setConnectionStatus(false);
    startPolling();
  }
}

// ── Real Device GPS ───────────────────────────────────────────────
function startGPS(db) {
  if (!navigator.geolocation) {
    updateGpsStatus('unavailable');
    // Fallback so demo works without GPS
    setGpsFallback(db);
    return;
  }
  updateGpsStatus('requesting');
  navigator.geolocation.watchPosition(
    (position) => onGpsSuccess(db, position),
    (err) => onGpsError(db, err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
  );
}

function onGpsSuccess(db, position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;
  currentGps = { lat, lng, accuracy };

  if (!gpsReady) {
    gpsReady = true;
    updateGpsStatus('active');
  }

  // Move vehicle marker to real location
  updateVehicleMarker(lat, lng, null);

  // Publish real position to Firebase
  db.ref('/vehicle/position').set({
    lat, lng, accuracy,
    ts: Math.floor(Date.now() / 1000),
    source: 'browser',
  });
}

function onGpsError(db, err) {
  if (err.code === err.PERMISSION_DENIED) {
    updateGpsStatus('denied');
  } else {
    updateGpsStatus('unavailable');
  }
  // Fallback to Nagpur centre so hazard pins still appear during demo
  if (!gpsReady) {
    setGpsFallback(db);
  }
}

// Use Nagpur centre as fallback GPS so demo works even without device GPS
function setGpsFallback(db) {
  currentGps = { lat: 21.1458, lng: 79.0882, accuracy: 999 };
  gpsReady = true;
  db.ref('/vehicle/position').set({
    lat: 21.1458, lng: 79.0882, accuracy: 999,
    ts: Math.floor(Date.now() / 1000),
    source: 'fallback',
  });
}

function updateGpsStatus(state) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  const states = {
    requesting:  { text: '📡 GPS initialising…', color: '#f39c12' },
    active:      { text: '📍 GPS Active',         color: '#00ff88' },
    denied:      { text: '🚫 GPS Denied (Nagpur fallback)', color: '#e67e22' },
    unavailable: { text: '⚠️ GPS Unavailable (Nagpur fallback)', color: '#e67e22' },
  };
  const s = states[state] || states.requesting;
  el.textContent = s.text;
  el.style.color = s.color;
}

// ── Shared vehicle marker updater ─────────────────────────────────
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

// ── Local mode — poll Flask API ───────────────────────────────────
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

// ── Marker management ─────────────────────────────────────────────
function addOrUpdateMarker(hazard) {
  const color = resolveColor(hazard);
  const icon  = makeIcon(color);

  if (markers[hazard.id]) {
    markers[hazard.id].setIcon(icon);
    markers[hazard.id].setLatLng([hazard.lat, hazard.lng]);
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

// ── Popup HTML ────────────────────────────────────────────────────
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
