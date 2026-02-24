/* =============================================
   RideFlow — Unified API Interface
   Abstracts localStorage operations and provides
   a consistent interface for both Customer and Driver
============================================= */

'use strict';

const API = (() => {
  // ── Orders ────────────────────────────────

  const Orders = {
    /**
     * Get all orders from local storage.
     * @returns {Array} list of order objects
     */
    getAll() {
      return Storage.getOrders();
    },

    /**
     * Get active (non-completed, non-cancelled) orders.
     * @returns {Array}
     */
    getActive() {
      return Storage.getOrders().filter(o =>
        o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined'
      );
    },

    /**
     * Get a single order by ID.
     * @param {string} orderId
     * @returns {Object|null}
     */
    getById(orderId) {
      return Storage.getOrders().find(o => o.id === orderId) || null;
    },

    /**
     * Save a new order (or replace existing by ID).
     * @param {Object} orderData
     * @returns {string} order ID
     */
    save(orderData) {
      const orders = Storage.getOrders();
      const id = orderData.id || 'order-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      const order = { ...orderData, id, createdAt: orderData.createdAt || new Date().toISOString() };
      const idx = orders.findIndex(o => o.id === id);
      if (idx >= 0) {
        orders[idx] = order;
      } else {
        orders.unshift(order);
      }
      Storage.setOrders(orders);
      return id;
    },

    /**
     * Update the status (and optional extra fields) of an order.
     * @param {string} orderId
     * @param {string} status
     * @param {Object} [extra]
     */
    updateStatus(orderId, status, extra = {}) {
      const orders = Storage.getOrders().map(o =>
        o.id === orderId ? { ...o, status, ...extra } : o
      );
      Storage.setOrders(orders);
    },

    /**
     * Driver accepts an order.
     * @param {string} orderId
     */
    accept(orderId) {
      this.updateStatus(orderId, 'accepted', { acceptedAt: new Date().toISOString() });
    },

    /**
     * Driver declines an order.
     * @param {string} orderId
     */
    decline(orderId) {
      this.updateStatus(orderId, 'declined');
    },

    /**
     * Mark order as completed.
     * @param {string} orderId
     * @param {Object} [extra]
     */
    complete(orderId, extra = {}) {
      this.updateStatus(orderId, 'completed', { completedAt: new Date().toISOString(), ...extra });
    },

    /**
     * Cancel an order.
     * @param {string} orderId
     */
    cancel(orderId) {
      this.updateStatus(orderId, 'cancelled');
    },
  };

  // ── Chat ──────────────────────────────────

  const Chat = {
    /**
     * Send a message (text or image) for an order.
     * @param {string} orderId
     * @param {Object} messageData  - must include sender, type, content
     * @returns {string} message ID
     */
    sendMessage(orderId, messageData) {
      const id = messageData.id || 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const msg = {
        ...messageData,
        id,
        orderId,
        timestamp: messageData.timestamp || new Date().toISOString(),
        read:      messageData.read !== undefined ? messageData.read : false,
      };
      Storage.addMessage(orderId, msg);
      // Increment unread counter for the opposite side
      if (messageData.sender === 'customer') {
        Storage.incrementUnread(orderId);
      }
      return id;
    },

    /**
     * Get all messages for a given order.
     * @param {string} orderId
     * @returns {Array}
     */
    getMessages(orderId) {
      return Storage.getMessages(orderId);
    },

    /**
     * Mark all messages for an order as read (clears unread badge).
     * @param {string} orderId
     */
    markAllRead(orderId) {
      Storage.clearUnread(orderId);
    },

    /**
     * Get unread message count for a given order.
     * @param {string} orderId
     * @returns {number}
     */
    getUnreadCount(orderId) {
      return Storage.getUnreadCount(orderId);
    },
  };

  // ── Location ──────────────────────────────

  const Location = {
    /**
     * Get the last known driver location from storage.
     * @returns {Object|null}
     */
    getDriverLocation() {
      return Storage.getDriverLocation();
    },

    /**
     * Update the driver's current location.
     * @param {number} latitude
     * @param {number} longitude
     * @param {Object} [extra]  e.g. { accuracy, heading }
     */
    updateDriverLocation(latitude, longitude, extra = {}) {
      Storage.setDriverLocation({
        driverId:  'drv_001',
        latitude,
        longitude,
        ...extra,
      });
    },

    /**
     * Get the customer's last known location.
     * @returns {Object|null}
     */
    getCustomerLocation() {
      return Storage.getCustomerLocation();
    },

    /**
     * Update the customer's location.
     * @param {number} latitude
     * @param {number} longitude
     */
    updateCustomerLocation(latitude, longitude) {
      Storage.setCustomerLocation({ latitude, longitude });
    },

    /**
     * Get map data (driver + customer locations) for an order.
     * @param {string} orderId
     * @returns {Object}
     */
    getMapData(orderId) {
      return {
        driverLocation:   Storage.getDriverLocation(),
        customerLocation: Storage.getCustomerLocation(),
      };
    },
  };

  // ── Driver ────────────────────────────────

  const Driver = {
    /**
     * Get today's earnings summary.
     * @param {string} driverId
     * @returns {Object}
     */
    getEarnings(driverId) {
      const key = 'rideflow-earnings-' + (driverId || 'drv_001');
      return Storage.get(key) || {
        driverId: driverId || 'drv_001',
        date: new Date().toISOString().slice(0, 10),
        totalEarnings: 0,
        completedTrips: 0,
        averageRating: 0,
        breakdown: { rideEarnings: 0, deliveryEarnings: 0, foodEarnings: 0 },
      };
    },

    /**
     * Update earnings after a completed trip.
     * @param {string} driverId
     * @param {number} amount
     * @param {string} serviceType
     */
    addEarning(driverId, amount, serviceType) {
      const key = 'rideflow-earnings-' + (driverId || 'drv_001');
      const earnings = this.getEarnings(driverId);
      earnings.totalEarnings += amount;
      earnings.completedTrips += 1;
      const earningKey = (serviceType || 'ride') + 'Earnings';
      if (earnings.breakdown[earningKey] !== undefined) {
        earnings.breakdown[earningKey] += amount;
      }
      Storage.set(key, earnings);
    },

    /**
     * Get driver statistics (accept rate, completion rate, etc.).
     * @param {string} driverId
     * @returns {Object}
     */
    getStats(driverId) {
      const key = 'rideflow-stats-' + (driverId || 'drv_001');
      return Storage.get(key) || {
        driverId:        driverId || 'drv_001',
        acceptRate:      95,
        completionRate:  98,
        totalTrips:      247,
        averageRating:   4.92,
      };
    },
  };

  // ── User ──────────────────────────────────

  const User = {
    /**
     * Get the current user profile.
     * @returns {Object|null}
     */
    getProfile() {
      return window._currentUser || Storage.get('rideflow-user-profile');
    },

    /**
     * Save user profile to local storage.
     * @param {Object} profile
     */
    saveProfile(profile) {
      window._currentUser = profile;
      Storage.set('rideflow-user-profile', profile);
    },
  };

  return { Orders, Chat, Location, Driver, User };
})();
