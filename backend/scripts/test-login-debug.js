require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const User = require('../src/models/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function testLoginDebug() {
  await connectDB();
  console.log('[DEBUG] Testing login with various passwords...\n');
  
  const user = await User.findOne({ email: 'staff1@gmail.com' }).lean();
  if (!user) {
    console.log('[DEBUG] User not found');
    process.exit(1);
  }
  
  console.log(`User: ${user.name}`);
  console.log(`Email: ${user.email}`);
  console.log(`Password field: ${user.password}`);
  console.log(`Password_hash field: ${user.password_hash}`);
  console.log('');
  
  // Test MD5 hash
  const testPassword = 'password123';
  const md5Hash = crypto.createHash('md5').update(testPassword).digest('hex');
  console.log(`Test password: ${testPassword}`);
  console.log(`MD5 hash of test password: ${md5Hash}`);
  console.log(`MD5 match: ${md5Hash.toLowerCase() === user.password.trim().toLowerCase()}`);
  console.log('');
  
  // Test bcrypt if exists
  if (user.password_hash) {
    const bcryptMatch = await bcrypt.compare(testPassword, user.password_hash);
    console.log(`Bcrypt match: ${bcryptMatch}`);
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

testLoginDebug().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
