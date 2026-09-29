require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const User = require('../src/models/User');

async function checkPasswordHashes() {
  await connectDB();
  console.log('[CHECK] Fetching user password hashes from MongoDB...\n');
  
  const users = await User.find({}).select('name email password password_hash').lean();
  console.log(`[CHECK] Found ${users.length} users\n`);
  
  for (const user of users) {
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`  Has password field: ${!!user.password}`);
    console.log(`  Has password_hash field: ${!!user.password_hash}`);
    if (user.password) {
      console.log(`  Password length: ${user.password.length}`);
      console.log(`  Password starts with: ${user.password.substring(0, 10)}...`);
    }
    if (user.password_hash) {
      console.log(`  Password_hash starts with: ${user.password_hash.substring(0, 10)}...`);
    }
    console.log('');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

checkPasswordHashes().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
