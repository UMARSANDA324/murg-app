const { connectDB, mongoose } = require('../src/config/mongodb');
const { Order } = require('../src/models');
require('dotenv').config();

async function clearOrders() {
  try {
    await connectDB();
    console.log('Connected to MongoDB Atlas');
    
    const result = await Order.deleteMany({});
    console.log(`Deleted ${result.deletedCount} order records`);
    
    await mongoose.connection.close();
    console.log('Done');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

clearOrders();
