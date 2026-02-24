/* =============================================
   RideFlow — Driver Dashboard Application
   Consolidated: driver logic + file handling + map integration
   WebSocket-ready architecture for real-time features
============================================= */

'use strict';

// =============================================
// FILE HANDLER (image upload, validation, base64 conversion)
// =============================================
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

// Full-screen image viewer (singleton)
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

// =============================================
// MAP INTEGRATION (Leaflet.js + Geolocation API)
// =============================================
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

// =============================================
// DRIVER CONSTANTS
// =============================================
// Platform fee rate — use shared constant (CONSTANTS.PLATFORM_FEE_RATE = 0.20)
const PLATFORM_FEE_RATE = (typeof CONSTANTS !== 'undefined') ? CONSTANTS.PLATFORM_FEE_RATE : 0.20;

// Shared localStorage channel key for cross-tab chat sync
const CHAT_CHANNEL = 'ORD-DEMO';

// =============================================
// DRIVER PROFILE (mock data)
// =============================================
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

// =============================================
// MOCK INCOMING ORDERS
// =============================================
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

// =============================================
// APPLICATION STATE
// =============================================
const state = {
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

// =============================================
// WEBSOCKET-READY ARCHITECTURE
// (Real implementation would connect to a WebSocket server)
// =============================================
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

// =============================================
// UTILITIES
// =============================================
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

// =============================================
// TOAST NOTIFICATIONS
// =============================================
let toastTimer = null;

function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  toastMsg.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// =============================================
// DRIVER STATUS TOGGLE (Online / Offline)
// =============================================
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

// =============================================
// ORDERS RENDERING
// =============================================
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

// =============================================
// ACCEPT / DECLINE ORDER
// =============================================
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

// =============================================
// ACTIVE ORDER UI
// =============================================
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

// =============================================
// MESSAGING
// =============================================

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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// =============================================
// EARNINGS
// =============================================
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

// =============================================
// MAP STATUS
// =============================================
function updateMapStatus(text) {
  document.getElementById('mapStatusText').textContent = text;
}

// =============================================
// WEBSOCKET EVENT HANDLERS
// =============================================
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

// =============================================
// SIMULATED ORDER (arrives after 12 seconds)
// =============================================
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

// =============================================
// SERVICE TOGGLES
// =============================================
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

// =============================================
// SIGN OUT
// =============================================
function doSignOut() {
  if (typeof Auth !== 'undefined') {
    Auth.logout();
  } else {
    window.location.href = '../auth/login.html';
  }
}

// =============================================
// DELETE CHAT HISTORY (driver side)
// =============================================
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

// =============================================
// INITIALIZATION
// =============================================
function init() {
  // Auth check — redirect if not a driver
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (!user || user.type !== 'driver') {
    window.location.href = '../auth/login.html';
    return;
  }

  // Display driver name from session
  const nameEl = document.getElementById('driverName');
  if (nameEl && !user.isGuest) {
    nameEl.textContent = user.name;
  }

  // Store user on window for convenience
  window._currentUser = user;

  // Connect WebSocket (mock mode)
  RideFlowWS.connect();

  // Render service toggles
  renderServiceToggles();

  // Render initial order list
  renderOrders();

  // Update earnings display
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
}

document.addEventListener('DOMContentLoaded', init);
