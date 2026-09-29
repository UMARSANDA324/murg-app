require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const authRepo = require('../src/repositories/authRepositoryMongo');

async function testAuthRepo() {
  await connectDB();
  console.log('[TEST] Testing MongoDB auth repository...\n');
  
  const email = 'yasir@gmail.com';
  console.log(`Looking up user: ${email}`);
  
  const user = await authRepo.findByEmailForAuth(email);
  
  if (user) {
    console.log('✓ User found');
    console.log(`  Name: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Status: ${user.status}`);
    console.log(`  Has password: ${!!user.password}`);
    console.log(`  Has password_hash: ${!!user.password_hash}`);
  } else {
    console.log('✗ User not found');
  }
  
  await mongoose.connection.close();
  process.exit(0);
}

testAuthRepo().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
