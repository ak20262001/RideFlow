'use strict';

// ============================================================
// SECTION 1: FILE HANDLER (driver only — IIFE module)
// ============================================================
const FileHandler = (() => {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  /**
   * Validate and convert an image File to a base64 data URL.
   * @param {File} file
   * @returns {Promise<{dataUrl: string, fileName: string}>}
   */
  function processFile(file) {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        reject(new Error('Only JPG, PNG, GIF, and WebP images are supported.'));
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        reject(new Error('Image must be smaller than 5 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onload  = (e) => resolve({ dataUrl: e.target.result, fileName: file.name });
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }

  // Escape HTML special characters to prevent injection
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Build an <img> element for use inside a chat bubble.
   * @param {string} dataUrl
   * @param {string} fileName
   * @returns {string} HTML string
   */
  function renderImageBubble(dataUrl, fileName) {
    const safeName = _esc(fileName || 'image');
    // Only accept data: URLs starting with data:image/ to prevent protocol injection
    const safeSrc  = (typeof dataUrl === 'string' && /^data:image\//.test(dataUrl))
      ? dataUrl : '';
    return `<div class="img-msg-wrap">
      <img class="chat-img" src="${safeSrc}" alt="${safeName}"
           onclick="ChatImageViewer.open(this.src)" />
      <div class="img-msg-name">${safeName}</div>
    </div>`;
  }

  /**
   * Attach drag-and-drop listeners to a drop zone element.
   * @param {HTMLElement} dropZone
   * @param {Function}    onFile   Called with the dropped File
   */
  function attachDropZone(dropZone, onFile) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    });
  }

  return { processFile, renderImageBubble, attachDropZone };
})();

// ============================================================
// SECTION 2: CHAT IMAGE VIEWER (driver only — IIFE)
// ============================================================
const ChatImageViewer = (() => {
  let _overlay = null;

  function _ensureOverlay() {
    if (_overlay) return;
    _overlay = document.createElement('div');
    _overlay.id = 'chatImgViewerOverlay';
    _overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9999;',
      'background:rgba(0,0,0,0.92);',
      'display:none;align-items:center;justify-content:center;',
      'cursor:zoom-out;',
    ].join('');

    const img = document.createElement('img');
    img.style.cssText = 'max-width:94vw;max-height:90vh;border-radius:10px;object-fit:contain;';
    _overlay.appendChild(img);
    _overlay.addEventListener('click', close);
    document.body.appendChild(_overlay);
  }

  function open(src) {
    _ensureOverlay();
    _overlay.querySelector('img').src = src;
    _overlay.style.display = 'flex';
  }

  function close() {
    if (_overlay) _overlay.style.display = 'none';
  }

  return { open, close };
})();

// ============================================================
// SECTION 3: MAP INTEGRATION (driver only — IIFE)
// ============================================================
const MapIntegration = (() => {
  const DRIVER_LOC_KEY   = 'rideflow-driver-location';
  const CUSTOMER_LOC_KEY = 'rideflow-customer-location';
  const UPDATE_INTERVAL  = 10000; // 10 seconds

  let _map            = null;
  let _driverMarker   = null;
  let _customerMarker = null;
  let _destMarker     = null;
  let _routeLine      = null;
  let _watchId        = null;
  let _updateTimer    = null;
  let _onStatusChange = null;

  // Default center (Jakarta)
  const DEFAULT_CENTER = [-6.2088, 106.8456];
  const DEFAULT_ZOOM   = 13;

  // Icon factory
  function _makeIcon(color, emoji) {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:34px;height:34px;border-radius:50%;
        background:${color};
        display:flex;align-items:center;justify-content:center;
        font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.45);
        border:2px solid rgba(255,255,255,0.7);
      ">${emoji}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -20],
    });
  }

  const ICONS = {
    driver:   () => _makeIcon('#3b82f6', '🏍️'),
    customer: () => _makeIcon('#ef4444', '📍'),
    dest:     () => _makeIcon('#22c55e', '🏁'),
  };

  /**
   * Initialize the Leaflet map inside the given container.
   * @param {string}   containerId
   * @param {Function} [onStatusChange]
   */
  function init(containerId, onStatusChange) {
    _onStatusChange = onStatusChange || null;

    if (!window.L) {
      _status('⚠️ Map library not loaded');
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    _map = L.map(containerId, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(_map);

    _status('Map ready · Requesting location…');
    _requestGeolocation();
  }

  function _requestGeolocation() {
    if (!navigator.geolocation) {
      _status('Geolocation not supported · Using default area');
      _setDriverMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
        _startWatching();
        _status('📍 Live location active');
      },
      () => {
        _status('Location denied · Showing default area');
        _setDriverMarker(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
        _persistDriverLocation(DEFAULT_CENTER[0], DEFAULT_CENTER[1], 0, 0);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }

  function _startWatching() {
    if (_watchId !== null) navigator.geolocation.clearWatch(_watchId);

    _watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading } = pos.coords;
        _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Backup timer in case watchPosition stalls
    clearInterval(_updateTimer);
    _updateTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, heading } = pos.coords;
          _onLocationUpdate(latitude, longitude, accuracy, heading || 0);
        },
        null,
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }, UPDATE_INTERVAL);
  }

  function _onLocationUpdate(lat, lng, accuracy, heading) {
    _setDriverMarker(lat, lng);
    _persistDriverLocation(lat, lng, accuracy, heading);
    _tryDrawRoute();
  }

  function _persistDriverLocation(lat, lng, accuracy, heading) {
    const loc = {
      driverId:  'drv_001',
      latitude:  lat,
      longitude: lng,
      accuracy:  accuracy,
      heading:   heading,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(DRIVER_LOC_KEY, JSON.stringify(loc));
  }

  function _setDriverMarker(lat, lng) {
    if (!_map) return;
    if (_driverMarker) {
      _driverMarker.setLatLng([lat, lng]);
    } else {
      _driverMarker = L.marker([lat, lng], { icon: ICONS.driver() })
        .bindPopup('📍 You (Driver)')
        .addTo(_map);
    }
    _map.setView([lat, lng], _map.getZoom() || DEFAULT_ZOOM, { animate: true });
  }

  /** Set/move the customer pin on the map */
  function setCustomerLocation(lat, lng) {
    if (!_map) return;
    if (_customerMarker) {
      _customerMarker.setLatLng([lat, lng]);
    } else {
      _customerMarker = L.marker([lat, lng], { icon: ICONS.customer() })
        .bindPopup('🧑 Customer')
        .addTo(_map);
    }
    localStorage.setItem(CUSTOMER_LOC_KEY, JSON.stringify({ latitude: lat, longitude: lng, timestamp: new Date().toISOString() }));
    _tryDrawRoute();
  }

  /** Set/move the destination pin on the map */
  function setDestination(lat, lng, label) {
    if (!_map) return;
    if (_destMarker) {
      _destMarker.setLatLng([lat, lng]);
    } else {
      _destMarker = L.marker([lat, lng], { icon: ICONS.dest() })
        .bindPopup(`🏁 ${label || 'Destination'}`)
        .addTo(_map);
    }
    _tryDrawRoute();
  }

  /** Draw a polyline from driver → customer → destination if all markers exist */
  function _tryDrawRoute() {
    if (!_map || !_driverMarker || !_customerMarker) return;
    const points = [_driverMarker.getLatLng(), _customerMarker.getLatLng()];
    if (_destMarker) points.push(_destMarker.getLatLng());

    if (_routeLine) _map.removeLayer(_routeLine);
    _routeLine = L.polyline(points, {
      color: '#6ee7b7',
      weight: 3,
      opacity: 0.7,
      dashArray: '8 6',
    }).addTo(_map);
  }

  function _status(text) {
    if (_onStatusChange) _onStatusChange(text);
  }

  /** Force a map resize (needed when container becomes visible after being hidden) */
  function invalidate() {
    if (_map) _map.invalidateSize();
  }

  /** Read the last known driver location from localStorage */
  function getDriverLocation() {
    try {
      return JSON.parse(localStorage.getItem(DRIVER_LOC_KEY));
    } catch (_) {
      return null;
    }
  }

  return { init, setCustomerLocation, setDestination, invalidate, getDriverLocation };
})();

// ============================================================
// SECTION 4: DRIVER CONSTANTS & DATA
// ============================================================
const PLATFORM_FEE_RATE = (typeof CONSTANTS !== 'undefined') ? CONSTANTS.PLATFORM_FEE_RATE : 0.20;

// Shared localStorage channel key for cross-tab chat sync
const CHAT_CHANNEL = 'ORD-DEMO';

const DRIVER_INFO = {
  id: 'drv_001',
  name: 'Ahmad Rizky',
  vehicle: 'Honda Beat',
  plate: 'B 3312 XYZ',
  rating: 4.92,
  phone: '+62 812-3456-7890',
  totalTrips: 247,
  acceptRate: 95,
  completionRate: 98,
};

const MOCK_ORDERS = [
  {
    id: 'ORD-7821',
    type: 'motorcycle',
    typeLabel: 'Motorcycle',
    serviceIcon: '🛵',
    serviceName: 'GoRide',
    serviceTier: 'Standard',
    customer: {
      name: 'Siti Rahma',
      initials: 'SR',
      rating: 4.8,
      phone: '+62 818-2233-4455',
    },
    pickup: 'Mall Taman Anggrek, West Jakarta',
    destination: 'Soekarno-Hatta International Airport, Terminal 3',
    fare: 'Rp 42.000',
    fareRaw: 42000,
    distance: '12.4 km',
    time: '2 minutes ago',
    status: 'incoming',
  },
  {
    id: 'ORD-7820',
    type: 'car',
    typeLabel: 'Car',
    serviceIcon: '🚗',
    serviceName: 'GoCar',
    serviceTier: 'Premium',
    customer: {
      name: 'Budi Santoso',
      initials: 'BS',
      rating: 4.95,
      phone: '+62 821-5566-7788',
    },
    pickup: 'Bundaran HI MRT Station',
    destination: 'Sudirman Central Business District',
    fare: 'Rp 28.000',
    fareRaw: 28000,
    distance: '5.1 km',
    time: '5 minutes ago',
    status: 'incoming',
  },
];

// Initial chat messages (shown when order is accepted)
const INITIAL_MESSAGES = [
  {
    id: 1,
    from: 'system',
    text: 'Order accepted · Trip started',
    time: '09:14',
  },
  {
    id: 2,
    from: 'customer',
    text: "Hi driver, I'm at the Mall entrance 🙏",
    time: '09:15',
  },
  {
    id: 3,
    from: 'driver',
    text: 'Ready! On my way! 🏍️ ETA about 5 minutes.',
    time: '09:15',
    read: true,
  },
  {
    id: 4,
    from: 'customer',
    text: "Okay, I'm wearing a blue shirt",
    time: '09:16',
  },
];

// Simulated new order (arrives after 12 seconds on driver page)
const SIMULATED_NEW_ORDER = {
  id: 'ORD-7822',
  type: 'motorcycle',
  typeLabel: 'Motorcycle',
  serviceIcon: '🛵',
  serviceName: 'GoRide',
  serviceTier: 'Economy',
  customer: {
    name: 'Dewi Lestari',
    initials: 'DL',
    rating: 4.75,
    phone: '+62 857-9900-1122',
  },
  pickup: 'Semanggi Transjakarta Bus Stop',
  destination: 'Pasar Santa, South Jakarta',
  fare: 'Rp 18.000',
  fareRaw: 18000,
  distance: '4.3 km',
  time: 'Just now',
  status: 'incoming',
};

// ============================================================
// SECTION 5: CUSTOMER CONSTANTS & DATA
// ============================================================
const TIERS = {
  motorcycle: {
    ride: [
      { id:'standard', icon:'🏍', name:'Motorcycle Standard', desc:'Everyday rides, best value', basePrice:8000, pricePerKm:2000, eta:'3–5 min', platforms:['gojek','grab'] },
      { id:'premium',  icon:'⚡', name:'Motorcycle Premium',  desc:'Faster pickup & top-rated drivers', basePrice:14000, pricePerKm:3000, eta:'2–4 min', platforms:['grab'] },
      { id:'priority', icon:'👑', name:'Motorcycle Priority', desc:'VIP treatment, highest rated', basePrice:20000, pricePerKm:4500, eta:'1–3 min', platforms:['gojek'] },
    ],
    delivery: [
      { id:'standard', icon:'📦', name:'GoSend / GrabExpress', desc:'Affordable same-day delivery', basePrice:10000, pricePerKm:2500, eta:'Pickup in 5 min', platforms:['gojek','grab'] },
      { id:'premium',  icon:'🚀', name:'Express Send', desc:'Priority delivery, real-time tracking', basePrice:20000, pricePerKm:4000, eta:'Pickup in 2 min', platforms:['gojek'] },
    ],
    food: [
      { id:'standard', icon:'🍱', name:'GoFood / GrabFood', desc:'Order from nearby restaurants', basePrice:8000, pricePerKm:2000, eta:'20–35 min', platforms:['gojek','grab'] },
    ],
  },
  car: {
    ride: [
      { id:'standard', icon:'🚗', name:'Car Standard', desc:'Comfortable everyday car', basePrice:25000, pricePerKm:4000, eta:'4–7 min', platforms:['gojek','grab'] },
      { id:'premium',  icon:'🚘', name:'Car Premium',  desc:'SUV / newer model cars', basePrice:55000, pricePerKm:7000, eta:'3–5 min', platforms:['grab'] },
      { id:'priority', icon:'💎', name:'Car Priority', desc:'Black car, executive class', basePrice:100000, pricePerKm:12000, eta:'2–4 min', platforms:['gojek'] },
    ],
    delivery: [
      { id:'standard', icon:'📦', name:'Car Delivery', desc:'Large items, multi-stop', basePrice:40000, pricePerKm:6000, eta:'Pickup in 7 min', platforms:['gojek','grab'] },
    ],
    food: [
      { id:'standard', icon:'🍔', name:'Car Food', desc:'Large food orders via car', basePrice:30000, pricePerKm:5000, eta:'25–45 min', platforms:['grab'] },
    ],
  },
};

// Mock driver pool by vehicle type
const MOCK_DRIVERS = {
  motorcycle: [
    { name:'Ahmad Fauzi',    plate:'B 4521 XYZ', vehicle:'Honda Vario 125',  rating:4.92, platform:'gojek', pColor:'var(--gojek)', eta:4 },
    { name:'Budi Santoso',   plate:'B 8823 ABC', vehicle:'Yamaha NMAX 155',  rating:4.88, platform:'grab',  pColor:'var(--grab)',  eta:6 },
    { name:'Hendra Wijaya',  plate:'B 2291 PQR', vehicle:'Honda Beat',       rating:4.85, platform:'gojek', pColor:'var(--gojek)', eta:5 },
    { name:'Rizky Aditya',   plate:'B 7732 STU', vehicle:'Yamaha Aerox',     rating:4.90, platform:'grab',  pColor:'var(--grab)',  eta:3 },
    { name:'Andi Kusuma',    plate:'B 5519 VWX', vehicle:'Honda Scoopy',     rating:4.78, platform:'gojek', pColor:'var(--gojek)', eta:7 },
  ],
  car: [
    { name:'Reza Pratama',   plate:'B 1234 DEF', vehicle:'Toyota Avanza',           rating:4.95, platform:'gojek', pColor:'var(--gojek)', eta:5 },
    { name:'Diana Putri',    plate:'B 5678 GHI', vehicle:'Honda Freed',             rating:4.97, platform:'grab',  pColor:'var(--grab)',  eta:7 },
    { name:'Siti Rahma',     plate:'B 9001 JKL', vehicle:'Mitsubishi Xpander',      rating:4.91, platform:'grab',  pColor:'var(--grab)',  eta:6 },
    { name:'Bagas Nugroho',  plate:'B 3344 MNO', vehicle:'Toyota Innova Reborn',    rating:4.96, platform:'gojek', pColor:'var(--gojek)', eta:4 },
    { name:'Melissa Angkat', plate:'B 6610 YZA', vehicle:'Suzuki Ertiga',           rating:4.89, platform:'grab',  pColor:'var(--grab)',  eta:8 },
  ],
};

// Demo order ID for chat sync between customer and driver dashboards
const DEMO_ORDER_ID = 'ORD-DEMO';

// ============================================================
// SECTION 6: PAGE STATE
// (initialized in AppController.init() based on page type)
// ============================================================
let state;

// ============================================================
// SECTION 7: WEBSOCKET MOCK (driver only)
// ============================================================
const RideFlowWS = {
  _handlers: {},
  _connected: false,

  connect(url) {
    // Production: this.ws = new WebSocket(url);
    this._connected = true;
    console.log('[WS] Mock connection established to', url || 'ws://localhost:8080');
    this._emit('connected', { timestamp: new Date().toISOString() });
    return this;
  },

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
    return this;
  },

  send(type, payload) {
    if (!this._connected) return;
    console.log('[WS] Send →', type, payload);
    // Production: this.ws.send(JSON.stringify({ type, payload }));
  },

  _emit(event, data) {
    (this._handlers[event] || []).forEach(fn => fn(data));
  },

  // Simulate receiving a new order after a delay
  simulateIncomingOrder(order, delayMs = 8000) {
    setTimeout(() => {
      this._emit('new_order', order);
    }, delayMs);
  },

  // Simulate a customer message after a delay
  simulateCustomerMessage(text, delayMs = 3000) {
    setTimeout(() => {
      this._emit('customer_message', { text, time: getCurrentTime() });
    }, delayMs);
  },
};

// ============================================================
// SECTION 8: SHARED UTILITY FUNCTIONS
// (used by both customer and driver pages)
// ============================================================
let toastTimer = null;

function showToast(msg, dur = 3000) {
  const toast    = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), dur);
}

function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function showEl(id)     { document.getElementById(id).style.display = ''; }
function hideEl(id)     { document.getElementById(id).style.display = 'none'; }

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Alias used by driver dashboard functions
function escapeHtml(text) { return escHtml(text); }

// Shared sign-out used by all pages
function doSignOut() {
  try { closeModal('userMenuModal'); } catch (_) {}
  window._currentUser = null;
  Auth.logout();
}

// ============================================================
// SECTION 9: DRIVER UTILITY FUNCTIONS
// ============================================================
function getCurrentTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

function formatCurrency(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

function getInitials(name) {
  return name.split(' ').filter(w => w.length > 0).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatOnlineTime(startTime) {
  const mins = Math.floor((Date.now() - startTime) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + 'h ' + m + 'm';
}

/**
 * Map an order's service type/name to one of the earnings breakdown keys.
 * @param {Object} order
 * @returns {'ride'|'package'|'food'}
 */
function _getServiceKey(order) {
  const explicit = { ride: 'ride', food: 'food', delivery: 'package', package: 'package' };
  if (order.serviceType && explicit[order.serviceType]) {
    return explicit[order.serviceType];
  }
  if (order.serviceName) {
    const lower = order.serviceName.toLowerCase();
    if (lower.includes('food')) return 'food';
    if (lower.includes('delivery') || lower.includes('send') || lower.includes('paket')) return 'package';
  }
  return 'ride';
}

// ============================================================
// SECTION 10: CUSTOMER FUNCTIONS
// ============================================================
let priceTimer = null;

function onUserLoggedIn(user) {
  hideEl('loadingScreen');
  hideEl('authGate');
  showAppShell();
  updateHeaderUser(user);
  loadLocalData();
  if (!user.isGuest) {
    addBotMessage(`Welcome back, **${user.name}**! 👋 Where are you headed today?`);
  } else {
    initGuestChat();
  }
  _initChatSyncBridge(user.name || 'customer');
}

function loadLocalData() {
  state.orders   = Storage.getOrders();
  state.savedLocs = Storage.getSavedLocations();
  renderHistory();
  renderSavedLocs();
  renderSavedPicks();
}

function updateHeaderUser(user) {
  hideEl('headerAuthBtns');
  showEl('headerUser');
  document.getElementById('headerAvatar').textContent = (user.name || 'U').charAt(0).toUpperCase();
  document.getElementById('headerName').textContent   = user.name;
}

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const errEl = document.getElementById('loginError');
  if (!email) { showFormError(errEl, 'Please enter your email'); return; }
  const result = Auth.validateEmail(email);
  if (!result.valid) { showFormError(errEl, result.error); return; }
  if (result.type !== 'customer') { showFormError(errEl, 'Please use a @customer.mail email address'); return; }
  const user = Auth.login(email);
  window._currentUser = user;
  onUserLoggedIn(user);
}

function doGuestMode() {
  const user = Auth.loginAsGuest('customer');
  window._currentUser = user;
  onUserLoggedIn(user);
}

function showAuthGate() {
  showEl('authGate');
}

function showFormError(el, msg) { el.textContent = msg; el.classList.add('show'); }

function showUserMenu() {
  const user = window._currentUser;
  if (!user) return;
  document.getElementById('menuAvatar').textContent = (user.name||'U').charAt(0).toUpperCase();
  document.getElementById('menuName').textContent   = user.name;
  document.getElementById('menuEmail').textContent  = user.email || '';
  document.getElementById('menuGuest').textContent  = user.isGuest ? '🔒 Guest Mode — data not saved' : '';
  const done = state.orders.filter(o => o.status==='completed').length;
  document.getElementById('menuStats').innerHTML = `
    <div class="det-row"><span class="det-label">Total Rides</span><span class="det-val">${state.orders.length}</span></div>
    <div class="det-row"><span class="det-label">Completed</span><span class="det-val" style="color:var(--accent)">${done}</span></div>
    <div class="det-row"><span class="det-label">Saved Locations</span><span class="det-val">${state.savedLocs.length}</span></div>
  `;
  openModal('userMenuModal');
}

function showAppShell() {
  const shell = document.getElementById('appShell');
  shell.style.display = 'block';
  shell.classList.add('visible');
}

// ─── Booking — Tier rendering & vehicle/service selection ───────────────────

function renderTiers() {
  const list = document.getElementById('tierList');
  const available = (TIERS[state.vehicle] && TIERS[state.vehicle][state.service]) || TIERS[state.vehicle]['ride'];
  if (!available.find(t => t.id === state.tier)) state.tier = available[0].id;

  list.innerHTML = available.map(t => `
    <div class="tier-card ${state.tier === t.id ? 'active' : ''}" onclick="selectTierById('${t.id}')">
      <div class="tier-icon">${t.icon}</div>
      <div class="tier-info">
        <div class="tier-name">${t.name}</div>
        <div class="tier-desc">${t.desc}</div>
        <div class="platform-row">
          ${t.platforms.map(p=>`<span class="pbadge ${p}">${p.charAt(0).toUpperCase()+p.slice(1)}</span>`).join('')}
        </div>
      </div>
      <div class="tier-right">
        <div class="tier-price">${formatPrice(t)}</div>
        <div class="tier-eta">${t.eta}</div>
      </div>
    </div>
  `).join('');
}

function formatPrice(tier) {
  if (state.estimatedKm) {
    const est = tier.basePrice + tier.pricePerKm * state.estimatedKm;
    return `Rp ${(Math.round(est/1000)*1000).toLocaleString('id-ID')}`;
  }
  const lo = tier.basePrice;
  const hi = tier.basePrice + tier.pricePerKm * 8;
  return `Rp ${(lo/1000).toFixed(0)}.000–${(hi/1000).toFixed(0)}.000`;
}

function selectVehicle(v) {
  state.vehicle = v;
  document.getElementById('motoBtn').classList.toggle('active', v === 'motorcycle');
  document.getElementById('carBtn').classList.toggle('active', v === 'car');
  document.querySelector('#svc-ride .svc-icon').textContent = v === 'motorcycle' ? '🛵' : '🚗';
  renderTiers();
  updatePriceEstimate();
}

function selectService(s) {
  state.service = s;
  document.querySelectorAll('.svc-card').forEach(el => el.classList.remove('active'));
  document.getElementById('svc-' + s).classList.add('active');
  renderTiers();
  updatePriceEstimate();
}

function selectTierById(id) {
  state.tier = id;
  renderTiers();
  updatePriceEstimate();
}

function swapLocations() {
  const p = document.getElementById('pickupInput');
  const d = document.getElementById('destInput');
  [p.value, d.value] = [d.value, p.value];
  state.pickup = p.value; state.destination = d.value;
  updatePriceEstimate();
  showToast('📍 Locations swapped!');
}

function getTierData() {
  const list = (TIERS[state.vehicle] && TIERS[state.vehicle][state.service]) || TIERS[state.vehicle]['ride'];
  return list.find(t => t.id === state.tier) || list[0];
}

// ─── Price Estimator ─────────────────────────────────────────

function updatePriceEstimate() {
  const p = document.getElementById('pickupInput').value.trim();
  const d = document.getElementById('destInput').value.trim();

  if (!p || !d) {
    state.estimatedKm = null;
    document.getElementById('priceValue').textContent = '—';
    document.getElementById('priceSub').textContent   = 'Enter locations first';
    renderTiers();
    return;
  }

  document.getElementById('priceValue').innerHTML = '<span class="spin">⟳</span>';
  document.getElementById('priceSub').textContent = 'Calculating...';

  clearTimeout(priceTimer);
  priceTimer = setTimeout(() => {
    const hash = (p + d).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const km   = 1.5 + (hash % 200) / 10;
    state.estimatedKm = km;

    const tier = getTierData();
    const price = tier.basePrice + tier.pricePerKm * km;
    const rounded = Math.round(price / 1000) * 1000;

    document.getElementById('priceValue').textContent = `Rp ${rounded.toLocaleString('id-ID')}`;
    document.getElementById('priceSub').textContent   = `~${km.toFixed(1)} km · ${tier.name}`;
    renderTiers();
  }, 900);
}

// ─── Saved Locations ─────────────────────────────────────────

function renderSavedLocs() {
  const list = document.getElementById('savedLocList');
  if (state.savedLocs.length === 0) {
    list.innerHTML = `<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px 0;">No saved locations yet</div>`;
    return;
  }
  list.innerHTML = state.savedLocs.map(loc => `
    <div class="saved-loc-item">
      <div class="saved-loc-icon">${loc.icon || '📌'}</div>
      <div class="saved-loc-info">
        <div class="saved-loc-name">${loc.label}</div>
        <div class="saved-loc-addr">${loc.address}</div>
      </div>
      <div class="saved-loc-actions">
        <button class="icon-btn" onclick="useSavedLoc(${JSON.stringify(loc.address)})" title="Use as pickup">↑</button>
        <button class="icon-btn delete" onclick="removeSavedLoc(${JSON.stringify(loc.id)})" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function renderSavedPicks() {
  const picks = document.getElementById('savedPicks');
  if (state.savedLocs.length === 0) { picks.innerHTML = ''; return; }
  picks.innerHTML = state.savedLocs.slice(0, 4).map(loc => `
    <button class="saved-pick-btn" onclick="useSavedAsDestination(${JSON.stringify(loc.address)})" title="Set as destination">
      ${loc.icon || '📌'} ${loc.label}
    </button>
  `).join('');
}

function useSavedLoc(addr) {
  document.getElementById('pickupInput').value = addr;
  state.pickup = addr;
  updatePriceEstimate();
  showToast(`📍 Pickup set to: ${addr}`);
}

function useSavedAsDestination(addr) {
  document.getElementById('destInput').value = addr;
  state.destination = addr;
  updatePriceEstimate();
  showToast(`🎯 Destination set to: ${addr}`);
}

function removeSavedLoc(id) {
  state.savedLocs = state.savedLocs.filter(l => l.id !== id);
  Storage.setSavedLocations(state.savedLocs);
  renderSavedLocs(); renderSavedPicks();
  showToast('🗑 Location removed');
}

function openAddSavedModal() {
  state.savedLocType = '🏠';
  document.getElementById('savedLocLabel').value = '';
  document.getElementById('savedLocAddr').value  = '';
  document.querySelectorAll('.loc-type-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  openModal('addSavedModal');
}

function selectLocType(btn, icon) {
  state.savedLocType = icon;
  document.querySelectorAll('.loc-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveSavedLocation() {
  const label   = document.getElementById('savedLocLabel').value.trim();
  const address = document.getElementById('savedLocAddr').value.trim();
  if (!label || !address) { showToast('⚠️ Please fill in label & address'); return; }

  const newLoc = { id: 'loc-' + Date.now(), icon: state.savedLocType, label, address };
  state.savedLocs.push(newLoc);
  Storage.setSavedLocations(state.savedLocs);
  renderSavedLocs(); renderSavedPicks();
  closeModal('addSavedModal');
  showToast('✅ Location saved!');
}

// ─── Order Flow ───────────────────────────────────────────────

function openConfirmModal() {
  const pickup = document.getElementById('pickupInput').value.trim();
  const dest   = document.getElementById('destInput').value.trim();
  if (!pickup || !dest) { showToast('⚠️ Please enter pickup & destination'); return; }
  state.pickup = pickup; state.destination = dest;

  const tier  = getTierData();
  const price = document.getElementById('priceValue').textContent;
  const km    = state.estimatedKm ? state.estimatedKm.toFixed(1) + ' km' : '—';

  document.getElementById('confirmDetails').innerHTML = `
    <div class="det-row"><span class="det-label">📍 Pickup</span><span class="det-val">${state.pickup}</span></div>
    <div class="det-row"><span class="det-label">🎯 Destination</span><span class="det-val">${state.destination}</span></div>
    <div class="det-row"><span class="det-label">🚗 Vehicle</span><span class="det-val">${state.vehicle === 'motorcycle' ? '🏍 Motorcycle' : '🚗 Car'}</span></div>
    <div class="det-row"><span class="det-label">🎫 Tier</span><span class="det-val">${tier.name}</span></div>
    <div class="det-row"><span class="det-label">📏 Distance</span><span class="det-val">${km}</span></div>
    <div class="det-row"><span class="det-label">💰 Est. Fare</span><span class="det-val" style="color:var(--accent);font-weight:700;">${price}</span></div>
  `;
  openModal('confirmModal');
}

function proceedBook() {
  closeModal('confirmModal');
  showToast('🔍 Searching across Gojek & Grab...');

  const orderData = {
    id:            'local-' + Date.now(),
    pickup:        state.pickup,
    destination:   state.destination,
    vehicle:       state.vehicle,
    service:       state.service,
    tier:          state.tier,
    estimatedKm:   state.estimatedKm,
    estimatedFare: document.getElementById('priceValue').textContent,
    status:        'searching',
    createdAt:     new Date().toISOString(),
  };

  addLocalOrder(orderData);
  state.currentOrderId = orderData.id;

  setTimeout(() => {
    const driverPool = MOCK_DRIVERS[state.vehicle] || MOCK_DRIVERS.motorcycle;
    const driver = driverPool[Math.floor(Math.random() * driverPool.length)];
    state.currentDriver = driver;
    updateLocalOrder(orderData.id, 'driver_found', { driverName: driver.name });
    showDriverModal(driver);
    addBotMessage(`✅ Driver found! **${driver.name}** (${driver.vehicle}) is **${driver.eta} min** away via ${driver.platform.charAt(0).toUpperCase()+driver.platform.slice(1)}.`);
  }, 2200);
}

function showDriverModal(driver) {
  document.getElementById('driverName').textContent = driver.name;
  document.getElementById('driverPlate').textContent = `${driver.plate} · ${driver.vehicle}`;
  document.getElementById('driverRating').textContent = `⭐ ${driver.rating} · via `;
  const pSpan = document.createElement('span');
  pSpan.textContent = driver.platform.charAt(0).toUpperCase() + driver.platform.slice(1);
  pSpan.style.color = driver.pColor;
  document.getElementById('driverRating').appendChild(pSpan);
  document.getElementById('etaNum').textContent = driver.eta;

  document.getElementById('driverDetails').innerHTML = `
    <div class="det-row"><span class="det-label">📍 From</span><span class="det-val">${state.pickup}</span></div>
    <div class="det-row"><span class="det-label">🎯 To</span><span class="det-val">${state.destination}</span></div>
    <div class="det-row"><span class="det-label">💰 Fare</span><span class="det-val" style="color:var(--accent)">${document.getElementById('priceValue').textContent}</span></div>
  `;

  document.getElementById('progFill').style.width = '0%';
  ['ps1','ps2','ps3'].forEach((id,i) => {
    document.getElementById(id).className = 'p-step' + (i===0?' done':'');
    document.getElementById(id).textContent = ['✓ Confirmed','En Route','Arrived'][i];
  });

  openModal('driverModal');

  setTimeout(() => {
    document.getElementById('progFill').style.width = '50%';
    document.getElementById('ps2').classList.add('done');
    document.getElementById('ps2').textContent = '✓ En Route';
    updateLocalOrder(state.currentOrderId, 'en_route');
  }, 1600);
}

function completeRide() {
  document.getElementById('progFill').style.width = '100%';
  document.getElementById('ps3').classList.add('done');
  document.getElementById('ps3').textContent = '✓ Arrived';
  updateLocalOrder(state.currentOrderId, 'completed');
  closeModal('driverModal');
  openRatingModal();
}

function cancelRide() {
  updateLocalOrder(state.currentOrderId, 'cancelled');
  closeModal('driverModal');
  addBotMessage("Your ride has been cancelled. Need another ride? Just let me know! 🛵");
  showToast('❌ Ride cancelled');
  state.currentOrderId = null; state.currentDriver = null;
}

// ─── Driver Rating ────────────────────────────────────────────

function openRatingModal() {
  state.userRating = 0;
  document.getElementById('ratingDriverName').textContent = `How was your ride with ${state.currentDriver?.name}?`;
  document.getElementById('reviewText').value = '';
  document.querySelectorAll('.star-btn').forEach(b => b.classList.remove('lit'));
  openModal('ratingModal');
}

function setRating(n) {
  state.userRating = n;
  document.querySelectorAll('.star-btn').forEach((b,i) => b.classList.toggle('lit', i < n));
}

function submitRating() {
  if (state.userRating === 0) { showToast('⭐ Please select a rating'); return; }
  const review = document.getElementById('reviewText').value.trim();
  const ratingData = { rating: state.userRating, review };
  updateLocalOrder(state.currentOrderId, 'completed', ratingData);
  closeModal('ratingModal');
  addBotMessage(`Thanks for rating **${state.currentDriver?.name}** ${state.userRating}⭐! Safe travels! 🛵`);
  showToast('✅ Review submitted!');
  state.currentOrderId = null; state.currentDriver = null;
}

// ─── Local Order Cache ────────────────────────────────────────

function addLocalOrder(orderData) {
  const newOrder = { ...orderData };
  state.orders = [newOrder, ...state.orders.filter(o => o.id !== newOrder.id)];
  Storage.setOrders(state.orders);
  renderHistory();
}

function updateLocalOrder(orderId, status, extra = {}) {
  state.orders = state.orders.map(o =>
    o.id === orderId ? { ...o, status, ...extra } : o
  );
  Storage.setOrders(state.orders);
  renderHistory();
}

// ─── Order History ────────────────────────────────────────────

function renderHistory() {
  const list   = document.getElementById('historyList');
  const empty  = document.getElementById('historyEmpty');
  const orders = state.orders;

  if (orders.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = orders.map(o => {
    const date = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString('en-US', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
      : 'Just now';
    const vehicleTiers = TIERS[o.vehicle] || {};
    const tier = (vehicleTiers[o.service] || []).find(t => t.id === o.tier);
    const statusLabel = {
      completed:    'Completed',
      searching:    'Searching',
      driver_found: 'Driver Found',
      en_route:     'En Route',
      cancelled:    'Cancelled',
    }[o.status] || o.status;
    const statusClass = { completed:'completed', cancelled:'cancelled' }[o.status] || 'searching';

    return `
      <div class="hist-card">
        <div class="hist-top">
          <div class="hist-route">${o.pickup || '—'} <span>→</span> ${o.destination || '—'}</div>
          <span class="hist-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="hist-bottom">
          <div>
            <div class="hist-detail">${tier?.name || o.tier || '—'} · ${o.vehicle || '—'}</div>
            ${o.rating ? `<div style="font-size:11px;color:var(--accent3);margin-top:2px;">⭐ ${o.rating}/5 ${o.review ? '· "'+o.review+'"' : ''}</div>` : ''}
            <div class="hist-date" style="margin-top:3px;">${date}</div>
          </div>
          <div style="text-align:right;">
            <div class="hist-price">${o.estimatedFare || '—'}</div>
            ${o.estimatedKm ? `<div style="font-size:10px;color:var(--muted);">~${parseFloat(o.estimatedKm).toFixed(1)} km</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Chat — AI assistant + driver message sync ───────────────

function initGuestChat() {
  addBotMessage("Hey! 👋 I'm your RideFlow assistant. Tell me where you want to go and I'll set up your booking instantly!", [
    { label: '🏙 Sudirman → Grand Indonesia', text: 'Ride from Sudirman to Grand Indonesia' },
    { label: '📦 Send Package', text: 'Send a package from Kemang to Senayan' },
    { label: '🚗 Car from SCBD', text: 'Car ride from SCBD to Kuningan' },
  ]);
}

function addBotMessage(text, chips) {
  const msgs = document.getElementById('chatMessages');
  const now  = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const chipsHtml = chips
    ? `<div class="quick-suggestions">${chips.map(c=>`<div class="sug-chip" onclick="sendSuggestion('${c.text}')">${c.label}</div>`).join('')}</div>`
    : '';
  msgs.innerHTML += `
    <div class="msg bot">
      <div class="msg-avatar bot">R</div>
      <div>
        <div class="msg-bubble">${html}</div>
        <div class="msg-time">${now}</div>
        ${chipsHtml}
      </div>
    </div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const now  = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  msgs.innerHTML += `
    <div class="msg user">
      <div class="msg-avatar user">${(window._currentUser?.name||'U').charAt(0).toUpperCase()}</div>
      <div>
        <div class="msg-bubble">${escHtml(text)}</div>
        <div class="msg-time" style="text-align:right;">${now}</div>
      </div>
    </div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

// ─── NLP Intent Parser ────────────────────────────────────────

function parseIntent(raw) {
  const t = raw.toLowerCase();
  if (/^(hi|hello|hey)\b/.test(t)) return { type:'greet' };
  if (/(thank|thanks)/.test(t)) return { type:'thanks' };
  if (/(history|past ride)/.test(t)) return { type:'history' };
  if (/(save.*(location)|save.*spot)/.test(t)) return { type:'save_loc' };

  let vehicle = null, service = 'ride', tier = null, pickup = null, destination = null;

  if (/\b(car)\b/.test(t)) vehicle = 'car';
  else if (/\b(motorcycle|motor|bike)\b/.test(t)) vehicle = 'motorcycle';

  if (/(deliver|package|send)\b/.test(t)) service = 'delivery';
  else if (/\bfood\b/.test(t)) service = 'food';

  if (/\b(premium)\b/.test(t)) tier = 'premium';
  else if (/\b(priority|vip)\b/.test(t)) tier = 'priority';
  else if (/\b(standard)\b/.test(t)) tier = 'standard';

  const fromTo = t.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromTo) { pickup = cap(fromTo[1].trim()); destination = cap(fromTo[2].trim()); }

  return { type:'booking', vehicle, service, tier, pickup, destination };
}

function handleIntent(intent) {
  const greets = [
    "Hey! Tell me where you want to go and I'll set it up instantly. 🚀",
    "Hi there! Say something like \"Ride from Sudirman to Blok M\" and I'll handle the rest.",
  ];
  const thanks = [
    "Happy to help! Safe travels! 🛵",
    "Anytime! Let me know if you need another ride. ✌️",
  ];
  const done = [
    "Done! Check the booking panel — you're all set. 👆",
    "Updated! Hit **Find My Driver** when ready. 🚀",
    "Got it! The form is filled in for you. ✅",
  ];

  if (intent.type === 'greet') return pick(greets);
  if (intent.type === 'thanks') return pick(thanks);
  if (intent.type === 'history') { switchChatTab('history'); return "Here's your ride history! 📋"; }
  if (intent.type === 'save_loc') { openAddSavedModal(); return "Let's save a location for you! 📌"; }

  let changes = 0;
  if (intent.vehicle)      { selectVehicle(intent.vehicle); changes++; }
  if (intent.service)      { selectService(intent.service); changes++; }
  if (intent.tier)         { state.tier = intent.tier; renderTiers(); changes++; }
  if (intent.pickup)       {
    document.getElementById('pickupInput').value = intent.pickup;
    state.pickup = intent.pickup; changes++;
  }
  if (intent.destination)  {
    document.getElementById('destInput').value = intent.destination;
    state.destination = intent.destination; changes++;
  }
  if (changes > 0) { updatePriceEstimate(); return pick(done); }
  return "Not sure what you need. Try: **\"Car ride from Kemang to SCBD\"** or **\"Send package from Sudirman to Depok\"** 📦";
}

function sendSuggestion(text) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.value = typeof text === 'string' ? text.slice(0, 500) : '';
  sendMessage();
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  addUserMessage(text);
  input.value = ''; input.style.height = 'auto';

  const typing = document.getElementById('typingIndicator');
  typing.classList.add('show');

  // Also send to driver via shared storage
  ChatSyncBridge.sendTextMessage(text);

  setTimeout(() => {
    typing.classList.remove('show');
    const intent   = parseIntent(text);
    const response = handleIntent(intent);
    addBotMessage(response);
  }, 700 + Math.random() * 500);
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// ─── Delete Chat History (customer side) ─────────────────────

function deleteChatHistory() {
  if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
  ChatSyncBridge.deleteChatHistory(DEMO_ORDER_ID);
  document.getElementById('chatMessages').innerHTML = '';
  addBotMessage('Chat history cleared. 🗑️');
  showToast('🗑️ Chat history deleted');
}

// ─── Chat Sync Bridge — receive driver messages ───────────────

function _initChatSyncBridge(userId) {
  ChatSyncBridge.init(DEMO_ORDER_ID, userId, function onDriverMessage(msg) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;

    const senderLabel = msg.senderName ? msg.senderName + ' (Driver)' : 'Driver';

    if (msg.type === 'image') {
      const safeName = escHtml(msg.fileName || 'image');
      const safeSrc  = (typeof msg.imageUrl === 'string' && /^data:image\//.test(msg.imageUrl)) ? msg.imageUrl : '';
      msgs.innerHTML += `
        <div class="msg bot">
          <div class="msg-avatar bot">D</div>
          <div>
            <div class="msg-bubble" style="padding:6px;">
              <img src="${safeSrc}" alt="${safeName}"
                   style="max-width:200px;border-radius:8px;display:block;cursor:zoom-in;"
                   onclick="if(this.requestFullscreen){this.requestFullscreen().catch(function(){});}">
              <div style="font-size:10px;color:var(--muted);margin-top:3px;">${safeName}</div>
            </div>
            <div class="msg-time">${time} · ${senderLabel}</div>
          </div>
        </div>`;
    } else {
      msgs.innerHTML += `
        <div class="msg bot">
          <div class="msg-avatar bot">D</div>
          <div>
            <div class="msg-bubble">${escHtml(msg.content)}</div>
            <div class="msg-time">${time} · ${senderLabel}</div>
          </div>
        </div>`;
    }
    msgs.scrollTop = msgs.scrollHeight;
  }, function onChatCleared() {
    document.getElementById('chatMessages').innerHTML = '';
    addBotMessage('Chat history was cleared. 🗑️');
  });
}

// ─── UI Tabs ─────────────────────────────────────────────────

function switchChatTab(tab) {
  document.querySelectorAll('.chat-tab').forEach((el,i) => {
    el.classList.toggle('active', (tab==='chat'&&i===0)||(tab==='history'&&i===1));
  });
  document.getElementById('chatView').classList.toggle('active',    tab === 'chat');
  document.getElementById('historyView').classList.toggle('active', tab === 'history');
  if (tab === 'history') renderHistory();
}

// ─── Customer helpers ─────────────────────────────────────────
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(str)   { return str.split(' ').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' '); }

// ============================================================
// SECTION 11: DRIVER FUNCTIONS
// ============================================================

// ─── Driver Status Toggle ─────────────────────────────────────

function toggleDriverStatus() {
  state.isOnline = !state.isOnline;
  const track = document.getElementById('toggleTrack');
  const label = document.getElementById('statusLabel');
  const mapStatusText = document.getElementById('mapStatusText');

  if (state.isOnline) {
    track.classList.add('on');
    label.textContent = 'Online';
    label.className = 'status-label online';
    mapStatusText.textContent = 'Searching for orders…';
    state.onlineStartTime = Date.now();
    showToast('✅ You are now Online');
    RideFlowWS.send('driver_status', { status: 'online', driverId: DRIVER_INFO.id });
  } else {
    track.classList.remove('on');
    label.textContent = 'Offline';
    label.className = 'status-label';
    mapStatusText.textContent = 'Driver offline';
    showToast('🔴 You are now Offline');
    RideFlowWS.send('driver_status', { status: 'offline', driverId: DRIVER_INFO.id });
  }
}

// ─── Orders Rendering ────────────────────────────────────────

function renderOrders() {
  const list = document.getElementById('ordersList');
  const badge = document.getElementById('orderCountBadge');
  const incoming = state.orders.filter(o => o.status === 'incoming');

  badge.textContent = incoming.length > 0 ? incoming.length + ' New' : 'None';
  badge.style.background = incoming.length > 0 ? 'var(--accent2-dim)' : 'rgba(255,255,255,0.05)';
  badge.style.color = incoming.length > 0 ? 'var(--accent2)' : 'var(--muted)';

  list.innerHTML = '';

  if (state.orders.length === 0) {
    list.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty-icon">🛵</div>
        <p>No orders yet.<br>Stay online to receive orders.</p>
      </div>`;
    return;
  }

  state.orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card '
      + (order.status === 'incoming' ? 'incoming' : order.status === 'active' ? 'active-order' : 'completed-order');
    card.id = 'order-' + order.id;

    let actionsHtml = '';
    if (order.status === 'incoming') {
      actionsHtml = `
        <div class="order-actions">
          <button class="btn-decline" onclick="declineOrder('${order.id}')">✕ Decline</button>
          <button class="btn-accept" onclick="acceptOrder('${order.id}')">✓ Accept</button>
        </div>`;
    } else if (order.status === 'active') {
      actionsHtml = `<span class="order-status-label en-route">🔵 En Route</span>`;
    } else {
      actionsHtml = `<span class="order-status-label done">✓ Done</span>`;
    }

    card.innerHTML = `
      <div class="order-header">
        <span class="order-type-badge ${order.type}">${order.typeLabel} · ${order.serviceTier}</span>
        <span class="order-time">${order.time}</span>
      </div>
      <div class="order-customer">
        <div class="cust-avatar">${order.customer.initials}</div>
        <div class="cust-info">
          <div class="cust-name">${order.customer.name}</div>
          <div class="cust-meta">
            <span class="cust-rating">★ ${order.customer.rating}</span>
            <span>${order.customer.phone}</span>
          </div>
        </div>
      </div>
      <div class="order-route">
        <div class="route-row">
          <div class="route-dot pickup"></div>
          <span class="route-addr">${order.pickup}</span>
        </div>
        <div class="route-connector"></div>
        <div class="route-row">
          <div class="route-dot dest"></div>
          <span class="route-addr">${order.destination}</span>
        </div>
      </div>
      <div class="order-footer">
        <div>
          <div class="order-fare">${order.fare}</div>
          <div class="order-fare-label">${order.distance}</div>
        </div>
        ${actionsHtml}
      </div>`;

    list.appendChild(card);
  });
}

// ─── Accept / Decline Order ──────────────────────────────────

function acceptOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  // Decline any other incoming orders
  state.orders.forEach(o => {
    if (o.id !== orderId && o.status === 'incoming') o.status = 'declined';
  });
  state.orders = state.orders.filter(o => o.status !== 'declined');

  order.status = 'active';
  state.activeOrderId = orderId;
  state.orderStep = 'pickup';

  renderOrders();
  activateOrderMessaging(order);
  showActiveOrderInfo(order);
  updateMapStatus('En route to pickup…');

  showToast('✅ Order accepted! Navigate to pickup.');

  RideFlowWS.send('order_accepted', { orderId, driverId: DRIVER_INFO.id });

  // Initialize bi-directional chat sync
  ChatSync.init(CHAT_CHANNEL, (msg) => {
    // Only display messages from the customer side
    if (msg.sender === 'driver') return;
    if (!state.activeOrderId) return;
    appendSyncedMessage(msg);
    const count = ChatSync.getUnreadCount(CHAT_CHANNEL);
    updateUnreadBadge(count);
    showToast('💬 Customer: ' + (msg.type === 'image' ? '📷 Photo' : msg.content.slice(0, 40)), 3000);
  });

  // Simulate customer message after accepting
  RideFlowWS.simulateCustomerMessage('Thank you for accepting my order! 🙏', 4000);
}

function declineOrder(orderId) {
  state.orders = state.orders.filter(o => o.id !== orderId);
  renderOrders();
  showToast('Order declined');
  RideFlowWS.send('order_declined', { orderId, driverId: DRIVER_INFO.id });
}

// ─── Active Order UI ─────────────────────────────────────────

function showActiveOrderInfo(order) {
  document.getElementById('noActiveOrderMsg').style.display = 'none';
  document.getElementById('activeOrderInfo').style.display = 'block';
  document.getElementById('actionSection').style.display = 'flex';

  document.getElementById('activeCustomerAvatar').textContent = order.customer.initials;
  document.getElementById('activeCustomerName').textContent   = order.customer.name;
  document.getElementById('activeCustomerRating').textContent = '★ ' + order.customer.rating;
  document.getElementById('activeCustomerPhone').textContent  = order.customer.phone;
  document.getElementById('activePickup').textContent         = order.pickup;
  document.getElementById('activeDest').textContent           = order.destination;
  document.getElementById('activeServiceIcon').textContent    = order.serviceIcon;
  document.getElementById('activeServiceName').textContent    = order.serviceName;
  document.getElementById('activeServiceTier').textContent    = order.serviceTier;
  document.getElementById('activeServicePrice').textContent   = order.fare;

  updatePrimaryAction();
}

function clearActiveOrderInfo() {
  document.getElementById('noActiveOrderMsg').style.display = 'block';
  document.getElementById('activeOrderInfo').style.display  = 'none';
  document.getElementById('actionSection').style.display    = 'none';
}

function updatePrimaryAction() {
  const icon = document.getElementById('primaryActionIcon');
  const text = document.getElementById('primaryActionText');

  if (state.orderStep === 'pickup') {
    icon.textContent = '🗺️';
    text.textContent = 'Navigate to Pickup';
  } else {
    icon.textContent = '🏁';
    text.textContent = 'Navigate to Destination';
  }
}

function handlePrimaryAction() {
  if (state.orderStep === 'pickup') {
    state.orderStep = 'dropoff';
    updateMapStatus('Customer picked up · Heading to destination…');
    updatePrimaryAction();

    const order = state.orders.find(o => o.id === state.activeOrderId);
    if (order) {
      const card = document.getElementById('order-' + order.id);
      if (card) {
        const statusEl = card.querySelector('.order-status-label');
        if (statusEl) { statusEl.textContent = '🟢 Picked Up'; statusEl.className = 'order-status-label picked-up'; }
      }
    }
    showToast('📍 Customer picked up! Navigate to destination.');
    appendSystemMessage('Customer picked up · Heading to destination');
  } else {
    completeTrip();
  }
}

function completeTrip() {
  const order = state.orders.find(o => o.id === state.activeOrderId);
  if (!order) return;

  order.status = 'completed';
  state.activeOrderId = null;
  state.orderStep = 'pickup';
  state.earnings.trips += 1;
  state.earnings.gross += order.fareRaw;

  // Track earnings by service type
  const serviceKey = _getServiceKey(order);
  if (state.earnings.byService[serviceKey] !== undefined) {
    state.earnings.byService[serviceKey] += order.fareRaw;
  }

  updateEarnings();
  updateMapStatus('Trip completed · Searching for orders…');
  clearActiveOrderInfo();
  renderOrders();

  // Hide chat area after short delay
  setTimeout(() => {
    document.getElementById('noConvPlaceholder').style.display = 'flex';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('quickRepliesSection').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('activeConvHeader').style.display = 'none';
    document.getElementById('imgPreviewStrip').style.display = 'none';
    updateUnreadBadge(0);
    state.messages = [];
    state.pendingImage = null;
  }, 2000);

  appendSystemMessage('Trip completed 🎉 · Thank you!');
  showToast('🎉 Trip completed! Earnings updated.');

  RideFlowWS.send('trip_completed', { orderId: order.id, driverId: DRIVER_INFO.id, fare: order.fareRaw });
}

// ─── Messaging ───────────────────────────────────────────────

/** Convert a ChatSync message object to the local format used by state.messages */
function _syncMsgToLocal(m) {
  return {
    id:       m.id,
    from:     m.sender,
    type:     m.type || 'text',
    text:     m.content,
    imageUrl: m.imageUrl || null,
    fileName: m.fileName || null,
    time:     new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read:     !!m.read,
  };
}

/** Called by ChatSync when a new message arrives from the customer */
function appendSyncedMessage(syncMsg) {
  const local = _syncMsgToLocal(syncMsg);
  appendMessage(local);
}

function activateOrderMessaging(order) {
  // Set conversation header
  document.getElementById('activeConvHeader').style.display = 'flex';
  document.getElementById('convAvatar').textContent   = order.customer.initials;
  document.getElementById('convName').textContent     = order.customer.name;
  document.getElementById('convOrderId').textContent  = order.id;

  // Show chat area
  document.getElementById('noConvPlaceholder').style.display = 'none';
  document.getElementById('chatMessages').style.display      = 'flex';
  document.getElementById('quickRepliesSection').style.display = 'block';
  document.getElementById('chatInputArea').style.display     = 'block';

  // Mark messages as read when chat is opened
  ChatSync.markAllRead(CHAT_CHANNEL);
  updateUnreadBadge(0);

  // Load persisted messages first, then fall back to initial mock data
  const persisted = ChatSync.getMessages(CHAT_CHANNEL);
  if (persisted.length > 0) {
    state.messages = persisted.map(m => _syncMsgToLocal(m));
  } else {
    state.messages = [...INITIAL_MESSAGES];
    // Persist initial messages so the customer dashboard can also see them
    state.messages.forEach((m, idx) => {
      if (m.from === 'system') return;
      ChatSync.sendMessage(CHAT_CHANNEL, {
        id:        'init-' + m.id,
        orderId:   CHAT_CHANNEL,
        sender:    m.from,
        type:      'text',
        content:   m.text,
        timestamp: new Date(Date.now() - (state.messages.length - idx) * 60000).toISOString(),
        read:      !!m.read,
      });
    });
  }

  renderMessages();

  // Attach drag-and-drop to chat input area
  const inputArea = document.getElementById('chatInputArea');
  FileHandler.attachDropZone(inputArea, (file) => {
    _handleImageFile(file);
  });
}

function renderMessages() {
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  state.messages.forEach(msg => {
    if (msg.from === 'system') {
      const el = document.createElement('div');
      el.className = 'sys-msg';
      el.textContent = msg.text;
      container.appendChild(el);
    } else {
      const isDriver = msg.from === 'driver';
      const el = document.createElement('div');
      el.className = 'msg ' + (isDriver ? 'driver-msg' : 'customer-msg');
      const bubbleContent = msg.type === 'image' && msg.imageUrl
        ? FileHandler.renderImageBubble(msg.imageUrl, msg.fileName)
        : `<div class="msg-bubble">${escapeHtml(msg.text || '')}</div>`;
      el.innerHTML = `
        <div class="msg-avatar ${isDriver ? 'driver' : 'customer'}">${isDriver ? '👨‍✈️' : getActiveCustomerInitials()}</div>
        <div class="msg-content">
          ${bubbleContent}
          <div class="msg-time">${msg.time}${isDriver && msg.read ? '<span class="msg-read">✓✓</span>' : ''}</div>
        </div>`;
      container.appendChild(el);
    }
  });

  scrollChat();
}

function appendMessage(msg) {
  state.messages.push(msg);
  const container = document.getElementById('chatMessages');

  if (msg.from === 'system') {
    const el = document.createElement('div');
    el.className = 'sys-msg';
    el.textContent = msg.text;
    el.style.animation = 'fadeUp 0.28s ease';
    container.appendChild(el);
  } else {
    const isDriver = msg.from === 'driver';
    const el = document.createElement('div');
    el.className = 'msg ' + (isDriver ? 'driver-msg' : 'customer-msg');
    el.style.animation = 'fadeUp 0.28s ease';
    const bubbleContent = msg.type === 'image' && msg.imageUrl
      ? FileHandler.renderImageBubble(msg.imageUrl, msg.fileName)
      : `<div class="msg-bubble">${escapeHtml(msg.text || '')}</div>`;
    el.innerHTML = `
      <div class="msg-avatar ${isDriver ? 'driver' : 'customer'}">${isDriver ? '👨‍✈️' : getActiveCustomerInitials()}</div>
      <div class="msg-content">
        ${bubbleContent}
        <div class="msg-time">${msg.time}${isDriver && msg.read ? '<span class="msg-read">✓✓</span>' : ''}</div>
      </div>`;
    container.appendChild(el);
  }

  scrollChat();
}

function appendSystemMessage(text) {
  appendMessage({ id: ++state.msgIdCounter, from: 'system', text, time: getCurrentTime() });
}

function scrollChat() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function getActiveCustomerInitials() {
  const order = state.orders.find(o => o.id === state.activeOrderId);
  return order ? order.customer.initials : '?';
}

function sendDriverMessage() {
  // If there is a pending image, send that first
  if (state.pendingImage) {
    _sendDriverImage(state.pendingImage.dataUrl, state.pendingImage.fileName);
    return;
  }

  const input = document.getElementById('driverChatInput');
  const text = input.value.trim();
  if (!text) return;

  const now = getCurrentTime();
  const msg = {
    id:   ++state.msgIdCounter,
    from: 'driver',
    type: 'text',
    text,
    time: now,
    read: false,
  };

  appendMessage(msg);
  input.value = '';
  input.style.height = 'auto';

  // Persist to shared storage so the customer dashboard can see it
  if (state.activeOrderId) {
    const user = window._currentUser;
    ChatSync.sendMessage(CHAT_CHANNEL, {
      id:          'drv-' + msg.id,
      orderId:     CHAT_CHANNEL,
      sender:      'driver',
      senderName:  (user && user.name) ? user.name : (DRIVER_INFO.name || 'Driver'),
      senderEmail: (user && user.email) ? user.email : '',
      type:        'text',
      content:     text,
      timestamp:   new Date().toISOString(),
      read:        false,
    });
  }

  RideFlowWS.send('message', { from: 'driver', text, orderId: state.activeOrderId });

  // Simulate read receipt
  setTimeout(() => {
    msg.read = true;
    renderMessages();
  }, 1500);
}

function _sendDriverImage(dataUrl, fileName) {
  const now = getCurrentTime();
  const msg = {
    id:       ++state.msgIdCounter,
    from:     'driver',
    type:     'image',
    text:     fileName || 'image',
    imageUrl: dataUrl,
    fileName: fileName || 'image',
    time:     now,
    read:     false,
  };

  appendMessage(msg);

  // Clear pending image preview
  state.pendingImage = null;
  const strip = document.getElementById('imgPreviewStrip');
  strip.innerHTML = '';
  strip.style.display = 'none';

  // Persist to shared storage
  if (state.activeOrderId) {
    const user = window._currentUser;
    ChatSync.sendMessage(CHAT_CHANNEL, {
      id:          'drv-img-' + msg.id,
      orderId:     CHAT_CHANNEL,
      sender:      'driver',
      senderName:  (user && user.name) ? user.name : (DRIVER_INFO.name || 'Driver'),
      senderEmail: (user && user.email) ? user.email : '',
      type:        'image',
      content:     fileName || 'image',
      imageUrl:    dataUrl,
      fileName:    fileName || 'image',
      timestamp:   new Date().toISOString(),
      read:        false,
    });
  }

  RideFlowWS.send('message', { from: 'driver', type: 'image', fileName, orderId: state.activeOrderId });
}

/** Called when the user selects an image via the file input */
function handleDriverImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = ''; // Reset so the same file can be picked again
  _handleImageFile(file);
}

function _handleImageFile(file) {
  FileHandler.processFile(file)
    .then(({ dataUrl, fileName }) => {
      state.pendingImage = { dataUrl, fileName };
      _showImagePreview(dataUrl, fileName);
    })
    .catch((err) => {
      showToast('⚠️ ' + err.message, 3500);
    });
}

function _showImagePreview(dataUrl, fileName) {
  const safeName = escapeHtml(fileName || 'image');
  const strip = document.getElementById('imgPreviewStrip');
  strip.style.display = 'flex';
  strip.innerHTML = `
    <div class="img-preview-thumb">
      <img src="${dataUrl}" alt="preview">
      <button class="img-preview-cancel" onclick="cancelPendingImage()" title="Remove">✕</button>
    </div>
    <span style="font-size:11px;color:var(--text2);">${safeName}<br><span style="color:var(--muted);">Click send ↗</span></span>`;
}

function cancelPendingImage() {
  state.pendingImage = null;
  const strip = document.getElementById('imgPreviewStrip');
  strip.innerHTML = '';
  strip.style.display = 'none';
}

function updateUnreadBadge(count) {
  const badge = document.getElementById('unreadBadgeHeader');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function sendQuickReply(text) {
  if (!state.activeOrderId) { showToast('⚠️ No active order'); return; }
  const msg = {
    id:   ++state.msgIdCounter,
    from: 'driver',
    text,
    time: getCurrentTime(),
    read: false,
  };
  appendMessage(msg);
  RideFlowWS.send('message', { from: 'driver', text, orderId: state.activeOrderId });
  setTimeout(() => { msg.read = true; renderMessages(); }, 1500);
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendDriverMessage();
  }
}

// ─── Earnings ─────────────────────────────────────────────────

function updateEarnings() {
  const gross = state.earnings.gross;
  const fee   = Math.round(gross * PLATFORM_FEE_RATE);
  const net   = gross - fee;

  document.getElementById('totalEarnings').textContent = formatCurrency(net);
  document.getElementById('tripsCount').textContent    = state.earnings.trips;
  document.getElementById('mapTripCount').textContent  = state.earnings.trips + ' trip' + (state.earnings.trips !== 1 ? 's' : '');

  if (gross > 0) {
    document.getElementById('earningsSub').textContent = state.earnings.trips + ' trip' + (state.earnings.trips !== 1 ? 's' : '') + ' completed today';
    document.getElementById('commissionBlock').style.display = 'block';
    document.getElementById('grossEarnings').textContent     = formatCurrency(gross);
    document.getElementById('platformFee').textContent       = '- ' + formatCurrency(fee);
    document.getElementById('netEarnings').textContent       = formatCurrency(net);
  }

  // Update earnings breakdown by service type
  const breakdownEl = document.getElementById('earningsBreakdown');
  if (breakdownEl && gross > 0) {
    const b = state.earnings.byService;
    breakdownEl.style.display = 'block';
    breakdownEl.innerHTML = `
      <div class="comm-row"><span class="comm-label">🛵 Ride</span><span class="comm-val positive">${formatCurrency(b.ride || 0)}</span></div>
      <div class="comm-row"><span class="comm-label">📦 Package</span><span class="comm-val positive">${formatCurrency(b.package || 0)}</span></div>
      <div class="comm-row"><span class="comm-label">🍱 Food</span><span class="comm-val positive">${formatCurrency(b.food || 0)}</span></div>
    `;
  }
}

function updateOnlineTime() {
  if (state.isOnline) {
    document.getElementById('onlineTime').textContent = formatOnlineTime(state.onlineStartTime);
  }
}

// ─── Map Status ───────────────────────────────────────────────

function updateMapStatus(text) {
  document.getElementById('mapStatusText').textContent = text;
}

// ─── Service Toggles ─────────────────────────────────────────

function toggleService(service) {
  const idx = state.enabledServices.indexOf(service);
  if (idx >= 0) {
    if (state.enabledServices.length <= 1) {
      showToast('⚠️ At least one service must be enabled');
      return;
    }
    state.enabledServices.splice(idx, 1);
    showToast(service.charAt(0).toUpperCase() + service.slice(1) + ' service disabled');
  } else {
    state.enabledServices.push(service);
    showToast(service.charAt(0).toUpperCase() + service.slice(1) + ' service enabled');
  }
  renderServiceToggles();
}

function renderServiceToggles() {
  const container = document.getElementById('serviceTogglesContainer');
  if (!container) return;
  const services = [
    { id: 'ride',    label: 'Ride',    icon: '🛵' },
    { id: 'package', label: 'Package', icon: '📦' },
    { id: 'food',    label: 'Food',    icon: '🍱' },
  ];
  container.innerHTML = services.map(s => {
    const enabled = state.enabledServices.includes(s.id);
    return `<button class="service-toggle-btn ${enabled ? 'enabled' : ''}" onclick="toggleService('${s.id}')">
      ${s.icon} ${s.label}
    </button>`;
  }).join('');
}

// ─── Delete Chat History (driver side) ───────────────────────

function deleteDriverChatHistory() {
  if (!state.activeOrderId) { showToast('⚠️ No active chat to clear'); return; }
  if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
  ChatSync.deleteChatHistory(CHAT_CHANNEL);
  state.messages = [];
  const container = document.getElementById('chatMessages');
  if (container) container.innerHTML = '';
  appendSystemMessage('Chat history cleared');
  showToast('🗑️ Chat history deleted');
}

// ============================================================
// SECTION 12: LOGIN PAGE FUNCTIONS
// ============================================================
function _showAlreadyLoggedIn(user) {
  document.getElementById('loginForms').style.display = 'none';
  const notice = document.getElementById('alreadyNotice');
  notice.style.display = '';
  document.getElementById('alreadyName').textContent = user.name || 'Guest';
  document.getElementById('alreadyDashBtn').onclick = function () {
    window.location.href = user.type === 'driver' ? '/pages/driver.html' : '/pages/customer.html';
  };
}

function _showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function _clearError(elId) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

function doCustomerLogin() {
  _clearError('customerError');
  const email = document.getElementById('customerEmailInput').value.trim();
  if (!email) { _showError('customerError', 'Please enter your email address.'); return; }
  const result = Auth.validateEmail(email);
  if (!result.valid) { _showError('customerError', result.error); return; }
  if (result.type !== 'customer') {
    _showError('customerError', 'Please use a @customer.mail email address.');
    return;
  }
  Auth.login(email);
  window.location.href = '/pages/customer.html';
}

function doCustomerGuest() {
  Auth.loginAsGuest('customer');
  window.location.href = '/pages/customer.html';
}

function doDriverLogin() {
  _clearError('driverError');
  const email = document.getElementById('driverEmailInput').value.trim();
  if (!email) { _showError('driverError', 'Please enter your email address.'); return; }
  const result = Auth.validateEmail(email);
  if (!result.valid) { _showError('driverError', result.error); return; }
  if (result.type !== 'driver') {
    _showError('driverError', 'Please use a @driver.mail email address.');
    return;
  }
  Auth.login(email);
  window.location.href = '/pages/driver.html';
}

function doDriverGuest() {
  Auth.loginAsGuest('driver');
  window.location.href = '/pages/driver.html';
}

// ============================================================
// SECTION 13: APP CONTROLLER
// ============================================================
const AppController = {
  init() {
    const page = this.detectPage();

    // Initialize the correct state object for this page
    if (page === 'customer') {
      state = {
        vehicle: 'motorcycle',
        service: 'ride',
        tier: 'standard',
        pickup: '',
        destination: '',
        currentOrderId: null,
        currentDriver: null,
        userRating: 0,
        savedLocType: '🏠',
        orders: [],
        savedLocs: [],
        estimatedKm: null,
      };
    } else if (page === 'driver') {
      state = {
        isOnline: true,
        orders: [...MOCK_ORDERS],
        activeOrderId: null,
        messages: [],
        earnings: {
          gross: 0,
          trips: 0,
          byService: { ride: 0, package: 0, food: 0 },
        },
        onlineStartTime: Date.now(),
        msgIdCounter: 10,
        orderStep: 'pickup',
        pendingImage: null,
        enabledServices: ['ride', 'package', 'food'],
      };
    }

    if (page === 'login') this.initLoginPage();
    else if (page === 'customer') this.initCustomerDashboard();
    else if (page === 'driver') this.initDriverDashboard();
  },

  detectPage() {
    const path = window.location.pathname;
    if (path.includes('customer')) return 'customer';
    if (path.includes('driver')) return 'driver';
    return 'login';
  },

  initLoginPage() {
    const user = Auth.getCurrentUser();
    if (user) {
      _showAlreadyLoggedIn(user);
      return;
    }
    document.getElementById('loginForms').style.display = '';
    document.getElementById('alreadyNotice').style.display = 'none';
  },

  initCustomerDashboard() {
    const user = Auth.getCurrentUser();
    if (!user || user.type !== 'customer') {
      window.location.href = '/pages/login.html';
      return;
    }
    window._currentUser = user;
    onUserLoggedIn(user);

    renderTiers();

    const pickupEl = document.getElementById('pickupInput');
    const destEl   = document.getElementById('destInput');
    if (pickupEl) pickupEl.addEventListener('input', e => { state.pickup = e.target.value; updatePriceEstimate(); });
    if (destEl)   destEl.addEventListener('input',  e => { state.destination = e.target.value; updatePriceEstimate(); });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
    });

    const loginEmailEl = document.getElementById('loginEmail');
    if (loginEmailEl) {
      loginEmailEl.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    }
  },

  initDriverDashboard() {
    const user = Auth.getCurrentUser();
    if (!user || user.type !== 'driver') {
      window.location.href = '/pages/login.html';
      return;
    }

    // Show the app shell (unified theme hides it by default)
    showAppShell();

    // Display driver name from session
    const nameEl = document.getElementById('driverName');
    if (nameEl && !user.isGuest) {
      nameEl.textContent = user.name;
    }

    window._currentUser = user;

    // Connect WebSocket (mock mode)
    RideFlowWS.connect();

    // Register WebSocket event handlers
    RideFlowWS
      .on('connected', () => {
        console.log('[WS] Connected to RideFlow server');
      })
      .on('new_order', (order) => {
        state.orders.unshift(order);
        renderOrders();
        showToast('🔔 New order from ' + order.customer.name + '!', 4000);
      })
      .on('customer_message', ({ text, time }) => {
        if (!state.activeOrderId) return;
        appendMessage({ id: ++state.msgIdCounter, from: 'customer', text, time });
        showToast('💬 Customer: ' + text.slice(0, 40) + (text.length > 40 ? '…' : ''), 3000);
      });

    renderServiceToggles();
    renderOrders();
    updateEarnings();

    // Start online timer (updates every 30 seconds)
    setInterval(updateOnlineTime, 30000);

    // Initialize Leaflet map
    MapIntegration.init('liveMap', (statusText) => {
      updateMapStatus(statusText);
      const locEl = document.getElementById('locStatusText');
      if (locEl) locEl.textContent = statusText;
    });

    // Simulate a new incoming order after 12 seconds
    RideFlowWS.simulateIncomingOrder(SIMULATED_NEW_ORDER, 12000);

    console.log('[RideFlow] Driver Dashboard initialized');
  },
};

document.addEventListener('DOMContentLoaded', () => AppController.init());
