const fs = require('fs').promises;
const path = require('path');
const db = require('../database');

// Initialize database connection
db.initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  console.log('Falling back to file-based storage');
});

// Create profiles directory if it doesn't exist (for fallback)
async function ensureProfilesDirectory() {
  const profilesDir = path.join(__dirname, '../profiles');
  try {
    await fs.mkdir(profilesDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  return profilesDir;
}

// Save profile data (uses database if available, falls back to file system)
async function saveProfile(userId, profileData) {
  try {
    // Use the database service to save the profile
    return await db.saveProfile(userId, profileData);
  } catch (err) {
    console.error('Error saving profile:', err);

    // Fallback to file system if database fails
    try {
      const profilesDir = await ensureProfilesDirectory();
      const profilePath = path.join(profilesDir, `${userId}.json`);

      await fs.writeFile(
        profilePath,
        JSON.stringify(profileData, null, 2)
      );
      console.log(`Profile saved to file system as fallback for user: ${userId}`);
      return true;
    } catch (fsErr) {
      console.error('Error saving profile to file system:', fsErr);
      return false;
    }
  }
}

// Load profile data (uses database if available, falls back to file system)
async function loadProfile(userId) {
  try {
    // Use the database service to load the profile
    return await db.loadProfile(userId);
  } catch (err) {
    console.error('Error loading profile:', err);

    // Fallback to file system if database fails
    try {
      const profilesDir = await ensureProfilesDirectory();
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

// List all available profiles
async function listProfiles() {
  const profilesDir = await ensureProfilesDirectory();

  try {
    const files = await fs.readdir(profilesDir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (err) {
    console.error('Error listing profiles:', err);
    return [];
  }
}

// Delete a profile
async function deleteProfile(userId) {
  const profilesDir = await ensureProfilesDirectory();
  const profilePath = path.join(profilesDir, `${userId}.json`);

  try {
    await fs.unlink(profilePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Profile doesn't exist
      return false;
    }
    console.error('Error deleting profile:', err);
    return false;
  }
}

module.exports = {
  saveProfile,
  loadProfile,
  listProfiles,
  deleteProfile
};
