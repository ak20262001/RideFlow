/* =============================================
   RideFlow — Shared Constants & Configuration
============================================= */

'use strict';

const CONSTANTS = {
  ORDER_STATUS: {
    PENDING:   'pending',
    ACCEPTED:  'accepted',
    ACTIVE:    'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    SEARCHING: 'searching',
    DRIVER_FOUND: 'driver_found',
    EN_ROUTE:  'en_route',
    INCOMING:  'incoming',
    DECLINED:  'declined',
  },

  SERVICE_TYPE: {
    RIDE:     'ride',
    DELIVERY: 'delivery',
    FOOD:     'food',
  },

  VEHICLE_TYPE: {
    CAR:        'car',
    MOTORCYCLE: 'motorcycle',
  },

  TARIFF: {
    STANDARD: 'standard',
    ECONOMY:  'economy',
    PREMIUM:  'premium',
    PRIORITY: 'priority',
  },

  MESSAGE_TYPE: {
    TEXT:  'text',
    IMAGE: 'image',
  },

  SENDER: {
    CUSTOMER: 'customer',
    DRIVER:   'driver',
    SYSTEM:   'system',
  },

  COLORS: {
    PRIMARY:   '#6ee7b7',
    SECONDARY: '#3b82f6',
    SUCCESS:   '#22c55e',
    WARNING:   '#f59e0b',
    DANGER:    '#ef4444',
    NEUTRAL:   '#52525e',
  },

  STORAGE_KEYS: {
    CHATS:           'rideflow-chats',
    UNREAD:          'rideflow-unread-messages',
    DRIVER_LOCATION: 'rideflow-driver-location',
    CUSTOMER_LOCATION: 'rideflow-customer-location',
    SAVED_LOCATIONS: 'rideflow-saved-locations',
    ORDERS:          'rideflow-orders',
    CURRENT_USER:    'rideflow-current-user',
  },

  AUTH: {
    CUSTOMER_DOMAIN: '@customer.mail',
    DRIVER_DOMAIN:   '@driver.mail',
  },

  PLATFORM_FEE_RATE: 0.20,  // 20% platform commission

  DEFAULT_LOCATION: {
    latitude:  -6.2088,
    longitude: 106.8456,
    label:     'Jakarta',
  },
};
