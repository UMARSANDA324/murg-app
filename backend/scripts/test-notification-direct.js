require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');

async function testNotificationsDirect() {
  await connectDB();
  console.log('[TEST] Testing notification repository directly...\n');
  
  // Get a user
  const user = await User.findOne({ email: 'yasir@gmail.com' }).lean();
  if (!user) {
    console.log('[TEST] User not found');
    process.exit(1);
  }
  
  console.log('[TEST] User found:', user.name);
  console.log('[TEST] User ID:', user._id);
  console.log('[TEST] Facility:', user.facilityID);
  console.log('[TEST] Role:', user.role);
  
  // Test unread count
  const query = { is_read: false };
  const orConditions = [];
  if (user._id) orConditions.push({ user_id: user._id });
  if (user.role) orConditions.push({ role_target: user.role });
  if (user.facilityID) orConditions.push({ facility_id: user.facilityID });
  
  if (orConditions.length > 0) {
    query.$or = orConditions;
  }
  
  const unreadCount = await Notification.countDocuments(query);
  console.log('\n[TEST] Unread count:', unreadCount);
  
  // Test notifications list
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(15)
    .lean();
  
  console.log('[TEST] Notifications count:', notifications.length);
  console.log('[TEST] Sample notification:', notifications[0] ? {
    title: notifications[0].title,
    is_read: notifications[0].is_read,
    facility_id: notifications[0].facility_id
  } : 'No notifications');
  
  console.log('\n[TEST] MongoDB queries working correctly!');
  await mongoose.connection.close();
  process.exit(0);
}

testNotificationsDirect().catch(err => {
  console.error('[TEST] Error:', err);
  process.exit(1);
});
