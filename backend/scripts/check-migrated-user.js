require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const User = require('../src/models/User');

async function checkMigratedUser() {
  await connectDB();
  console.log('[CHECK] Fetching migrated users from MongoDB...\n');
  
  const users = await User.find({}).select('-password -password_hash').lean();
  console.log(`[CHECK] Found ${users.length} users\n`);
  
  for (const user of users) {
    console.log(`User: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  FacilityID: ${user.facilityID}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Permissions: ${JSON.stringify(user.permissions)}`);
    console.log(`  _id: ${user._id}`);
    console.log(`  mysqlId: ${user.mysqlId}`);
    console.log('');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

checkMigratedUser().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
