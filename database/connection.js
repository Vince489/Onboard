/**
 * MongoDB Connection
 * 
 * Handles the connection to MongoDB for the PULSE™ Onboarding Agent.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Get MongoDB URI from environment variables
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

// Connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  autoIndex: true, // Build indexes
  maxPoolSize: 10, // Maintain up to 10 socket connections
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Connect to MongoDB if URI is provided
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    console.log('Already connected to MongoDB');
    return;
  }

  if (!mongoUri) {
    console.log('MongoDB URI not provided, running without database');
    return;
  }

  try {
    await mongoose.connect(mongoUri, options);
    isConnected = true;
    console.log('Connected to MongoDB');
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });
    
    // Handle process termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
  } catch (err) {
    console.error('MongoDB connection error:', err);
    isConnected = false;
  }
}

// Check if database is connected
function isDatabaseConnected() {
  return isConnected;
}

module.exports = {
  connectToDatabase,
  isDatabaseConnected,
  mongoose
};
