# RideFlow 🚗

> Multi-service ride-sharing platform with real-time chat, live location tracking, and multi-driver system built with vanilla HTML, CSS, and JavaScript.

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Technology Stack](#-technology-stack)
- [Installation & Setup](#-installation--setup)
- [How to Use](#-how-to-use)
- [Project Structure](#-project-structure)
- [Features](#-features)
- [API Reference](#-api-reference)
- [Testing Guide](#-testing-guide)
- [Troubleshooting](#-troubleshooting)
- [Customer vs Driver Features](#-customer-vs-driver-features)
- [Performance & Browser Support](#-performance--browser-support)
- [Future Enhancements](#-future-enhancements)
- [Contributing](#-contributing)
- [License](#-license)
- [Credits](#-credits)
- [Support & Contact](#-support--contact)

---

## 🚀 Project Overview

RideFlow is a modern, full-featured ride-sharing and delivery platform built with vanilla HTML, CSS, and JavaScript. It enables customers to order rides, food delivery, and package delivery while allowing drivers to offer multiple services through an intuitive, real-time interface.

### Core Features
- **Real-Time Chat**: Instant bi-directional messaging between customers and drivers with user identification
- **Live Location Tracking**: GPS-enabled driver location with interactive Leaflet.js maps
- **Multi-Service System**: Support for Ride, Package, and Food services
- **Multiple Concurrent Orders**: Customers can have multiple active orders with different drivers
- **Image Sharing**: Share photos directly in chat bubbles
- **Chat Management**: Delete chat history with real-time sync across both platforms
- **Earnings Tracking**: Real-time earnings dashboard for drivers
- **Guest Mode**: Test without creating an account

---

## ⚡ Quick Start

### Fastest Setup (< 1 minute)
```bash
cd RideFlow
python -m http.server 8000
```
Then open: http://localhost:8000

### Login Credentials for Testing
```
Customer:
- Email: budi@customer.mail
- Password: (any, not validated)

Driver:
- Email: ahmad@driver.mail
- Password: (any, not validated)

Or use Guest mode for both
```

### First Steps
1. Open login page
2. Select Customer or Driver
3. Enter email or choose Guest
4. Explore the dashboard
5. Create/accept orders
6. Test chat and location features

---

## 💻 Technology Stack

### Frontend
- **HTML5**: Semantic markup and templates
- **CSS3**: Custom properties (CSS variables), Flexbox, Grid, responsive design
- **Vanilla JavaScript (ES6+)**: No frameworks, lightweight and fast

### Libraries
- **Leaflet.js**: Interactive mapping and location visualization
- **OpenStreetMap**: Free tile provider for maps
- **FileReader API**: For image upload and Base64 encoding

### Data Management
- **localStorage**: Client-side data persistence
- **Session Storage**: Temporary session management

### Deployment
- **HTTP Server**: Python or Node.js for local development
- **Browser Support**: Chrome, Firefox, Safari, Edge (modern versions)

---

## 📦 Installation & Setup

### Prerequisites
- Modern web browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Python 3.6+ OR Node.js 14+ (for local development)
- Git (optional, for cloning)

### Method 1: Using Python (Recommended - Easiest)
1. Clone or download the repository
2. Open terminal/command prompt
3. Navigate to RideFlow folder:
   ```bash
   cd path/to/RideFlow
   ```
4. Run Python server:
   ```bash
   python -m http.server 8000
   ```
5. Open browser and go to:
   ```
   http://localhost:8000
   ```

### Method 2: Using Node.js HTTP Server
1. Install http-server globally:
   ```bash
   npm install -g http-server
   ```
2. Navigate to RideFlow folder:
   ```bash
   cd path/to/RideFlow
   ```
3. Run server:
   ```bash
   http-server
   ```
4. Open browser:
   ```
   http://localhost:8080
   ```

### Method 3: Using VS Code Live Server
1. Install VS Code extension: "Live Server" by Ritwick Dey
2. Open RideFlow folder in VS Code
3. Right-click index.html → "Open with Live Server"
4. Browser opens automatically at http://127.0.0.1:5500

### Method 4: Direct File Opening (Simple Testing)
- Simply double-click `index.html`
- Works in browser without server (limited functionality)

---

## 🎯 How to Use

### For Customers

#### Login/Register
1. Open http://localhost:8000
2. Click "Customer Login"
3. Enter email format: `yourusername@customer.mail` (e.g., budi@customer.mail)
4. OR click "Continue as Guest" to use without account
5. You'll see: "Welcome, Budi" (or "Welcome, Guest")

#### Create an Order
1. Click "Request New Order"
2. Select Service Type:
   - 🚗 Ride (motorcycle/car)
   - 📦 Package Delivery (motorcycle/car)
   - 🍔 Food Delivery (motorcycle/car)
3. Enter Pickup Location
4. Enter Destination
5. Click "View Available Drivers"
6. Select driver and vehicle type (Standard/Economy/Premium)
7. Confirm order

#### Chat with Driver
1. Click "Chat" on your active order
2. Type message or upload image
3. Driver receives in real-time
4. Driver replies instantly
5. Images share as preview in chat bubble

#### Track Driver
1. Click "View Location" on active order
2. Interactive map shows:
   - 🔵 Blue pin: Driver current location
   - 🔴 Red pin: Your location
   - 🟢 Green pin: Destination
3. Map updates every 10 seconds

#### Delete Chat History
1. Open chat for order
2. Click "🗑️ Delete Chat History"
3. Confirm deletion
4. Messages deleted for both customer AND driver instantly

### For Drivers

#### Login/Register
1. Open http://localhost:8000
2. Click "Driver Login"
3. Enter email format: `yourusername@driver.mail` (e.g., ahmad@driver.mail)
4. OR click "Continue as Guest"
5. You'll see: "Hello, Ahmad" (or "Hello, Guest")

#### Configure Services
1. Click "⚙️ Service Configuration"
2. Toggle which services to offer:
   - ☑ Ride (Motorcycle/Car)
   - ☑ Package Delivery (Motorcycle/Car)
   - ☐ Food Delivery (Motorcycle/Car)
3. Save configuration
4. Only orders for enabled services appear

#### Accept Orders
1. View "Incoming Orders" section
2. See customer info, locations, estimated fare
3. Click "Accept" to take the order
4. Status changes: 🟡 Pending → 🟢 Active

#### Chat with Customer
1. Click "Chat" on active order
2. Instant bi-directional messaging
3. Share vehicle photo, location updates, etc.
4. Customer receives in real-time

#### Track Earnings
1. View "Today's Earnings" dashboard:
   - Total earnings
   - Breakdown by service (Ride/Package/Food)
   - Completed orders count
   - Your rating
2. Earnings update automatically per completed order

#### Complete Order
1. Arrive at destination
2. Click "Complete Order"
3. Earnings calculated and added to total
4. Order moves to history

### Real-Time Features in Action

#### Example: Real-Time Chat Sync
```
TAB 1 (Customer Budi):
- Types: "Berapa ETA?"
- Sends message

TAB 2 (Driver Ahmad):
- INSTANTLY sees: "Budi (10:30): Berapa ETA?"
- Replies: "5 menit lagi"

TAB 1 (Customer Budi):
- INSTANTLY sees: "Ahmad (10:31): 5 menit lagi"
```

#### Example: Image Sharing
```
Driver clicks upload → selects vehicle photo
→ Encodes to Base64 → Sends

Customer instantly sees vehicle photo preview in chat
```

#### Example: Chat Deletion Sync
```
Driver clicks delete chat → confirms →
→ Messages removed from localStorage →
→ Storage event fires →
→ Customer's chat also becomes empty INSTANTLY
```

---

## 📁 Project Structure

```
RideFlow/
├── index.html                    # Login entry point
├── README.md                     # This file
│
├── shared/
│   ├── theme.css                # Unified theme for entire app
│   ├── api.js                   # Unified API interface
│   ├── auth.js                  # Authentication logic
│   ├── storage.js               # LocalStorage management
│   ├── chat-sync.js             # Real-time chat system
│   ├── constants.js             # Shared constants
│   ├── utils.js                 # Reusable utilities
│   └── components.js            # Reusable components
│
├── pages/
│   ├── login.html               # Login/Register page
│   ├── customer.html            # Customer dashboard
│   ├── driver.html              # Driver dashboard
│   └── app.js                   # Unified application logic
│
└── assets/
    └── icons/                   # SVG icons (optional)
```

### Key Architecture Decisions
- **Single Unified Theme**: `shared/theme.css` ensures consistent styling
- **Unified App Logic**: `pages/app.js` handles both customer and driver
- **No Frameworks**: Pure vanilla JavaScript for lightweight, fast performance
- **LocalStorage Only**: No backend required, perfect for demo/prototype
- **Real-Time via Events**: localStorage events for message sync

---

## ✨ Features

### Authentication System
- ✅ Email-based login (customer@customer.mail, driver@driver.mail)
- ✅ Guest mode for both customer and driver
- ✅ Session management with user identification
- ✅ Logout functionality
- ✅ Persistent login across page refresh

### Customer Features
- ✅ Multiple service selection (Ride, Package, Food)
- ✅ View available drivers with ratings
- ✅ Create orders with vehicle type and tariff selection
- ✅ Multiple concurrent orders with different drivers
- ✅ Real-time driver location on interactive map
- ✅ Order tracking and status updates
- ✅ Driver rating and review system
- ✅ Order history with details

### Driver Features
- ✅ Service configuration (enable/disable services)
- ✅ Incoming order queue with customer info
- ✅ Accept/decline order functionality
- ✅ Multiple concurrent orders management
- ✅ Real-time earnings dashboard
- ✅ Service-specific earning breakdowns
- ✅ Driver rating display
- ✅ Online/Offline status toggle
- ✅ Order history and statistics

### Chat System
- ✅ Real-time bi-directional messaging
- ✅ User identification by name (Budi, Ahmad, Guest)
- ✅ Message timestamps
- ✅ Image/file sharing with preview
- ✅ Base64 encoding for images
- ✅ Message persistence in localStorage
- ✅ Chat history management
- ✅ Delete chat with real-time sync
- ✅ Unread message indicators

### Location & Map
- ✅ Geolocation API integration
- ✅ Real-time driver location updates (every 10 seconds)
- ✅ Interactive Leaflet.js map
- ✅ Marker visualization (Driver/Customer/Destination)
- ✅ Route polyline
- ✅ Zoom and pan controls
- ✅ Map attribution
- ✅ Permission handling (allow/deny)

### Service System
- ✅ Ride Service (Motorcycle/Car)
- ✅ Package Delivery (Motorcycle/Car)
- ✅ Food Delivery (Motorcycle/Car)
- ✅ Three tariff tiers (Standard/Economy/Premium)
- ✅ Dynamic pricing per service and vehicle
- ✅ Driver service configuration
- ✅ Order filtering by service type

---

## 🔌 API Reference

The application uses a unified API interface for both customer and driver interfaces.

### Authentication API
```javascript
API.Auth.login(email, password)         // Login with email
API.Auth.loginAsGuest()                 // Login as guest
API.Auth.logout()                       // Logout
API.Auth.getCurrentUser()               // Get current user
```

### Orders API
```javascript
API.Orders.getActive()                  // Get active orders
API.Orders.getAvailableDrivers(serviceType)  // Get available drivers
API.Orders.createOrder(details)         // Create new order
API.Orders.acceptOrder(orderId)         // Accept order (driver)
API.Orders.declineOrder(orderId)        // Decline order (driver)
API.Orders.completeOrder(orderId)       // Complete order (driver)
API.Orders.getOrderDetails(orderId)     // Get order info
```

### Chat API
```javascript
API.Chat.sendMessage(orderId, message)  // Send text or image
API.Chat.getMessages(orderId)           // Get chat history
API.Chat.deleteHistory(orderId)         // Delete all messages
API.Chat.markAsRead(messageId)          // Mark message as read
API.Chat.subscribeToMessages(orderId, callback)  // Listen for new messages
```

### Location API
```javascript
API.Location.updateDriverLocation(lat, lng)     // Update driver position
API.Location.getDriverLocation(orderId)         // Get current location
API.Location.subscribeToLocation(orderId, callback)  // Real-time location
```

### Driver API
```javascript
API.Driver.updateServices(serviceList)  // Configure services
API.Driver.getEarnings()                // Get today's earnings
API.Driver.getStats()                   // Get statistics
API.Driver.updateStatus(status)         // Online/Offline/Break
```

---

## 🧪 Testing Guide

### Setup 2-Tab Testing
1. Open two browser tabs/windows
2. Tab 1: http://localhost:8000 (Customer)
3. Tab 2: http://localhost:8000 (Driver)

### Test Scenarios

#### Scenario 1: Basic Order Flow
```
1. Tab 1 - Customer Login:
   - Email: budi@customer.mail
   - Click Login

2. Tab 1 - Create Order:
   - Select Service: Ride
   - Pickup: Senayan, Jakarta
   - Destination: Blok M, Jakarta
   - Select Driver: Ahmad
   - Vehicle: Motorcycle Standard
   - Confirm

3. Tab 2 - Driver Login:
   - Email: ahmad@driver.mail
   - Click Login

4. Tab 2 - See Incoming Order:
   - View new order from Budi
   - Click Accept

5. Tab 1 - See Status Update:
   - Status changes to 🟢 Active

✓ TEST PASSED
```

#### Scenario 2: Real-Time Chat
```
1. Tab 1 - Customer sends:
   - "Berapa ETA?"

2. Tab 2 - Driver sees:
   - "Budi (10:30): Berapa ETA?"

3. Tab 2 - Driver replies:
   - "5 menit"

4. Tab 1 - Customer sees:
   - "Ahmad (10:31): 5 menit"

✓ TEST PASSED
```

#### Scenario 3: Image Sharing
```
1. Tab 1 - Customer uploads image
2. Tab 2 - Driver sees image instantly
3. Tab 2 - Driver uploads image
4. Tab 1 - Customer sees image instantly

✓ TEST PASSED
```

#### Scenario 4: Chat Deletion
```
1. Tab 1 - Click "Delete Chat History"
2. Tab 1 - Confirm deletion
3. Tab 2 - Chat becomes empty INSTANTLY

✓ TEST PASSED
```

### Quick Test Checklist
- [ ] Login as customer
- [ ] Login as driver
- [ ] Create ride order
- [ ] Accept order
- [ ] Send text message
- [ ] Upload image
- [ ] View location on map
- [ ] Delete chat history
- [ ] Complete order
- [ ] Check earnings

---

## 🔧 Troubleshooting

### Issue: "Port already in use"
**Solution:**
```bash
# Find process on port 8000
lsof -i :8000           # macOS/Linux
netstat -ano | grep :8000  # Windows

# Kill process
kill -9 <PID>           # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Use different port
python -m http.server 9000
```

### Issue: Messages not syncing
**Solution:**
1. Verify both tabs have same origin (localhost:8000)
2. Check browser console (F12) for errors
3. Clear localStorage: `localStorage.clear()`
4. Refresh both tabs

### Issue: localStorage not available
**Solution:**
- Do NOT use `file://` protocol
- Must use `http://` or `https://`
- Use localhost server (Python/Node.js/Live Server)

### Issue: Location not showing
**Solution:**
1. Click "Allow" when browser asks for permission
2. Check device location services enabled
3. Try different browser
4. Check console for geolocation errors

### Issue: Images not uploading
**Solution:**
1. File size < 5MB
2. Format: jpg, png, gif, webp
3. Check browser console for errors
4. Refresh page and try again

### Issue: Styling looks wrong
**Solution:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Check DevTools → Network tab for failed CSS files
4. Verify all files present in correct directories

---

## 📊 Customer vs Driver Features

| Feature | Customer | Driver |
|---------|----------|--------|
| Real-Time Chat | ✅ | ✅ |
| Image Sharing | ✅ | ✅ |
| Location Tracking | ✅ View | ✅ Share |
| Multiple Orders | ✅ | ✅ |
| Service Selection | ✅ Choose | ✅ Configure |
| Earnings Tracking | - | ✅ |
| Rating System | ✅ Rate Driver | ✅ Get Rated |
| Order History | ✅ | ✅ |
| Chat Deletion | ✅ | ✅ |
| Guest Mode | ✅ | ✅ |

---

## 🚀 Performance & Browser Support

### Browser Compatibility
| Browser | Support | Version |
|---------|---------|---------|
| Chrome | ✅ Full | 90+ |
| Firefox | ✅ Full | 88+ |
| Safari | ✅ Full | 14+ |
| Edge | ✅ Full | 90+ |
| Mobile Chrome | ✅ Full | Recent |
| Mobile Safari | ✅ Full | Recent |

### Performance Metrics
- Initial Load: < 2 seconds
- Chat Message Delivery: < 100ms
- Location Update: Every 10 seconds
- Image Upload: < 1 second
- Page Size: ~400KB (all assets)

### Storage Requirements
- localStorage usage: ~5-10MB per active session
- No server-side storage required
- Data clears on localStorage.clear()

---

## 🔮 Future Enhancements

### Planned Features
- [ ] Backend API integration (Node.js/Express)
- [ ] Database storage (MongoDB/PostgreSQL)
- [ ] Push notifications
- [ ] Video call feature
- [ ] Advanced analytics dashboard
- [ ] AI-powered driver matching
- [ ] Payment gateway integration
- [ ] Offline mode with service worker
- [ ] Mobile app (React Native/Flutter)
- [ ] Admin dashboard

### Potential Improvements
- [ ] WebSocket for true real-time sync (vs localStorage)
- [ ] User profile customization
- [ ] Advanced filtering and search
- [ ] Driver availability scheduling
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Accessibility improvements (WCAG compliance)

---

## 🤝 Contributing

We welcome contributions! To contribute:

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open Pull Request

### Development Guidelines
- Follow existing code style
- Maintain DRY principles
- Use semantic HTML
- Ensure CSS/JS optimization
- Test on multiple browsers
- Update README if needed

---

## 📄 License

This project is open source and available under the MIT License.

---

## 👏 Credits

### Technologies Used
- [Leaflet.js](https://leafletjs.com/) - Interactive maps
- [OpenStreetMap](https://www.openstreetmap.org/) - Map tiles
- [MDN Web Docs](https://developer.mozilla.org/) - Documentation
- [Can I Use](https://caniuse.com/) - Browser compatibility

### Authors
- **Alfairaz Putra Anantar** ([@AlfairazAnantar](https://github.com/AlfairazAnantar)) - alfairaz.anantar@student.president.ac.id
- **Keefi Almer Firdaus** ([@KeefiFirdaus](https://github.com/KeefiFirdaus)) - keefi.firdaus@student.president.ac.id

### Contributors
- Open for community contributions

### Special Thanks
- All testers and users providing feedback

---

## 📞 Support & Contact

### Getting Help
- Check Troubleshooting section above
- Review test scenarios in Testing Guide
- Check browser console (F12 → Console tab)
- Review localStorage data (F12 → Application/Storage tab)

### Reporting Issues
- Describe the problem clearly
- Include browser and OS information
- Provide steps to reproduce
- Share console error messages
- Mention if issue happens in all browsers

### Contact & Support
- **Project Email**: ak20262001@gmail.com
- **GitHub Organization**: [@ak20262001](https://github.com/ak20262001)

This is a collaborative project developed by both Alfairaz and Keefi as part of their studies at President University.
