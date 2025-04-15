/**
 * Text-to-Speech Service for PULSE™ Onboarding Agent
 *
 * Provides functionality for converting text to speech using Google Cloud Text-to-Speech.
 * Adapted for use with the PULSE™ Onboarding Agent to give Virtra a voice.
 */

const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');
const fallbackTtsService = require('./fallbackTtsService');

// Create a client
let client;
try {
  // Try to use the inline credentials from .env if available
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
      client = new textToSpeech.TextToSpeechClient({
        credentials: credentials
      });
      console.log('[TTS] Google Cloud Text-to-Speech client initialized successfully using inline credentials');
    } catch (parseError) {
      console.error('[TTS] Failed to parse GOOGLE_CLOUD_CREDENTIALS:', parseError);
      // Fall back to using GOOGLE_APPLICATION_CREDENTIALS
      client = new textToSpeech.TextToSpeechClient();
      console.log('[TTS] Google Cloud Text-to-Speech client initialized successfully using credential file');
    }
  } else {
    // Create the client using GOOGLE_APPLICATION_CREDENTIALS
    client = new textToSpeech.TextToSpeechClient();
    console.log('[TTS] Google Cloud Text-to-Speech client initialized successfully');
  }
} catch (error) {
  console.error('[TTS] Failed to initialize Google Cloud Text-to-Speech client:', error);
  console.error('[TTS] Error details:', error.message);
  console.error('[TTS] Make sure GOOGLE_APPLICATION_CREDENTIALS is set or credentials are provided');
}

// Voice profiles for different personas
const VOICE_PROFILES = {
  // Default Virtra voice - professional, friendly assistant
  virtra: {
    languageCode: 'en-US',
    voiceName: 'en-US-Studio-O',  // Professional female voice
    ssmlGender: 'FEMALE',
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.0
  },
  // Alternative voices for different sections or moods
  welcome: {
    languageCode: 'en-US',
    voiceName: 'en-US-Studio-O',
    ssmlGender: 'FEMALE',
    audioEncoding: 'MP3',
    speakingRate: 1.05,  // Slightly faster for energetic welcome
    pitch: 0.5  // Slightly higher pitch for enthusiasm
  },
  technical: {
    languageCode: 'en-US',
    voiceName: 'en-US-Neural2-F',  // More precise, technical-sounding voice
    ssmlGender: 'FEMALE',
    audioEncoding: 'MP3',
    speakingRate: 0.95,  // Slightly slower for technical explanations
    pitch: -0.5  // Slightly lower pitch for authority
  },
  friendly: {
    languageCode: 'en-US',
    voiceName: 'en-US-Studio-O',
    ssmlGender: 'FEMALE',
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.3  // Slightly higher pitch for friendly tone
  },
  completion: {
    languageCode: 'en-US',
    voiceName: 'en-US-Studio-O',
    ssmlGender: 'FEMALE',
    audioEncoding: 'MP3',
    speakingRate: 1.0,
    pitch: 0.5  // Higher pitch for celebration
  }
};

// Default voice settings
const DEFAULT_VOICE_SETTINGS = VOICE_PROFILES.virtra;

// Ensure audio cache directory exists
async function ensureAudioCacheDir() {
  const cacheDir = path.join(__dirname, '../../cache/audio');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  } catch (error) {
    console.error('[TTS] Error creating audio cache directory:', error);
    throw error;
  }
}

/**
 * Generate a cache key for the audio based on text and voice settings
 * @param {string} text - The text to convert to speech
 * @param {object} settings - Voice settings
 * @returns {string} - The cache key
 */
function generateCacheKey(text, settings) {
  const hash = createHash('md5');
  hash.update(text);
  hash.update(JSON.stringify(settings));
  return hash.digest('hex');
}

/**
 * Check if audio is cached and return the path if it exists
 * @param {string} cacheKey - The cache key
 * @returns {Promise<string|null>} - The path to the cached audio or null
 */
async function getFromCache(cacheKey) {
  try {
    const cacheDir = await ensureAudioCacheDir();
    const cachePath = path.join(cacheDir, `${cacheKey}.mp3`);

    // Check if file exists
    await fs.access(cachePath);
    console.log(`[TTS] Using cached audio: ${cachePath}`);
    return cachePath;
  } catch (error) {
    // File doesn't exist or can't be accessed
    return null;
  }
}

/**
 * Save audio to cache
 * @param {string} cacheKey - The cache key
 * @param {Buffer} audioBuffer - The audio buffer
 * @returns {Promise<string>} - The path to the cached audio
 */
async function saveToCache(cacheKey, audioBuffer) {
  try {
    const cacheDir = await ensureAudioCacheDir();
    const cachePath = path.join(cacheDir, `${cacheKey}.mp3`);

    await fs.writeFile(cachePath, audioBuffer);
    console.log(`[TTS] Saved audio to cache: ${cachePath}`);
    return cachePath;
  } catch (error) {
    console.error('[TTS] Error saving audio to cache:', error);
    throw error;
  }
}

/**
 * Split text into sentences for better TTS processing
 * @param {string} text - The text to split
 * @param {number} maxLength - Maximum length of each chunk
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text, maxLength = 4000) {
  // First try to split by sentences
  const sentenceRegex = /[.!?]\s+/g;
  const sentences = text.split(sentenceRegex).filter(s => s.trim().length > 0);

  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    // If this sentence alone is too long, we need to split it by words
    if (sentence.length > maxLength) {
      // If we have accumulated text in currentChunk, add it to chunks first
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      // Split the long sentence into word chunks
      let sentenceWithPeriod = sentence + ". "; // Add period for better speech pauses
      let words = sentenceWithPeriod.split(" ");
      let wordChunk = "";

      for (const word of words) {
        if (wordChunk.length + word.length + 1 <= maxLength) {
          wordChunk += (wordChunk.length > 0 ? " " : "") + word;
        } else {
          chunks.push(wordChunk);
          wordChunk = word;
        }
      }

      if (wordChunk.length > 0) {
        chunks.push(wordChunk);
      }
    }
    // If adding this sentence would exceed the max length, start a new chunk
    else if (currentChunk.length + sentence.length + 2 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = sentence + ". ";
    }
    // Otherwise, add the sentence to the current chunk
    else {
      currentChunk += (currentChunk.length > 0 ? " " : "") + sentence + ". ";
    }
  }

  // Add the last chunk if there's anything left
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Synthesize speech for a single chunk of text
 * @param {string} text - The text chunk to convert to speech
 * @param {object} settings - Voice settings
 * @returns {Promise<Buffer>} - The audio buffer
 */
async function synthesizeChunk(text, settings) {
  // Configure the request
  const request = {
    input: { text },
    voice: {
      languageCode: settings.languageCode,
      name: settings.voiceName,
      ssmlGender: settings.ssmlGender
    },
    audioConfig: {
      audioEncoding: settings.audioEncoding,
      speakingRate: settings.speakingRate,
      pitch: settings.pitch
    }
  };

  // Add effectsProfileId if it exists in settings
  if (settings.effectsProfileId) {
    request.audioConfig.effectsProfileId = settings.effectsProfileId;
  }

  // Perform the text-to-speech request
  const [response] = await client.synthesizeSpeech(request);
  return Buffer.from(response.audioContent);
}

/**
 * Get voice settings for a specific persona or section
 * @param {string} personaId - The ID of the persona or section
 * @returns {object} - The voice settings
 */
function getVoiceSettings(personaId) {
  if (!personaId || !VOICE_PROFILES[personaId]) {
    return DEFAULT_VOICE_SETTINGS;
  }
  return VOICE_PROFILES[personaId];
}

/**
 * Synthesize speech from text and save to a file
 * @param {string} text - The text to convert to speech
 * @param {string} personaId - Optional persona ID to use voice settings from
 * @param {object} voiceSettings - Optional voice settings to override defaults
 * @returns {Promise<string|null>} - The path to the audio file or null if failed
 */
async function synthesizeSpeech(text, personaId = 'virtra', voiceSettings = {}) {
  try {
    if (!client) {
      console.warn('[TTS] Text-to-speech client not initialized, returning null');
      return null;
    }

    // Start with default settings for the persona
    let settings = { ...getVoiceSettings(personaId) };

    // Apply any directly provided voice settings (highest priority)
    settings = { ...settings, ...voiceSettings };

    // Generate cache key
    const cacheKey = generateCacheKey(text, settings);

    // Check if audio is already cached
    const cachedPath = await getFromCache(cacheKey);
    if (cachedPath) {
      return cachedPath;
    }

    // Split the text into manageable chunks
    const chunks = chunkText(text);
    console.log(`[TTS] Split text into ${chunks.length} chunks for TTS processing`);

    if (chunks.length === 0) {
      console.warn('[TTS] No text chunks to synthesize');
      return null;
    }

    try {
      let audioBuffer;
      if (chunks.length === 1) {
        // If there's only one chunk, process it directly
        audioBuffer = await synthesizeChunk(chunks[0], settings);
      } else {
        // Process multiple chunks and combine the audio
        const audioBuffers = [];
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[TTS] Processing TTS chunk ${i+1}/${chunks.length}, length: ${chunks[i].length} chars`);
          const buffer = await synthesizeChunk(chunks[i], settings);
          audioBuffers.push(buffer);
        }

        // Combine all audio buffers
        audioBuffer = Buffer.concat(audioBuffers);
      }

      // Save to cache and return the path
      return await saveToCache(cacheKey, audioBuffer);
    } catch (synthesisError) {
      // If we get a specific error about unsupported decoder routines, it might be a credentials issue
      if (synthesisError.message && synthesisError.message.includes('DECODER routines::unsupported')) {
        console.error('[TTS] Google Cloud credentials error: DECODER routines unsupported');
        console.error('[TTS] This is likely due to an issue with your Google Cloud credentials.');
        console.error('[TTS] Please check that your credentials file is valid and has the correct permissions.');
        // Return null instead of throwing to allow the application to continue without TTS
        return null;
      }

      // For other synthesis errors, rethrow
      throw synthesisError;
    }
  } catch (error) {
    console.error('[TTS] Error in synthesizeSpeech:', error);
    // Return null instead of throwing to allow the application to continue without TTS
    return null;
  }
}

/**
 * Play audio using the system's default audio player
 * @param {string} audioPath - Path to the audio file
 * @returns {Promise<void>}
 */
async function playAudio(audioPath) {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    // Determine the command based on the platform
    let command;
    switch (process.platform) {
      case 'win32':
        command = `start "" "${audioPath}"`;
        break;
      case 'darwin': // macOS
        command = `afplay "${audioPath}"`;
        break;
      default: // Linux and others
        command = `xdg-open "${audioPath}"`;
        break;
    }

    console.log(`[TTS] Playing audio: ${audioPath}`);
    await execPromise(command);
  } catch (error) {
    console.error('[TTS] Error playing audio:', error);
    throw error;
  }
}

/**
 * Speak text using TTS
 * @param {string} text - The text to speak
 * @param {string} personaId - Optional persona ID to use voice settings from
 * @param {object} voiceSettings - Optional voice settings to override defaults
 * @returns {Promise<boolean>} - Whether the speech was successful
 */
async function speak(text, personaId = 'virtra', voiceSettings = {}) {
  try {
    // Skip TTS if text is empty
    if (!text || text.trim() === '') {
      console.warn('[TTS] Empty text provided to speak function');
      return false;
    }

    const audioPath = await synthesizeSpeech(text, personaId, voiceSettings);
    if (audioPath) {
      try {
        await playAudio(audioPath);
        return true;
      } catch (playError) {
        console.error('[TTS] Error playing audio:', playError);
        return false;
      }
    } else {
      console.warn('[TTS] No audio path returned from synthesizeSpeech');
      return false;
    }
  } catch (error) {
    console.error('[TTS] Error in speak:', error);
    // Continue without audio if there's an error
    return false;
  }
}

module.exports = {
  synthesizeSpeech,
  speak,
  getVoiceSettings,
  VOICE_PROFILES,
  DEFAULT_VOICE_SETTINGS
};
