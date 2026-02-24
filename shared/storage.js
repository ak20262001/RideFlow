/* =============================================
   RideFlow — Storage Module
   Abstraction layer for localStorage operations
   with validation, error handling, and migration
============================================= */

'use strict';

const Storage = (() => {
  // ── Internal helpers ──────────────────────

  function _safeGet(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function _safeSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[Storage] Write failed for key:', key, e);
      return false;
    }
  }

  function _safeRemove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('[Storage] Remove failed for key:', key, e);
      return false;
    }
  }

  // ── Chats ─────────────────────────────────

  function getChats() {
    return _safeGet('rideflow-chats') || {};
  }

  function setChats(chats) {
    return _safeSet('rideflow-chats', chats);
  }

  function getMessages(orderId) {
    const chats = getChats();
    return (chats[orderId] && chats[orderId].messages) || [];
  }

  function addMessage(orderId, msg) {
    const chats = getChats();
    if (!chats[orderId]) {
      chats[orderId] = {
        orderId,
        messages: [],
        createdAt: new Date().toISOString(),
        lastMessageTime: new Date().toISOString(),
      };
    }
    // Deduplicate by ID
    const exists = chats[orderId].messages.some(m => m.id === msg.id);
    if (!exists) {
      chats[orderId].messages.push(msg);
      chats[orderId].lastMessageTime = msg.timestamp;
      return setChats(chats);
    }
    return false;
  }

  // ── Unread counts ─────────────────────────

  function getUnread() {
    return _safeGet('rideflow-unread-messages') || {};
  }

  function setUnread(unread) {
    return _safeSet('rideflow-unread-messages', unread);
  }

  function incrementUnread(orderId) {
    const unread = getUnread();
    unread[orderId] = (unread[orderId] || 0) + 1;
    return setUnread(unread);
  }

  function clearUnread(orderId) {
    const unread = getUnread();
    delete unread[orderId];
    return setUnread(unread);
  }

  function getUnreadCount(orderId) {
    return getUnread()[orderId] || 0;
  }

  // ── Driver location ───────────────────────

  function getDriverLocation() {
    return _safeGet('rideflow-driver-location');
  }

  function setDriverLocation(location) {
    return _safeSet('rideflow-driver-location', {
      ...location,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Customer location ─────────────────────

  function getCustomerLocation() {
    return _safeGet('rideflow-customer-location');
  }

  function setCustomerLocation(location) {
    return _safeSet('rideflow-customer-location', {
      ...location,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Saved locations ───────────────────────

  function getSavedLocations() {
    return _safeGet('rideflow-saved-locations') || [];
  }

  function setSavedLocations(locations) {
    return _safeSet('rideflow-saved-locations', locations);
  }

  // ── Orders ────────────────────────────────

  function getOrders() {
    return _safeGet('rideflow-orders') || [];
  }

  function setOrders(orders) {
    return _safeSet('rideflow-orders', orders);
  }

  // ── Generic key-value ─────────────────────

  function get(key) {
    return _safeGet(key);
  }

  function set(key, value) {
    return _safeSet(key, value);
  }

  function remove(key) {
    return _safeRemove(key);
  }

  // ── Data migration ────────────────────────

  /**
   * Migrate any legacy keys to current naming convention.
   * Add new migrations here as needed.
   */
  function migrate() {
    // No migrations needed for initial version
  }

  return {
    // Chats
    getChats, setChats, getMessages, addMessage,
    // Unread
    getUnread, setUnread, incrementUnread, clearUnread, getUnreadCount,
    // Locations
    getDriverLocation, setDriverLocation,
    getCustomerLocation, setCustomerLocation,
    // Saved locations
    getSavedLocations, setSavedLocations,
    // Orders
    getOrders, setOrders,
    // Generic
    get, set, remove,
    // Migration
    migrate,
  };
})();
