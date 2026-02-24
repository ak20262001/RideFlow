/* =============================================
   RideFlow — Unified Chat Sync Module
   Bi-directional messaging via localStorage
   Works for both customer and driver dashboards
============================================= */

'use strict';

// ── Shared ChatSync (used by both sides) ─────

const ChatSync = (() => {
  const STORAGE_KEY = 'rideflow-chats';
  const UNREAD_KEY  = 'rideflow-unread-messages';

  let _onNewMessage = null;
  let _lastSeenTimestamp = {};

  // ── Internal helpers ──────────────────────

  function _readChats() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function _writeChats(chats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }

  function _readUnread() {
    try {
      return JSON.parse(localStorage.getItem(UNREAD_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function _writeUnread(unread) {
    localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
  }

  function _notify(msg) {
    if (typeof _onNewMessage === 'function') {
      _onNewMessage(msg);
    }
  }

  // ── Public API ────────────────────────────

  /**
   * Initialize sync for a given order (driver side).
   * Listens for messages from the customer.
   * @param {string}   orderId
   * @param {Function} onNewMessage  Called with new message objects
   */
  function init(orderId, onNewMessage) {
    _onNewMessage = onNewMessage;

    // Record the latest timestamp already seen
    const chats = _readChats();
    const msgs  = (chats[orderId] && chats[orderId].messages) || [];
    _lastSeenTimestamp[orderId] = msgs.length
      ? msgs[msgs.length - 1].timestamp
      : new Date(0).toISOString();

    // Listen for changes made by the other tab
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      _checkForNewMessages(orderId);
    });

    // Fallback polling every 1.5 s (covers same-tab simulation)
    setInterval(() => _checkForNewMessages(orderId), 1500);
  }

  function _checkForNewMessages(orderId) {
    const chats = _readChats();
    const msgs  = (chats[orderId] && chats[orderId].messages) || [];
    const lastSeen = _lastSeenTimestamp[orderId] || new Date(0).toISOString();

    const newMsgs = msgs.filter(m => m.timestamp > lastSeen);
    if (newMsgs.length === 0) return;

    _lastSeenTimestamp[orderId] = newMsgs[newMsgs.length - 1].timestamp;
    newMsgs.forEach(msg => _notify(msg));
  }

  /**
   * Persist a message and broadcast it (storage event triggers the other tab).
   * @param {string} orderId
   * @param {Object} msg
   */
  function sendMessage(orderId, msg) {
    const chats = _readChats();
    if (!chats[orderId]) {
      chats[orderId] = {
        orderId,
        messages: [],
        createdAt: new Date().toISOString(),
        lastMessageTime: new Date().toISOString(),
      };
    }

    // Deduplicate — do not re-add if already present
    const exists = chats[orderId].messages.some(m => m.id === msg.id);
    if (!exists) {
      chats[orderId].messages.push(msg);
      chats[orderId].lastMessageTime = msg.timestamp;
    }

    _writeChats(chats);

    // Update unread count for the driver side when customer sends
    if (msg.sender !== 'driver') {
      const unread = _readUnread();
      unread[orderId] = (unread[orderId] || 0) + 1;
      _writeUnread(unread);
    }
  }

  /** Load all persisted messages for an order */
  function getMessages(orderId) {
    const chats = _readChats();
    return (chats[orderId] && chats[orderId].messages) || [];
  }

  /** Mark all messages for an order as read (clears unread badge) */
  function markAllRead(orderId) {
    const unread = _readUnread();
    delete unread[orderId];
    _writeUnread(unread);
  }

  /** Get unread message count for a given order */
  function getUnreadCount(orderId) {
    const unread = _readUnread();
    return unread[orderId] || 0;
  }

  return { init, sendMessage, getMessages, markAllRead, getUnreadCount };
})();


// ── Customer-side Bridge (used by customer dashboard) ──

const ChatSyncBridge = (() => {
  const STORAGE_KEY = 'rideflow-chats';
  const UNREAD_KEY  = 'rideflow-unread-messages';

  let _activeOrderId   = null;
  let _onDriverMessage = null;
  let _lastSeenTs      = {};
  let _userId          = 'customer';

  // ── Internal helpers ──────────────────────

  function _readChats() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function _writeChats(chats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }

  function _genId() {
    return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  // ── Incoming message detection ────────────

  function _checkForDriverMessages(orderId) {
    const chats  = _readChats();
    const msgs   = (chats[orderId] && chats[orderId].messages) || [];
    const lastTs = _lastSeenTs[orderId] || new Date(0).toISOString();

    const fresh = msgs.filter(m => m.sender === 'driver' && m.timestamp > lastTs);
    if (!fresh.length) return;

    _lastSeenTs[orderId] = fresh[fresh.length - 1].timestamp;
    fresh.forEach(msg => {
      if (typeof _onDriverMessage === 'function') _onDriverMessage(msg);
    });
  }

  // ── Public API ────────────────────────────

  /**
   * Activate the bridge for a specific order.
   * @param {string}   orderId
   * @param {string}   userId        Customer display name / id
   * @param {Function} onDriverMsg   Called when a driver message arrives
   */
  function init(orderId, userId, onDriverMsg) {
    _activeOrderId   = orderId;
    _userId          = userId || 'customer';
    _onDriverMessage = onDriverMsg;

    // Seed the last-seen pointer at the most recent existing message
    const chats = _readChats();
    const msgs  = (chats[orderId] && chats[orderId].messages) || [];
    _lastSeenTs[orderId] = msgs.length
      ? msgs[msgs.length - 1].timestamp
      : new Date(0).toISOString();

    // Real-time: storage events from the driver tab
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) _checkForDriverMessages(orderId);
    });

    // Polling fallback
    setInterval(() => _checkForDriverMessages(orderId), 1500);
  }

  /**
   * Write a customer text message to the shared store.
   * @param {string} text
   */
  function sendTextMessage(text) {
    if (!_activeOrderId) return;
    const msg = {
      id:        _genId(),
      orderId:   _activeOrderId,
      sender:    'customer',
      type:      'text',
      content:   text,
      timestamp: new Date().toISOString(),
      read:      false,
    };
    _persist(msg);
  }

  /**
   * Write a customer image message to the shared store.
   * @param {string} dataUrl    base64 data URL
   * @param {string} fileName   original filename
   */
  function sendImageMessage(dataUrl, fileName) {
    if (!_activeOrderId) return;
    const msg = {
      id:        _genId(),
      orderId:   _activeOrderId,
      sender:    'customer',
      type:      'image',
      content:   fileName || 'image',
      imageUrl:  dataUrl,
      fileName:  fileName || 'image',
      timestamp: new Date().toISOString(),
      read:      false,
    };
    _persist(msg);
  }

  function _persist(msg) {
    const chats = _readChats();
    if (!chats[_activeOrderId]) {
      chats[_activeOrderId] = {
        orderId:         _activeOrderId,
        customerId:      _userId,
        driverId:        'drv_001',
        messages:        [],
        createdAt:       new Date().toISOString(),
        lastMessageTime: new Date().toISOString(),
      };
    }
    chats[_activeOrderId].messages.push(msg);
    chats[_activeOrderId].lastMessageTime = msg.timestamp;
    _writeChats(chats);

    // Increment driver-side unread counter
    try {
      const unread = JSON.parse(localStorage.getItem(UNREAD_KEY) || '{}');
      unread[_activeOrderId] = (unread[_activeOrderId] || 0) + 1;
      localStorage.setItem(UNREAD_KEY, JSON.stringify(unread));
    } catch (_) { /* ignore */ }
  }

  /** Return all messages (both sides) for the active order */
  function getHistory() {
    if (!_activeOrderId) return [];
    const chats = _readChats();
    return (chats[_activeOrderId] && chats[_activeOrderId].messages) || [];
  }

  return { init, sendTextMessage, sendImageMessage, getHistory };
})();
