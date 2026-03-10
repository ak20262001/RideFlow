// shared-config.js

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Utility functions for order matching
function matchOrders(orderId) {
    // Implement order matching logic here
}

// Utility functions for live chat
function sendMessage(chatId, message) {
    // Implement send message logic here
}

function receiveMessages(chatId) {
    // Implement receive messages logic here
}

export { matchOrders, sendMessage, receiveMessages };