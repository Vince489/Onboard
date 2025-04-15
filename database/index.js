/**
 * Database Module Index
 * 
 * Exports the database service and models.
 */

const dbService = require('./dbService');
const models = require('./models');
const { connectToDatabase, isDatabaseConnected } = require('./connection');

module.exports = {
  ...dbService,
  models,
  connectToDatabase,
  isDatabaseConnected
};
