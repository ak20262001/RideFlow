# RideFlow

RideFlow is a real-time ride-hailing web application with a customer dashboard and a driver dashboard that communicate via localStorage-based bi-directional chat sync.

## Repository Structure

```
RideFlow/
├── README.md
├── customer-dashboard/
│   ├── index.html          — Customer interface (booking, chat, history)
│   ├── styles.css          — All customer dashboard styles
│   └── app.js              — Customer application logic (Firebase + chat + booking)
├── driver-dashboard/
│   ├── index.html          — Driver interface (orders, messaging, map, earnings)
│   ├── styles.css          — All driver dashboard styles
│   └── app.js              — Driver application logic (orders + chat + map)
├── shared/
│   ├── constants.js        — Shared constants & configuration (ORDER_STATUS, VEHICLE_TYPE, etc.)
│   ├── storage.js          — localStorage abstraction layer
│   ├── api.js              — Unified API interface (API.Orders, API.Chat, API.Location, etc.)
│   └── chat-sync.js        — Bi-directional chat sync (ChatSync + ChatSyncBridge)
└── assets/
    └── icons/              — Shared icon assets
```

## Getting Started

1. Open `customer-dashboard/index.html` in Tab 1 (customer view)
2. Open `driver-dashboard/index.html` in Tab 2 (driver view)
3. Use the customer interface to book a ride
4. Accept or decline orders on the driver dashboard
5. Chat in real-time between both dashboards

## Features

- **Real-time bi-directional chat** via localStorage storage events
- **Image / file sharing** with Base64 encoding (up to 5 MB)
- **Live location tracking** with Leaflet.js and the Geolocation API
- **Order management** — Accept / Decline incoming orders
- **Service selection** — Vehicle type (Motorcycle / Car) and tariff tier
- **Earnings calculation** with platform fee breakdown (20%)
- **Message history** & persistence across page reloads
- **Responsive design** — Mobile, tablet, and desktop
- **Firebase authentication** (optional — falls back to guest mode)

## Shared API Reference

```javascript
// Orders
API.Orders.getActive()                    // Get active orders
API.Orders.accept(orderId)                // Driver accepts an order
API.Orders.decline(orderId)               // Driver declines an order
API.Orders.complete(orderId, extra)       // Mark order as completed

// Chat
API.Chat.sendMessage(orderId, messageData) // Send text or image message
API.Chat.getMessages(orderId)             // Get all messages for an order
API.Chat.markAllRead(orderId)             // Mark all messages as read
API.Chat.getUnreadCount(orderId)          // Get unread message count

// Location
API.Location.getDriverLocation()          // Get driver's last known location
API.Location.updateDriverLocation(lat, lng, extra) // Update driver location
API.Location.getMapData(orderId)          // Get route and location data

// Driver
API.Driver.getEarnings(driverId)          // Get today's earnings
API.Driver.getStats(driverId)             // Get driver statistics

// User
API.User.getProfile()                     // Get current user profile
```

## Shared Constants

```javascript
CONSTANTS.ORDER_STATUS   // pending, accepted, active, completed, cancelled, ...
CONSTANTS.SERVICE_TYPE   // ride, delivery, food
CONSTANTS.VEHICLE_TYPE   // car, motorcycle
CONSTANTS.TARIFF         // standard, economy, premium, priority
CONSTANTS.MESSAGE_TYPE   // text, image
CONSTANTS.COLORS         // Primary, Secondary, Success, Warning, Danger, Neutral
```

## Technology Stack

- **Vanilla JavaScript** (ES Modules for customer dashboard)
- **Leaflet.js** for interactive maps (driver dashboard)
- **OpenStreetMap** tiles
- **Firebase** (optional) for authentication and Firestore data persistence
- **localStorage** for offline-first cross-tab communication

