require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function testPasswordMatches() {
  await connectDB();
  console.log('[DEBUG] Testing common passwords against migrated users...\n');
  
  const users = await User.find({}).select('name email password password_hash').lean();
  const commonPasswords = ['123456', 'password', 'password123', 'admin', 'admin123'];
  
  for (const user of users) {
    console.log(`Testing user: ${user.name} (${user.email})`);
    console.log(`  Stored MD5: ${user.password}`);
    
    for (const testPwd of commonPasswords) {
      const md5Hash = crypto.createHash('md5').update(testPwd).digest('hex');
      if (md5Hash.toLowerCase() === user.password.trim().toLowerCase()) {
        console.log(`  ✓ MATCH found: "${testPwd}"`);
        break;
      }
    }
    
    if (user.password_hash) {
      for (const testPwd of commonPasswords) {
        const bcryptMatch = await bcrypt.compare(testPwd, user.password_hash);
        if (bcryptMatch) {
          console.log(`  ✓ BCRYPT match found: "${testPwd}"`);
          break;
        }
      }
    }
    
    console.log('');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

testPasswordMatches().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
