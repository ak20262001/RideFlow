const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory stores
const users = new Map(); // uid -> {type: 'customer'|'driver', name, email, ws, ...}
const orders = new Map(); // orderId -> {id, customerId, driverId, status, ...}
const messages = new Map(); // orderId -> [{sender, text, time}, ...]
const activeSearches = new Map(); // customerId -> {orderId, booking details}

// Helper: Broadcast to specific user
function sendToUser(uid, data) {
  const user = users.get(uid);
  if (user && user.ws && user.ws.readyState === WebSocket.OPEN) {
    user.ws.send(JSON.stringify(data));
  }
}

// Helper: Broadcast to all online drivers
function broadcastToDrivers(data, exceptUid = null) {
  users.forEach((user) => {
    if (user.type === 'driver' && user.uid !== exceptUid) {
      if (user.ws && user.ws.readyState === WebSocket.OPEN) {
        user.ws.send(JSON.stringify(data));
      }
    }
  });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData);
      
      switch (data.type) {
        case 'auth':
          handleAuth(ws, data);
          break;
        case 'book_ride':
          handleBookRide(ws, data);
          break;
        case 'accept_order':
          handleAcceptOrder(ws, data);
          break;
        case 'decline_order':
          handleDeclineOrder(ws, data);
          break;
        case 'cancel_order':
          handleCancelOrder(ws, data);
          break;
        case 'send_message':
          handleSendMessage(ws, data);
          break;
        case 'start_trip':
          handleStartTrip(ws, data);
          break;
        case 'end_trip':
          handleEndTrip(ws, data);
          break;
        case 'update_location':
          handleUpdateLocation(ws, data);
          break;
        case 'get_messages':
          handleGetMessages(ws, data);
          break;
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  });

  ws.on('close', () => {
    users.forEach((user) => {
      if (user.ws === ws) {
        console.log(`${user.type} disconnected: ${user.name}`);
        users.delete(user.uid);
      }
    });
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

// Auth Handler
function handleAuth(ws, data) {
  const { uid, type, name, email, plate } = data;

  users.set(uid, {
    uid,
    type, // 'customer' or 'driver'
    name,
    email,
    plate: plate || '',
    ws,
    isOnline: type === 'customer' ? true : false,
    location: null,
  });

  ws.send(JSON.stringify({ type: 'auth_success', uid, name }));
  console.log(`${type} authenticated: ${name}`);

  if (type === 'driver') {
    broadcastToDrivers({
      type: 'driver_status_update',
      onlineCount: Array.from(users.values()).filter(u => u.type === 'driver' && u.isOnline).length,
    });
  }
}

// Book Ride Handler
function handleBookRide(ws, data) {
  const { customerId, pickup, destination, service, vehicle } = data;
  const customer = users.get(customerId);

  if (!customer || customer.type !== 'customer') {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid customer' }));
    return;
  }

  const orderId = 'order_' + Date.now();
  const order = {
    id: orderId,
    customerId,
    driverId: null,
    customerName: customer.name,
    customerEmail: customer.email,
    pickup,
    destination,
    service,
    vehicle,
    status: 'searching', // searching -> found -> accepted -> in_progress -> completed
    fare: Math.floor(Math.random() * 50000) + 30000,
    createdAt: new Date(),
  };

  orders.set(orderId, order);
  messages.set(orderId, []);
  activeSearches.set(customerId, orderId);

  // Notify customer
  sendToUser(customerId, {
    type: 'order_created',
    orderId,
    order,
  });

  // Broadcast to all online drivers
  const onlineDrivers = Array.from(users.values()).filter(
    u => u.type === 'driver' && u.isOnline
  );

  broadcastToDrivers({
    type: 'new_order_available',
    orderId,
    customerName: customer.name,
    pickup,
    destination,
    service,
    vehicle,
    fare: order.fare,
  });

  console.log(`Order created: ${orderId} - ${customer.name}`);
}

// Accept Order Handler
function handleAcceptOrder(ws, data) {
  const { driverId, orderId } = data;
  const order = orders.get(orderId);
  const driver = users.get(driverId);

  if (!order || !driver || order.driverId) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid order or driver' }));
    return;
  }

  order.driverId = driverId;
  order.status = 'accepted';

  // Notify customer
  sendToUser(order.customerId, {
    type: 'driver_found',
    orderId,
    driver: {
      uid: driver.uid,
      name: driver.name,
      plate: driver.plate,
      rating: 4.92,
    },
    order,
  });

  // Notify driver
  sendToUser(driverId, {
    type: 'order_accepted_confirmed',
    orderId,
    order,
    customer: {
      uid: order.customerId,
      name: order.customerName,
      email: order.customerEmail,
    },
  });

  // Remove from search
  activeSearches.delete(order.customerId);

  console.log(`Order ${orderId} accepted by driver ${driver.name}`);
}

// Decline Order Handler
function handleDeclineOrder(ws, data) {
  const { orderId } = data;
  const order = orders.get(orderId);

  if (order && order.status === 'searching') {
    // Keep order searching, notify other drivers
    broadcastToDrivers({
      type: 'new_order_available',
      orderId,
      customerName: order.customerName,
      pickup: order.pickup,
      destination: order.destination,
      service: order.service,
      vehicle: order.vehicle,
      fare: order.fare,
    });
  }
}

// Cancel Order Handler
function handleCancelOrder(ws, data) {
  const { customerId, orderId } = data;
  const order = orders.get(orderId);

  if (order && order.customerId === customerId) {
    order.status = 'cancelled';
    activeSearches.delete(customerId);

    if (order.driverId) {
      sendToUser(order.driverId, {
        type: 'order_cancelled',
        orderId,
      });
    }

    console.log(`Order ${orderId} cancelled by customer`);
  }
}

// Send Message Handler
function handleSendMessage(ws, data) {
  const { uid, orderId, text } = data;
  const order = orders.get(orderId);
  const sender = users.get(uid);

  if (!order || !sender) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid order or sender' }));
    return;
  }

  const message = {
    senderId: uid,
    senderName: sender.name,
    senderType: sender.type,
    text,
    timestamp: new Date().toISOString(),
  };

  const chatHistory = messages.get(orderId) || [];
  chatHistory.push(message);
  messages.set(orderId, chatHistory);

  // Send to customer
  if (order.customerId) {
    sendToUser(order.customerId, {
      type: 'new_message',
      orderId,
      message,
    });
  }

  // Send to driver
  if (order.driverId) {
    sendToUser(order.driverId, {
      type: 'new_message',
      orderId,
      message,
    });
  }

  console.log(`Message sent in order ${orderId} by ${sender.name}`);
}

// Start Trip Handler
function handleStartTrip(ws, data) {
  const { driverId, orderId } = data;
  const order = orders.get(orderId);

  if (order && order.driverId === driverId) {
    order.status = 'in_progress';

    sendToUser(order.customerId, {
      type: 'trip_started',
      orderId,
    });

    sendToUser(driverId, {
      type: 'trip_started_confirmed',
      orderId,
    });
  }
}

// End Trip Handler
function handleEndTrip(ws, data) {
  const { driverId, orderId } = data;
  const order = orders.get(orderId);

  if (order && order.driverId === driverId) {
    order.status = 'completed';

    sendToUser(order.customerId, {
      type: 'trip_completed',
      orderId,
      fare: order.fare,
    });

    sendToUser(driverId, {
      type: 'trip_completed_confirmed',
      orderId,
      fare: order.fare,
    });
  }
}

// Update Location Handler
function handleUpdateLocation(ws, data) {
  const { uid, lat, lng } = data;
  const user = users.get(uid);

  if (user) {
    user.location = { lat, lng };

    // If driver, update related order
    orders.forEach((order) => {
      if (order.driverId === uid && order.status !== 'completed') {
        sendToUser(order.customerId, {
          type: 'driver_location_updated',
          orderId: order.id,
          location: { lat, lng },
        });
      }
    });
  }
}

// Get Messages Handler
function handleGetMessages(ws, data) {
  const { orderId } = data;
  const chatHistory = messages.get(orderId) || [];

  ws.send(JSON.stringify({
    type: 'messages_history',
    orderId,
    messages: chatHistory,
  }));
}

// REST API endpoints
app.get('/api/orders', (req, res) => {
  res.json(Array.from(orders.values()));
});

app.get('/api/users', (req, res) => {
  const userList = Array.from(users.values()).map(u => ({
    uid: u.uid,
    type: u.type,
    name: u.name,
    email: u.email,
    isOnline: u.isOnline,
  }));
  res.json(userList);
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 RideFlow Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
});