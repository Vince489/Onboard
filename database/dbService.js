/**
 * Database Service
 *
 * Provides functions for interacting with the database.
 */

const { connectToDatabase, isDatabaseConnected } = require('./connection');
const { Profile, Session } = require('./models');
const fs = require('fs').promises;
const path = require('path');

// Connect to the database
async function initializeDatabase() {
  await connectToDatabase();
}

// Profile operations
async function saveProfile(userId, profileData) {
  try {
    // If database is connected, save to MongoDB
    if (isDatabaseConnected()) {
      // Check if profile exists
      let profile = await Profile.findOne({ userId });

      if (profile) {
        // Update existing profile
        Object.assign(profile, {
          userIdentity: profileData.profile?.userIdentity || {},
          focusAreas: profileData.profile?.focusAreas || [],
          toolsAndIntegrations: profileData.profile?.toolsAndIntegrations || {},
          triagePreferences: profileData.profile?.triagePreferences || {},
          communicationPatterns: profileData.profile?.communicationPatterns || {},
          emotionalPreferences: profileData.profile?.emotionalPreferences || {},
          goalModeling: profileData.profile?.goalModeling || {},
          completedSections: profileData.completedSections || [],
          currentSection: profileData.currentSection || 'personalInfo',
          currentQuestionIndex: profileData.currentQuestionIndex || 0,
          completionPercentage: profileData.completionPercentage || 0
        });

        await profile.save();
        console.log(`Profile updated in MongoDB for user: ${userId}`);
      } else {
        // Create new profile
        profile = new Profile({
          userId,
          userIdentity: profileData.profile?.userIdentity || {},
          focusAreas: profileData.profile?.focusAreas || [],
          toolsAndIntegrations: profileData.profile?.toolsAndIntegrations || {},
          triagePreferences: profileData.profile?.triagePreferences || {},
          communicationPatterns: profileData.profile?.communicationPatterns || {},
          emotionalPreferences: profileData.profile?.emotionalPreferences || {},
          goalModeling: profileData.profile?.goalModeling || {},
          completedSections: profileData.completedSections || [],
          currentSection: profileData.currentSection || 'personalInfo',
          currentQuestionIndex: profileData.currentQuestionIndex || 0,
          completionPercentage: profileData.completionPercentage || 0
        });

        await profile.save();
        console.log(`Profile created in MongoDB for user: ${userId}`);
      }
    }

    // Always save to file system as backup
    const profilesDir = path.join(__dirname, '../profiles');
    try {
      await fs.mkdir(profilesDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    const profilePath = path.join(profilesDir, `${userId}.json`);
    await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2));

    return true;
  } catch (err) {
    console.error('Error saving profile:', err);

    // Try to save to file system as fallback
    try {
      const profilesDir = path.join(__dirname, '../profiles');
      await fs.mkdir(profilesDir, { recursive: true });
      const profilePath = path.join(profilesDir, `${userId}.json`);
      await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2));
      console.log(`Profile saved to file system as fallback for user: ${userId}`);
      return true;
    } catch (fsErr) {
      console.error('Error saving profile to file system:', fsErr);
      return false;
    }
  }
}

async function loadProfile(userId) {
  try {
    // If database is connected, try to load from MongoDB
    if (isDatabaseConnected()) {
      const profile = await Profile.findOne({ userId });

      if (profile) {
        console.log(`Profile loaded from MongoDB for user: ${userId}`);

        // Convert MongoDB document to expected format
        return {
          profile: {
            userIdentity: profile.userIdentity || {},
            focusAreas: profile.focusAreas || [],
            toolsAndIntegrations: profile.toolsAndIntegrations || {},
            triagePreferences: profile.triagePreferences || {},
            communicationPatterns: profile.communicationPatterns || {},
            emotionalPreferences: profile.emotionalPreferences || {},
            goalModeling: profile.goalModeling || {}
          },
          completedSections: profile.completedSections || [],
          currentSection: profile.currentSection || 'personalInfo',
          currentQuestionIndex: profile.currentQuestionIndex || 0
        };
      }
    }

    // If not found in MongoDB or database not connected, try file system
    const profilesDir = path.join(__dirname, '../profiles');
    const profilePath = path.join(profilesDir, `${userId}.json`);

    try {
      const data = await fs.readFile(profilePath, 'utf8');
      console.log(`Profile loaded from file system for user: ${userId}`);
      return JSON.parse(data);
    } catch (fsErr) {
      if (fsErr.code === 'ENOENT') {
        // Profile doesn't exist yet
        return null;
      }
      console.error('Error loading profile from file system:', fsErr);
      return null;
    }
  } catch (err) {
    console.error('Error loading profile:', err);

    // Try to load from file system as fallback
    try {
      const profilesDir = path.join(__dirname, '../profiles');
      const profilePath = path.join(profilesDir, `${userId}.json`);
      const data = await fs.readFile(profilePath, 'utf8');
      console.log(`Profile loaded from file system as fallback for user: ${userId}`);
      return JSON.parse(data);
    } catch (fsErr) {
      if (fsErr.code === 'ENOENT') {
        // Profile doesn't exist yet
        return null;
      }
      console.error('Error loading profile from file system:', fsErr);
      return null;
    }
  }
}

// Session operations
async function saveSession(sessionId, sessionData) {
  try {
    // If database is connected, save to MongoDB
    if (isDatabaseConnected()) {
      // Check if session exists
      let session = await Session.findOne({ sessionId });

      if (session) {
        // Update existing session
        Object.assign(session, {
          userId: sessionData.userId,
          state: sessionData.state || 'active',
          conversationHistory: sessionData.conversationHistory || [],
          endTime: sessionData.endTime
        });

        await session.save();
        console.log(`Session updated in MongoDB: ${sessionId}`);
      } else {
        // Create new session
        session = new Session({
          sessionId,
          userId: sessionData.userId,
          state: sessionData.state || 'active',
          conversationHistory: sessionData.conversationHistory || [],
          startTime: sessionData.startTime || new Date(),
          endTime: sessionData.endTime
        });

        await session.save();
        console.log(`Session created in MongoDB: ${sessionId}`);
      }
    }

    // Always save to file system as backup
    const sessionsDir = path.join(__dirname, '../sessions');
    try {
      await fs.mkdir(sessionsDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }

    const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
    await fs.writeFile(sessionPath, JSON.stringify({
      ...sessionData,
      lastUpdated: new Date().toISOString()
    }, null, 2));

    return true;
  } catch (err) {
    console.error('Error saving session:', err);

    // Try to save to file system as fallback
    try {
      const sessionsDir = path.join(__dirname, '../sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
      await fs.writeFile(sessionPath, JSON.stringify({
        ...sessionData,
        lastUpdated: new Date().toISOString()
      }, null, 2));
      console.log(`Session saved to file system as fallback: ${sessionId}`);
      return true;
    } catch (fsErr) {
      console.error('Error saving session to file system:', fsErr);
      return false;
    }
  }
}

async function loadSession(sessionId) {
  try {
    // If database is connected, try to load from MongoDB
    if (isDatabaseConnected()) {
      const session = await Session.findOne({ sessionId });

      if (session) {
        console.log(`Session loaded from MongoDB: ${sessionId}`);
        return {
          sessionId: session.sessionId,
          userId: session.userId,
          state: session.state,
          conversationHistory: session.conversationHistory,
          startTime: session.startTime,
          endTime: session.endTime,
          lastUpdated: session.lastUpdated
        };
      }
    }

    // If not found in MongoDB or database not connected, try file system
    const sessionsDir = path.join(__dirname, '../sessions');
    const sessionPath = path.join(sessionsDir, `${sessionId}.json`);

    try {
      const data = await fs.readFile(sessionPath, 'utf8');
      console.log(`Session loaded from file system: ${sessionId}`);
      return JSON.parse(data);
    } catch (fsErr) {
      if (fsErr.code === 'ENOENT') {
        // Session doesn't exist yet
        return null;
      }
      console.error('Error loading session from file system:', fsErr);
      return null;
    }
  } catch (err) {
    console.error('Error loading session:', err);

    // Try to load from file system as fallback
    try {
      const sessionsDir = path.join(__dirname, '../sessions');
      const sessionPath = path.join(sessionsDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionPath, 'utf8');
      console.log(`Session loaded from file system as fallback: ${sessionId}`);
      return JSON.parse(data);
    } catch (fsErr) {
      if (fsErr.code === 'ENOENT') {
        // Session doesn't exist yet
        return null;
      }
      console.error('Error loading session from file system:', fsErr);
      return null;
    }
  }
}

// Delete a user profile
async function deleteProfile(userId) {
  try {
    // If database is connected, delete from MongoDB
    if (isDatabaseConnected()) {
      const result = await Profile.deleteOne({ userId });
      if (result.deletedCount > 0) {
        console.log(`Profile deleted from MongoDB for user: ${userId}`);
      }
    }

    // Always try to delete from file system as well
    const profilesDir = path.join(__dirname, '../profiles');
    const profilePath = path.join(profilesDir, `${userId}.json`);

    try {
      await fs.unlink(profilePath);
      console.log(`Profile deleted from file system for user: ${userId}`);
    } catch (fsErr) {
      if (fsErr.code !== 'ENOENT') {
        console.error('Error deleting profile from file system:', fsErr);
      }
    }

    return true;
  } catch (err) {
    console.error('Error deleting profile:', err);
    return false;
  }
}

// Export the database service functions
module.exports = {
  initializeDatabase,
  saveProfile,
  loadProfile,
  saveSession,
  loadSession,
  deleteProfile
};
