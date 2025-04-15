/**
 * Profile Model
 * 
 * Mongoose model for storing user profiles in MongoDB.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Schema for user identity
const userIdentitySchema = new Schema({
  displayName: String,
  preferredTone: String,
  signatureLine: String,
  defaultGreeting: String
}, { _id: false });

// Schema for focus areas
const focusAreaSchema = new Schema({
  label: String,
  priority: Number,
  duration: String,
  tags: [String]
}, { _id: false });

// Schema for tools and integrations
const toolsAndIntegrationsSchema = new Schema({
  emailProvider: String,
  calendarProvider: String,
  projectManagement: [String],
  notesPlatform: String,
  customIntegrations: [String]
}, { _id: false });

// Schema for surfacing rules
const surfacingRulesSchema = new Schema({
  alwaysFlag: [String],
  autoArchive: [String],
  escalationTriggers: [String]
}, { _id: false });

// Schema for triage preferences
const triagePreferencesSchema = new Schema({
  style: {
    type: String,
    enum: ['batch', 'realtime', 'hybrid']
  },
  focusMode: Boolean,
  nudgeLevel: {
    type: String,
    enum: ['gentle', 'assertive', 'off']
  },
  surfacingRules: surfacingRulesSchema
}, { _id: false });

// Schema for communication patterns
const communicationPatternsSchema = new Schema({
  autoTagPhrases: [String],
  commonIntents: [String],
  frequentCollaborators: [String]
}, { _id: false });

// Schema for sentiment thresholds
const sentimentThresholdsSchema = new Schema({
  highUrgency: Number,
  lowPriority: Number
}, { _id: false });

// Schema for emotional preferences
const emotionalPreferencesSchema = new Schema({
  escalationTone: {
    type: String,
    enum: ['firm', 'neutral', 'soft']
  },
  responseVibe: {
    type: String,
    enum: ['direct', 'collaborative', 'diplomatic']
  },
  sentimentThresholds: sentimentThresholdsSchema
}, { _id: false });

// Schema for goal modeling
const goalModelingSchema = new Schema({
  currentGoals: [String],
  weeklyIntentFocus: [String],
  doNotDisturbWindows: [String],
  boostedThreads: [String]
}, { _id: false });

// Main profile schema
const profileSchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userIdentity: userIdentitySchema,
  focusAreas: [focusAreaSchema],
  toolsAndIntegrations: toolsAndIntegrationsSchema,
  triagePreferences: triagePreferencesSchema,
  communicationPatterns: communicationPatternsSchema,
  emotionalPreferences: emotionalPreferencesSchema,
  goalModeling: goalModelingSchema,
  completedSections: [String],
  currentSection: String,
  currentQuestionIndex: Number,
  completionPercentage: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
profileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create the model
const Profile = mongoose.model('Profile', profileSchema);

module.exports = Profile;
