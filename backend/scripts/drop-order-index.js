const { connectDB, mongoose } = require('../src/config/mongodb');
const { Order } = require('../src/models');
require('dotenv').config();

async function dropOrderIndex() {
  try {
    await connectDB();
    console.log('Connected to MongoDB Atlas');
    
    // Drop the unique index
    await Order.collection.dropIndex('orderID_1_facilityID_1');
    console.log('Dropped unique index on orderID + facilityID');
    
    await mongoose.connection.close();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

dropOrderIndex();
