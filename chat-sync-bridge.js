/* =============================================
   RideFlow — Chat Sync Bridge (Customer Side)
   Loaded in index.html to sync messages with
   the driver dashboard via localStorage.
============================================= */

'use strict';

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
