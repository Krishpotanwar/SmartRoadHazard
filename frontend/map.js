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
const markers      = {};       // id → Leaflet marker
const markerColors = {};       // id → hex color string (for deselect restore)
const knownHazardIds = new Set();
let   selectedId   = null;     // currently highlighted marker id

let map;

// GPS — real device location from browser
let currentGps = null;
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

// ── Div-based icon (supports CSS hover + selected state) ──────────
function makeIcon(color, selected = false) {
  const size = selected ? 30 : 22;
  const half = size / 2;
  return L.divIcon({
    className: '',
    html: `<div class="hzd-dot${selected ? ' hzd-selected' : ''}"
      style="background:${color};width:${size}px;height:${size}px;
             margin:${-half}px 0 0 ${-half}px;
             ${selected ? `box-shadow:0 0 0 4px white,0 0 0 7px ${color},0 0 22px ${color}` : ''}">
    </div>`,
    iconSize:    [size, size],
    iconAnchor:  [half, half],
    popupAnchor: [0, -(half + 8)],
  });
}

// ── Initialise Leaflet map ────────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([21.1458, 79.0882], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Click on empty map → deselect current marker
  map.on('click', (e) => {
    if (e.originalEvent.target === map.getContainer().querySelector('canvas') ||
        e.originalEvent.target.classList.contains('leaflet-tile')) {
      deselectMarker();
    }
  });

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

    startGPS(db);

    db.ref('/hazards').on('value', (snapshot) => {
      setConnectionStatus(true);
      const ts = document.getElementById('last-updated');
      if (ts) ts.textContent = new Date().toLocaleTimeString();

      const data = snapshot.val();
      if (!data) { updateStats([]); return; }

      const hazards = Object.entries(data).map(([key, val]) => ({ ...val, id: key }));

      // Patch lat=0 entries with real GPS
      if (gpsReady && currentGps) {
        hazards.forEach(h => {
          if (Number(h.lat) === 0 && Number(h.lng) === 0) {
            db.ref('/hazards/' + h.id).update({
              lat: currentGps.lat,
              lng: currentGps.lng,
              accuracy: currentGps.accuracy,
              gps_source: 'browser',
            });
            h.lat = currentGps.lat;
            h.lng = currentGps.lng;
          }
        });
      }

      const mappable = hazards.filter(h => Number(h.lat) !== 0 || Number(h.lng) !== 0);
      mappable.forEach(h => addOrUpdateMarker(h));
      updateStats(hazards);
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
    setGpsFallback(db);
    return;
  }
  updateGpsStatus('requesting');
  navigator.geolocation.watchPosition(
    (pos) => onGpsSuccess(db, pos),
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
  db.ref('/vehicle/position').set({ lat, lng, accuracy, ts: Math.floor(Date.now() / 1000), source: 'browser' });
}

function onGpsError(db, err) {
  updateGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
  if (!gpsReady) setGpsFallback(db);
}

function setGpsFallback(db) {
  currentGps = { lat: 21.1458, lng: 79.0882, accuracy: 999 };
  gpsReady   = true;
  db.ref('/vehicle/position').set({ lat: 21.1458, lng: 79.0882, accuracy: 999, ts: Math.floor(Date.now() / 1000), source: 'fallback' });
}

function updateGpsStatus(state) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  const s = {
    requesting:  { text: '📡 GPS initialising…',              color: '#f39c12' },
    active:      { text: '📍 GPS Active',                     color: '#00ff88' },
    denied:      { text: '🚫 GPS Denied (Nagpur fallback)',   color: '#e67e22' },
    unavailable: { text: '⚠️ GPS Unavailable (Nagpur fallback)', color: '#e67e22' },
  }[state] || { text: '📡 GPS initialising…', color: '#f39c12' };
  el.textContent = s.text;
  el.style.color = s.color;
}

// ── Local mode — poll Flask API ───────────────────────────────────
function startPolling() {
  fetchAndUpdateHazards();
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

// ── Marker management ─────────────────────────────────────────────
function addOrUpdateMarker(hazard) {
  const color = resolveColor(hazard);
  markerColors[hazard.id] = color;

  if (markers[hazard.id]) {
    // Update position and icon color (preserve selected state)
    markers[hazard.id].setLatLng([hazard.lat, hazard.lng]);
    if (selectedId !== hazard.id) {
      markers[hazard.id].setIcon(makeIcon(color, false));
    }
    // Refresh tooltip content
    markers[hazard.id].setTooltipContent(buildTooltip(hazard));
    return;
  }

  const marker = L.marker([hazard.lat, hazard.lng], { icon: makeIcon(color, false) })
    .addTo(map);

  // ── Hover tooltip — follows mouse cursor ──
  marker.bindTooltip(buildTooltip(hazard), {
    sticky:    true,       // tooltip follows mouse
    direction: 'top',
    className: 'hazard-tooltip',
    offset:    [0, -14],
  });

  // ── Click — highlight this marker, dim others ──
  marker.on('click', () => selectMarker(hazard.id));

  markers[hazard.id]  = marker;

  // Hazard shadow alert for new verified severe potholes
  if (hazard.verified && (hazard.severity === 'deep' || hazard.severity === 'medium')) {
    if (!knownHazardIds.has(hazard.id)) {
      showAlert(`⚠️ ${(hazard.severity || '').toUpperCase()} POTHOLE detected near (${Number(hazard.lat).toFixed(4)}, ${Number(hazard.lng).toFixed(4)}) — Hazard Shadow Alert active!`);
    }
  }
  knownHazardIds.add(hazard.id);
}

function selectMarker(id) {
  // Restore previous selection
  if (selectedId && markers[selectedId]) {
    markers[selectedId].setIcon(makeIcon(markerColors[selectedId], false));
    markers[selectedId].getElement()?.classList.remove('hzd-dimmed');
  }

  if (selectedId === id) {
    // Toggle off — clicking the same marker deselects
    selectedId = null;
    // Un-dim all
    Object.keys(markers).forEach(k => markers[k].getElement()?.classList.remove('hzd-dimmed'));
    return;
  }

  selectedId = id;
  markers[id].setIcon(makeIcon(markerColors[id], true));

  // Dim all other markers
  Object.keys(markers).forEach(k => {
    const el = markers[k].getElement();
    if (!el) return;
    el.classList.toggle('hzd-dimmed', k !== id);
  });
}

function deselectMarker() {
  if (!selectedId) return;
  if (markers[selectedId]) {
    markers[selectedId].setIcon(makeIcon(markerColors[selectedId], false));
  }
  Object.keys(markers).forEach(k => markers[k].getElement()?.classList.remove('hzd-dimmed'));
  selectedId = null;
}

// ── Tooltip HTML (compact, shown on hover) ────────────────────────
function buildTooltip(h) {
  const type     = (h.type || '').toUpperCase();
  const severity = h.severity ? ` — ${h.severity.toUpperCase()}` : '';
  const status   = h.verified ? '✅ Verified' : `⏳ ${h.detection_count}/3 reports`;
  const time     = h.first_detected
    ? new Date(h.first_detected).toLocaleTimeString()
    : (h.timestamp ? new Date(h.timestamp * 1000).toLocaleTimeString() : '');
  return `<div class="tt-type">🚧 ${type}${severity}</div>
          <div class="tt-status">${status}</div>
          ${time ? `<div class="tt-time">${time}</div>` : ''}`;
}

// ── Stats panel ───────────────────────────────────────────────────
function updateStats(hazards) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-total',         hazards.length);
  set('stat-verified',      hazards.filter(h => h.verified).length);
  set('stat-potholes',      hazards.filter(h => h.type === 'pothole').length);
  set('stat-speedbreakers', hazards.filter(h => h.type === 'speedbreaker').length);
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
  el.style.color  = ok ? '#00ff88'    : '#e74c3c';
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
    Object.keys(markerColors).forEach(k => delete markerColors[k]);
    knownHazardIds.clear();
    selectedId = null;
    updateStats([]);
    alert('All hazards cleared!');
  } catch (err) {
    alert('Error clearing hazards: ' + err.message);
  }
}

// ── Simulate a detection (demo backup when Wokwi HTTP fails) ──────
function simulateDetection(type, severity) {
  if (MODE !== 'firebase') { alert('Only works in Firebase mode'); return; }
  const db  = firebase.database();
  const key = Date.now();
  const lat = currentGps ? currentGps.lat : 21.1458;
  const lng = currentGps ? currentGps.lng : 79.0882;
  db.ref('/hazards/' + key).set({
    type,
    severity: severity || null,
    lat, lng,
    verified: false,
    detection_count: 1,
    timestamp: Math.floor(key / 1000),
    gps_source: 'simulated',
  });
}

window.addEventListener('load', initMap);
