const fs = require('fs').promises;
const path = require('path');
const db = require('../database');

// Create sessions directory if it doesn't exist (for fallback)
async function ensureSessionsDirectory() {
  const sessionsDir = path.join(__dirname, '../sessions');
  try {
    await fs.mkdir(sessionsDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return sessionsDir;
}

// Save session data (uses database if available, falls back to file system)
async function saveSession(sessionId, sessionData) {
  try {
    // Use the database service to save the session
    return await db.saveSession(sessionId, sessionData);
  } catch (err) {
    console.error('Error saving session:', err);

    // Fallback to file system if database fails
    try {
      const sessionsDir = await ensureSessionsDirectory();
      const sessionPath = path.join(sessionsDir, `${sessionId}.json`);

      await fs.writeFile(
        sessionPath,
        JSON.stringify({
          ...sessionData,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      );
      console.log(`Session saved to file system as fallback: ${sessionId}`);
      return true;
    } catch (fsErr) {
      console.error('Error saving session to file system:', fsErr);
      return false;
    }
  }
}

// Load session data (uses database if available, falls back to file system)
async function loadSession(sessionId) {
  try {
    // Use the database service to load the session
    return await db.loadSession(sessionId);
  } catch (err) {
    console.error('Error loading session:', err);

    // Fallback to file system if database fails
    try {
      const sessionsDir = await ensureSessionsDirectory();
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

// Create a new session
async function createSession(userId) {
  const sessionId = `${userId}_${Date.now()}`;
  const sessionData = {
    userId,
    startTime: new Date().toISOString(),
    conversationHistory: [],
    state: 'active'
  };

  await saveSession(sessionId, sessionData);
  return sessionId;
}

// Add a message to the conversation history
async function addMessage(sessionId, role, content) {
  const session = await loadSession(sessionId);
  if (!session) return false;

  session.conversationHistory.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });

  return saveSession(sessionId, session);
}

// End a session
async function endSession(sessionId) {
  const session = await loadSession(sessionId);
  if (!session) return false;

  session.state = 'completed';
  session.endTime = new Date().toISOString();

  return saveSession(sessionId, session);
}

// List active sessions for a user
async function listUserSessions(userId) {
  const sessionsDir = await ensureSessionsDirectory();

  try {
    const files = await fs.readdir(sessionsDir);
    const sessions = [];

    for (const file of files) {
      if (file.startsWith(userId) && file.endsWith('.json')) {
        const sessionData = await loadSession(file.replace('.json', ''));
        if (sessionData) {
          sessions.push({
            sessionId: file.replace('.json', ''),
            startTime: sessionData.startTime,
            state: sessionData.state,
            lastUpdated: sessionData.lastUpdated
          });
        }
      }
    }

    return sessions;
  } catch (err) {
    console.error('Error listing sessions:', err);
    return [];
  }
}

module.exports = {
  saveSession,
  loadSession,
  createSession,
  addMessage,
  endSession,
  listUserSessions
};
