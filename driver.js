/* =============================================
   RideFlow — Driver Dashboard JS
   WebSocket-ready architecture for real-time features
============================================= */

'use strict';

// =============================================
// CONSTANTS
// =============================================

const PLATFORM_FEE_RATE = 0.2; // 20% platform commission

// =============================================
// MOCK DATA
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

const MOCK_ORDERS = [
  {
    id: 'ORD-7821',
    type: 'motor',
    typeLabel: 'Motor',
    serviceIcon: '🛵',
    serviceName: 'GoRide',
    serviceTier: 'Standar',
    customer: {
      name: 'Siti Rahma',
      initials: 'SR',
      rating: 4.8,
      phone: '+62 818-2233-4455',
    },
    pickup: 'Mall Taman Anggrek, Jakarta Barat',
    destination: 'Bandara Soekarno-Hatta, Terminal 3',
    fare: 'Rp 42.000',
    fareRaw: 42000,
    distance: '12,4 km',
    time: '2 menit lalu',
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
    pickup: 'Stasiun MRT Bundaran HI',
    destination: 'Sudirman Central Business District',
    fare: 'Rp 28.000',
    fareRaw: 28000,
    distance: '5,1 km',
    time: '5 menit lalu',
    status: 'incoming',
  },
];

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
    text: 'Halo driver, saya sudah di depan pintu Mall ya 🙏',
    time: '09:15',
  },
  {
    id: 3,
    from: 'driver',
    text: 'Siap! On my way! 🏍️ ETA sekitar 5 menit lagi.',
    time: '09:15',
    read: true,
  },
  {
    id: 4,
    from: 'customer',
    text: 'Oke, saya pakai baju biru ya',
    time: '09:16',
  },
];

// =============================================
// STATE
// =============================================

const state = {
  isOnline: true,
  orders: [...MOCK_ORDERS],
  activeOrderId: null,
  messages: [],
  earnings: {
    gross: 0,
    trips: 0,
  },
  onlineStartTime: Date.now(),
  msgIdCounter: 10,
  orderStep: 'pickup', // 'pickup' | 'dropoff'
};

// =============================================
// WEBSOCKET-READY ARCHITECTURE
// (Real implementation would connect to ws server)
// =============================================

const RideFlowWS = {
  _handlers: {},
  _connected: false,

  connect(url) {
    // In production: this.ws = new WebSocket(url);
    // Mock connection
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
    // In production: this.ws.send(JSON.stringify({ type, payload }));
  },

  _emit(event, data) {
    (this._handlers[event] || []).forEach(fn => fn(data));
  },

  // Simulate receiving a new order after delay
  simulateIncomingOrder(order, delayMs = 8000) {
    setTimeout(() => {
      this._emit('new_order', order);
    }, delayMs);
  },

  // Simulate customer message after delay
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

function formatRupiah(amount) {
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

// =============================================
// TOAST
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
// DRIVER STATUS TOGGLE
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
    card.className = 'order-card ' + (order.status === 'incoming' ? 'incoming' : order.status === 'active' ? 'active-order' : 'completed-order');
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

  // Simulate customer sending a message after accepting
  RideFlowWS.simulateCustomerMessage('Terima kasih sudah menerima order saya! 🙏', 4000);
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
  document.getElementById('activeCustomerName').textContent = order.customer.name;
  document.getElementById('activeCustomerRating').textContent = '★ ' + order.customer.rating;
  document.getElementById('activeCustomerPhone').textContent = order.customer.phone;
  document.getElementById('activePickup').textContent = order.pickup;
  document.getElementById('activeDest').textContent = order.destination;
  document.getElementById('activeServiceIcon').textContent = order.serviceIcon;
  document.getElementById('activeServiceName').textContent = order.serviceName;
  document.getElementById('activeServiceTier').textContent = order.serviceTier;
  document.getElementById('activeServicePrice').textContent = order.fare;

  updatePrimaryAction();
}

function clearActiveOrderInfo() {
  document.getElementById('noActiveOrderMsg').style.display = 'block';
  document.getElementById('activeOrderInfo').style.display = 'none';
  document.getElementById('actionSection').style.display = 'none';
}

function updatePrimaryAction() {
  const btn = document.getElementById('primaryActionBtn');
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
    updateMapStatus('Picked up customer · Heading to destination…');
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

  updateEarnings();
  updateMapStatus('Trip completed · Searching for orders…');
  clearActiveOrderInfo();
  renderOrders();

  // Hide chat after short delay
  setTimeout(() => {
    document.getElementById('noConvPlaceholder').style.display = 'flex';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('quickRepliesSection').style.display = 'none';
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('activeConvHeader').style.display = 'none';
    state.messages = [];
  }, 2000);

  appendSystemMessage('Trip completed 🎉 · Thank you!');
  showToast('🎉 Trip completed! Earnings updated.');

  RideFlowWS.send('trip_completed', { orderId: order.id, driverId: DRIVER_INFO.id, fare: order.fareRaw });
}

// =============================================
// MESSAGING
// =============================================

function activateOrderMessaging(order) {
  // Set conversation header
  document.getElementById('activeConvHeader').style.display = 'flex';
  document.getElementById('convAvatar').textContent = order.customer.initials;
  document.getElementById('convName').textContent = order.customer.name;
  document.getElementById('convOrderId').textContent = order.id;

  // Show chat area
  document.getElementById('noConvPlaceholder').style.display = 'none';
  document.getElementById('chatMessages').style.display = 'flex';
  document.getElementById('quickRepliesSection').style.display = 'block';
  document.getElementById('chatInputArea').style.display = 'block';

  // Load initial messages
  state.messages = [...INITIAL_MESSAGES];
  renderMessages();
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
      el.innerHTML = `
        <div class="msg-avatar ${isDriver ? 'driver' : 'customer'}">${isDriver ? '👨‍✈️' : getActiveCustomerInitials()}</div>
        <div class="msg-content">
          <div class="msg-bubble">${escapeHtml(msg.text)}</div>
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
    el.innerHTML = `
      <div class="msg-avatar ${isDriver ? 'driver' : 'customer'}">${isDriver ? '👨‍✈️' : getActiveCustomerInitials()}</div>
      <div class="msg-content">
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
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
  const input = document.getElementById('driverChatInput');
  const text = input.value.trim();
  if (!text) return;

  const msg = {
    id: ++state.msgIdCounter,
    from: 'driver',
    text,
    time: getCurrentTime(),
    read: false,
  };

  appendMessage(msg);
  input.value = '';
  input.style.height = 'auto';

  RideFlowWS.send('message', { from: 'driver', text, orderId: state.activeOrderId });

  // Simulate read receipt
  setTimeout(() => {
    msg.read = true;
    renderMessages();
  }, 1500);
}

function sendQuickReply(text) {
  if (!state.activeOrderId) { showToast('⚠️ No active order'); return; }
  const msg = {
    id: ++state.msgIdCounter,
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
  return text
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
  const fee = Math.round(gross * PLATFORM_FEE_RATE);
  const net = gross - fee;

  document.getElementById('totalEarnings').textContent = formatRupiah(net);
  document.getElementById('tripsCount').textContent = state.earnings.trips;
  document.getElementById('mapTripCount').textContent = state.earnings.trips + ' trip' + (state.earnings.trips !== 1 ? 's' : '');

  if (gross > 0) {
    document.getElementById('earningsSub').textContent = state.earnings.trips + ' trip' + (state.earnings.trips !== 1 ? 's' : '') + ' completed today';
    document.getElementById('commissionBlock').style.display = 'block';
    document.getElementById('grossEarnings').textContent = formatRupiah(gross);
    document.getElementById('platformFee').textContent = '- ' + formatRupiah(fee);
    document.getElementById('netEarnings').textContent = formatRupiah(net);
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
// SIMULATE A NEW ORDER AFTER 12 SECONDS
// =============================================

const SIMULATED_NEW_ORDER = {
  id: 'ORD-7822',
  type: 'motor',
  typeLabel: 'Motor',
  serviceIcon: '🛵',
  serviceName: 'GoRide',
  serviceTier: 'Hemat',
  customer: {
    name: 'Dewi Lestari',
    initials: 'DL',
    rating: 4.75,
    phone: '+62 857-9900-1122',
  },
  pickup: 'Halte Transjakarta Semanggi',
  destination: 'Pasar Santa, Jakarta Selatan',
  fare: 'Rp 18.000',
  fareRaw: 18000,
  distance: '4,3 km',
  time: 'Baru saja',
  status: 'incoming',
};

// =============================================
// INIT
// =============================================

function init() {
  // Connect WebSocket (mock)
  RideFlowWS.connect();

  // Render initial orders
  renderOrders();

  // Update earnings display
  updateEarnings();

  // Start online timer
  setInterval(updateOnlineTime, 30000);

  // Simulate a new order arriving after 12 seconds
  RideFlowWS.simulateIncomingOrder(SIMULATED_NEW_ORDER, 12000);

  console.log('[RideFlow] Driver Dashboard initialized');
}

document.addEventListener('DOMContentLoaded', init);
