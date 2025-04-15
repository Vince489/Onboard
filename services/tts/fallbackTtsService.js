/**
 * Fallback Text-to-Speech Service for PULSE™ Onboarding Agent
 * 
 * This is a simple fallback service that doesn't rely on Google Cloud.
 * It simply returns a path to a pre-recorded audio file or null.
 */

const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');

// Ensure audio cache directory exists
async function ensureAudioCacheDir() {
  const cacheDir = path.join(__dirname, '../../cache/audio');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  } catch (error) {
    console.error('[Fallback TTS] Error creating audio cache directory:', error);
    throw error;
  }
}

/**
 * Generate a cache key for the text
 * @param {string} text - The text
 * @returns {string} - The cache key
 */
function generateCacheKey(text) {
  const hash = createHash('md5');
  hash.update(text);
  return hash.digest('hex');
}

/**
 * Create a simple text file with the speech content
 * This is used as a fallback when actual audio generation is not available
 * @param {string} text - The text to save
 * @returns {Promise<string|null>} - The path to the text file or null if failed
 */
async function createTextFile(text) {
  try {
    const cacheDir = await ensureAudioCacheDir();
    const cacheKey = generateCacheKey(text);
    const filePath = path.join(cacheDir, `${cacheKey}.txt`);
    
    await fs.writeFile(filePath, text);
    console.log(`[Fallback TTS] Saved text to file: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error('[Fallback TTS] Error saving text to file:', error);
    return null;
  }
}

/**
 * Synthesize speech (fallback implementation)
 * @param {string} text - The text to convert to speech
 * @returns {Promise<string|null>} - The path to the text file or null if failed
 */
async function synthesizeSpeech(text) {
  console.log('[Fallback TTS] Using fallback TTS service');
  return await createTextFile(text);
}

module.exports = {
  synthesizeSpeech
};
