/* =============================================
   RideFlow — Customer Dashboard Application
   localStorage-based auth + real-time chat sync
============================================= */

'use strict';

// ─────────────────────────────────────────────
//  TIER DATA (Service tiers by vehicle and type)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  APP STATE
// ─────────────────────────────────────────────
const state = {
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

// Demo order ID for chat sync between customer and driver dashboards
const DEMO_ORDER_ID = 'ORD-DEMO';

// ─────────────────────────────────────────────
//  ENTRY POINT — Auth check on DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const user = Auth.getCurrentUser();
  if (!user || user.type !== 'customer') {
    window.location.href = '../auth/login.html';
    return;
  }
  window._currentUser = user;
  onUserLoggedIn(user);
});

// ─────────────────────────────────────────────
//  AUTH HANDLERS
// ─────────────────────────────────────────────
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

function doSignOut() {
  closeModal('userMenuModal');
  window._currentUser = null;
  Auth.logout();
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

// ─────────────────────────────────────────────
//  BOOKING — Tier rendering & vehicle/service selection
// ─────────────────────────────────────────────
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
    return `Rp ${Math.round(est/1000)*1000 .toLocaleString('id-ID')}`;
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

// ─────────────────────────────────────────────
//  PRICE ESTIMATOR
// ─────────────────────────────────────────────
let priceTimer = null;

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

// ─────────────────────────────────────────────
//  SAVED LOCATIONS
// ─────────────────────────────────────────────
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
        <button class="icon-btn" onclick="useSavedLoc('${escHtml(loc.address)}')" title="Use as pickup">↑</button>
        <button class="icon-btn delete" onclick="removeSavedLoc('${loc.id}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function renderSavedPicks() {
  const picks = document.getElementById('savedPicks');
  if (state.savedLocs.length === 0) { picks.innerHTML = ''; return; }
  picks.innerHTML = state.savedLocs.slice(0, 4).map(loc => `
    <button class="saved-pick-btn" onclick="useSavedAsDestination('${escHtml(loc.address)}')" title="Set as destination">
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

// ─────────────────────────────────────────────
//  ORDER FLOW
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  DRIVER RATING
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  LOCAL ORDER CACHE
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  ORDER HISTORY
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  CHAT — AI assistant + driver message sync
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
//  NLP INTENT PARSER (chat bot)
// ─────────────────────────────────────────────
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

function sendSuggestion(text) { document.getElementById('chatInput').value = text; sendMessage(); }

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

// ─────────────────────────────────────────────
//  DELETE CHAT HISTORY
// ─────────────────────────────────────────────
function deleteChatHistory() {
  if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
  ChatSyncBridge.deleteChatHistory(DEMO_ORDER_ID);
  document.getElementById('chatMessages').innerHTML = '';
  addBotMessage('Chat history cleared. 🗑️');
  showToast('🗑️ Chat history deleted');
}

// ─────────────────────────────────────────────
//  CHAT SYNC BRIDGE — receive driver messages
// ─────────────────────────────────────────────
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
                   onclick="this.requestFullscreen && this.requestFullscreen()">
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

// ─────────────────────────────────────────────
//  UI TABS
// ─────────────────────────────────────────────
function switchChatTab(tab) {
  document.querySelectorAll('.chat-tab').forEach((el,i) => {
    el.classList.toggle('active', (tab==='chat'&&i===0)||(tab==='history'&&i===1));
  });
  document.getElementById('chatView').classList.toggle('active',    tab === 'chat');
  document.getElementById('historyView').classList.toggle('active', tab === 'history');
  if (tab === 'history') renderHistory();
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function showEl(id)     { document.getElementById(id).style.display = ''; }
function hideEl(id)     { document.getElementById(id).style.display = 'none'; }

function showAppShell() {
  const shell = document.getElementById('appShell');
  shell.style.display = 'block';
  shell.classList.add('visible');
}

function showToast(msg, dur = 3000) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}

function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(str)   { return str.split(' ').map(w => w.charAt(0).toUpperCase()+w.slice(1)).join(' '); }
function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ─────────────────────────────────────────────
//  EXPOSE FUNCTIONS TO WINDOW
// ─────────────────────────────────────────────
Object.assign(window, {
  // Auth
  doLogin, doGuestMode, doSignOut, showAuthGate, showUserMenu,
  // Booking
  selectVehicle, selectService, selectTierById, swapLocations,
  openConfirmModal, proceedBook, completeRide, cancelRide,
  // Rating
  setRating, submitRating,
  // Saved locations
  openAddSavedModal, selectLocType, saveSavedLocation,
  removeSavedLoc, useSavedLoc, useSavedAsDestination,
  // Chat & UI
  switchChatTab, sendMessage, sendSuggestion, handleKey, autoResize,
  openModal, closeModal, addBotMessage, deleteChatHistory,
  escHtml,
});

// ─────────────────────────────────────────────
//  INITIALIZATION (runs after DOMContentLoaded)
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Render tiers once DOM is ready (auth check also runs on DOMContentLoaded, this is safe
  // because both handlers are registered before the event fires)
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
    loginEmailEl.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  }
});
