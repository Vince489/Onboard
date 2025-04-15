/**
 * Session Model
 * 
 * Mongoose model for storing user session data in MongoDB.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for conversation messages
const messageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'agent'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Main session schema
const sessionSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  state: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned'],
    default: 'active'
  },
  conversationHistory: [messageSchema],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Update the lastUpdated field before saving
sessionSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Create the model
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
