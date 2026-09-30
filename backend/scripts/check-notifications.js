require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const Notification = require('../src/models/Notification');

async function checkNotifications() {
  await connectDB();
  console.log('[CHECK] Inspecting migrated notification data...\n');
  
  const count = await Notification.countDocuments();
  console.log(`Total notifications: ${count}\n`);
  
  if (count === 0) {
    console.log('No notifications found - endpoints should return empty results');
    await mongoose.connection.close();
    process.exit(0);
  }
  
  const notifications = await Notification.find({}).limit(3).lean();
  console.log('Sample notification documents:\n');
  
  for (const notif of notifications) {
    console.log(`Notification ID: ${notif._id}`);
    console.log(`  mysqlId: ${notif.mysqlId}`);
    console.log(`  user_id: ${notif.user_id}`);
    console.log(`  role_target: ${notif.role_target}`);
    console.log(`  facility_id: ${notif.facility_id}`);
    console.log(`  title: ${notif.title}`);
    console.log(`  message: ${notif.message}`);
    console.log(`  type: ${notif.type}`);
    console.log(`  is_read: ${notif.is_read}`);
    console.log(`  createdAt: ${notif.createdAt}`);
    console.log('');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

checkNotifications().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
