/* =============================================
   RideFlow — Driver Chat Sync
   Bi-directional messaging via localStorage
============================================= */

'use strict';

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
   * Initialize the sync system for a given order.
   * @param {string} orderId
   * @param {Function} onNewMessage  Called with new message objects from the other party
   */
  function init(orderId, onNewMessage) {
    _onNewMessage = onNewMessage;

    // Record the latest timestamp we've seen so far
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
   */
  function sendMessage(orderId, msg) {
    const chats  = _readChats();
    if (!chats[orderId]) {
      chats[orderId] = {
        orderId,
        messages: [],
        createdAt: new Date().toISOString(),
        lastMessageTime: new Date().toISOString(),
      };
    }

    // Deduplicate – don't re-add if already there
    const exists = chats[orderId].messages.some(m => m.id === msg.id);
    if (!exists) {
      chats[orderId].messages.push(msg);
      chats[orderId].lastMessageTime = msg.timestamp;
    }

    _writeChats(chats);

    // Update unread count for the opposite side
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
