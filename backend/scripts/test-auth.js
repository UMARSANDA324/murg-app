const { connectDB, mongoose } = require('../src/config/mongodb');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function log(message) {
  console.log(`[AUTH TEST] ${message}`);
}

async function testAuthentication() {
  await connectDB();
  log('STARTING AUTHENTICATION TEST');
  log('================================================\n');
  
  // Get migrated users
  log('Fetching migrated users...');
  const users = await User.find({}).select('facilityID name email role password password_hash').lean();
  log(`Found ${users.length} users\n`);
  
  for (const user of users) {
    log(`Testing user: ${user.name} (${user.facilityID})`);
    log(`  Role: ${user.role}`);
    log(`  Email: ${user.email || 'N/A'}`);
    log(`  Password hash present: ${!!user.password_hash || !!user.password}`);
    
    // Test password verification if hash exists
    if (user.password_hash) {
      // Try to verify with a common test password (this is just to verify bcrypt works)
      // In production, users would use their actual passwords
      log(`  Password hash type: bcrypt`);
      
      // Verify the hash is valid bcrypt format
      try {
        const isValidBcrypt = user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$');
        log(`  Valid bcrypt format: ${isValidBcrypt ? '✓' : '✗'}`);
      } catch (err) {
        log(`  Hash validation error: ${err.message}`);
      }
    } else if (user.password) {
      log(`  Password hash type: legacy (MD5 or plain)`);
      log(`  Password length: ${user.password.length}`);
    }
    
    log('');
  }
  
  // Test that we can find a user by facilityID
  log('Testing user lookup by facilityID...');
  const testUser = await User.findOne({ facilityID: 'MURG/001' });
  if (testUser) {
    log(`  ✓ Found user: ${testUser.name}`);
    log(`  ✓ Role: ${testUser.role}`);
    log(`  ✓ FacilityID: ${testUser.facilityID}`);
  } else {
    log(`  ✗ User MURG/001 not found`);
  }
  
  log('\n================================================');
  log('AUTHENTICATION TEST COMPLETE');
  log('================================================\n');
  
  await mongoose.connection.close();
  process.exit(0);
}

testAuthentication().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
