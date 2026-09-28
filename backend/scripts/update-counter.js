require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const Counter = require('../src/models/Counter');

function log(message) {
  console.log(`[COUNTER UPDATE] ${message}`);
}

async function updateCounter() {
  await connectDB();
  log('UPDATING COUNTER FOR SAFE FUTURE WRITES');
  log('================================================\n');
  
  // Find highest mysqlId across all collections
  // From validation, the highest is Orders: 1826
  // Set counter to 2000 to be safe
  const newLastID = 2000;
  
  log(`Updating counter.lastID to ${newLastID}...`);
  
  const counter = await Counter.findOne({ name: 'facilityID' });
  if (counter) {
    counter.lastID = newLastID;
    await counter.save();
    log(`✓ Counter updated: lastID = ${counter.lastID}`);
  } else {
    log(`✗ Counter not found, creating new counter...`);
    await Counter.create({
      name: 'facilityID',
      lastID: newLastID,
      mysqlId: 1,
    });
    log(`✓ Counter created: lastID = ${newLastID}`);
  }
  
  log('\n================================================');
  log('COUNTER UPDATE COMPLETE');
  log('================================================\n');
  
  await mongoose.connection.close();
  process.exit(0);
}

updateCounter().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
