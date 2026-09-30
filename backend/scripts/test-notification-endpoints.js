require('dotenv').config();
const axios = require('axios');

const API_URL = 'http://localhost:5000';

async function testNotifications() {
  try {
    console.log('[TEST] Logging in as admin...\n');
    
    // Login as admin
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'yasir@gmail.com',
      password: 'password123' // Use the actual migrated password
    });
    
    const token = loginResponse.data.data.token;
    console.log('[TEST] Login successful');
    console.log('[TEST] Testing unread count endpoint...\n');
    
    // Test unread count
    const unreadResponse = await axios.get(`${API_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('[TEST] Unread count response:', JSON.stringify(unreadResponse.data, null, 2));
    console.log('[TEST] Status:', unreadResponse.status);
    
    console.log('\n[TEST] Testing notifications list endpoint...\n');
    
    // Test notifications list
    const notificationsResponse = await axios.get(`${API_URL}/api/notifications?limit=15`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('[TEST] Notifications response:', JSON.stringify(notificationsResponse.data, null, 2));
    console.log('[TEST] Status:', notificationsResponse.status);
    
    console.log('\n[TEST] Both endpoints working correctly!');
    process.exit(0);
    
  } catch (error) {
    console.error('[TEST] Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

testNotifications();
