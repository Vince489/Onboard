/**
 * Speech-to-Text Service for PULSE™ Onboarding Agent
 *
 * Provides functionality for converting speech to text using Google Cloud Speech-to-Text.
 * Adapted for use with the PULSE™ Onboarding Agent to enable voice input.
 */

const speech = require('@google-cloud/speech');
const fs = require('fs').promises;
const path = require('path');
const { createHash } = require('crypto');
const { spawn } = require('child_process');
const readline = require('readline');

// Create a client using the credentials set in environment variables
let client;
try {
  // Try to use the inline credentials from .env if available
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
      client = new speech.SpeechClient({
        credentials: credentials
      });
      console.log('[STT] Google Speech-to-Text client initialized successfully using inline credentials');
    } catch (parseError) {
      console.error('[STT] Failed to parse GOOGLE_CLOUD_CREDENTIALS:', parseError);
      // Fall back to using GOOGLE_APPLICATION_CREDENTIALS
      client = new speech.SpeechClient();
      console.log('[STT] Google Speech-to-Text client initialized successfully using credential file');
    }
  } else {
    // Create the client using GOOGLE_APPLICATION_CREDENTIALS
    client = new speech.SpeechClient();
    console.log('[STT] Google Speech-to-Text client initialized successfully');
  }
} catch (error) {
  console.error('[STT] Failed to initialize Google Speech-to-Text client:', error);
  console.error('[STT] Error details:', error.message);
  console.error('[STT] Make sure GOOGLE_APPLICATION_CREDENTIALS is set or credentials are provided');
}

// Ensure audio cache directory exists
async function ensureAudioCacheDir() {
  const cacheDir = path.join(__dirname, '../../cache/audio');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  } catch (error) {
    console.error('[STT] Error creating audio cache directory:', error);
    throw error;
  }
}

/**
 * Generate a cache key for the audio based on its content
 * @param {Buffer} audioBuffer - The audio buffer
 * @returns {string} - The cache key
 */
function generateCacheKey(audioBuffer) {
  const hash = createHash('md5');
  hash.update(audioBuffer);
  return hash.digest('hex');
}

/**
 * Check if transcription is cached and return it if it exists
 * @param {string} cacheKey - The cache key
 * @returns {Promise<object|null>} - The cached transcription or null
 */
async function getFromCache(cacheKey) {
  try {
    const cacheDir = await ensureAudioCacheDir();
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);

    // Check if file exists
    await fs.access(cachePath);
    const data = await fs.readFile(cachePath, 'utf8');
    console.log(`[STT] Using cached transcription: ${cachePath}`);
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or can't be accessed
    return null;
  }
}

/**
 * Save transcription to cache
 * @param {string} cacheKey - The cache key
 * @param {object} transcription - The transcription result
 * @returns {Promise<string>} - The path to the cached transcription
 */
async function saveToCache(cacheKey, transcription) {
  try {
    const cacheDir = await ensureAudioCacheDir();
    const cachePath = path.join(cacheDir, `${cacheKey}.json`);

    await fs.writeFile(cachePath, JSON.stringify(transcription, null, 2));
    console.log(`[STT] Saved transcription to cache: ${cachePath}`);
    return cachePath;
  } catch (error) {
    console.error('[STT] Error saving transcription to cache:', error);
    throw error;
  }
}

/**
 * Transcribe speech from an audio buffer
 * @param {Buffer} audioBuffer - The audio buffer to transcribe
 * @param {string} contentType - The MIME type of the audio (e.g., 'audio/wav', 'audio/mp3')
 * @returns {Promise<object>} - The transcription result
 */
async function transcribeSpeech(audioBuffer, contentType) {
  try {
    console.log(`[STT] Transcribing audio with content type: ${contentType}`);

    // Validate inputs
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer provided');
    }

    if (!contentType) {
      console.warn('[STT] No content type provided, defaulting to LINEAR16');
    }

    // Generate cache key and check cache
    const cacheKey = generateCacheKey(audioBuffer);
    const cachedResult = await getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // Determine encoding based on content type
    let encoding = 'LINEAR16';
    console.log(`[STT] Transcribing audio with content type: ${contentType}`);

    if (contentType?.includes('mp3')) {
      encoding = 'MP3';
    } else if (contentType?.includes('ogg')) {
      encoding = 'OGG_OPUS';
    } else if (contentType?.includes('webm')) {
      if (contentType.includes('opus')) {
        encoding = 'WEBM_OPUS';
      } else {
        encoding = 'WEBM_OPUS';
      }
    }

    // Check if the audio buffer starts with a WebM header
    if (audioBuffer.length > 4) {
      const headerHex = audioBuffer.slice(0, 4).toString('hex');
      if (headerHex.includes('1a45dfa3')) {
        console.log('[STT] Detected WebM header in audio buffer');
        encoding = 'WEBM_OPUS';
      }
    }

    console.log(`[STT] Using encoding: ${encoding}`);

    // Check if Google credentials are available
    if (!client) {
      console.warn('[STT] Google Speech-to-Text client not available, using fallback mode');
      console.log('[STT] GOOGLE_APPLICATION_CREDENTIALS available:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS);
      return useFallbackTranscription(audioBuffer, contentType);
    }

    // Configure the request
    const config = {
      encoding: encoding,
      // Don't specify sampleRateHertz to let Google auto-detect it
      languageCode: 'en-US',
      model: 'default',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false,
      audioChannelCount: 1,
      useEnhanced: true,
      modelOptions: {
        useEnhanced: true
      }
    };

    // If we know the content type is webm or opus, use 48000 Hz
    if (contentType?.includes('webm') || contentType?.includes('opus')) {
      config.sampleRateHertz = 48000;
    }

    // For WAV files from browsers, often 44100 Hz is used
    if (contentType?.includes('wav')) {
      // Don't specify sampleRateHertz to let Google auto-detect it
    }

    console.log('[STT] Using speech recognition config:', JSON.stringify(config, null, 2));

    const audio = {
      content: audioBuffer.toString('base64'),
    };

    const request = {
      config: config,
      audio: audio,
    };

    // Detects speech in the audio file
    const [response] = await client.recognize(request);

    // Get the transcription
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    // Get the confidence score
    const confidence = response.results.length > 0
      ? response.results[0].alternatives[0].confidence
      : 0;

    // If no transcription was found, return a fallback message
    if (!transcription) {
      console.log('[STT] No speech detected in the audio');
      const result = {
        text: "I couldn't detect any speech in the audio. Please try speaking more clearly or check your microphone.",
        confidence: 0,
        audioLength: response.totalBilledTime?.seconds || 0,
        noSpeechDetected: true
      };

      await saveToCache(cacheKey, result);
      return result;
    }

    const result = {
      text: transcription,
      confidence: confidence,
      audioLength: response.totalBilledTime?.seconds || 0,
    };

    await saveToCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[STT] Error in transcribeSpeech:', error);

    // Check for the specific DECODER error
    if (error.message && error.message.includes('DECODER routines::unsupported')) {
      console.error('[STT] Detected DECODER routines::unsupported error - this is likely an audio format issue');
      console.error('[STT] Falling back to default response');
      return {
        text: "I couldn't process your audio due to a format issue. Could you please type your response instead?",
        confidence: 0,
        audioLength: 0,
        error: "DECODER_UNSUPPORTED"
      };
    }
    // Provide more specific error messages for other cases
    else if (error.code === 7) {
      throw new Error('Google API permission denied. Check your credentials.');
    } else if (error.code === 3) {
      throw new Error('Invalid audio format. Check the audio encoding.');
    } else if (error.code === 13) {
      throw new Error('Google API quota exceeded.');
    } else if (error.message && error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      throw new Error('Google credentials not properly configured.');
    } else {
      // For any other error, return a user-friendly message instead of throwing
      console.error(`[STT] Unhandled error: ${error.message || 'Unknown error'}`);
      return {
        text: "I'm having trouble processing your speech right now. Could you please type your response instead?",
        confidence: 0,
        audioLength: 0,
        error: error.message || 'Unknown error'
      };
    }
  }
}

/**
 * Fallback transcription when Google Cloud Speech-to-Text is not available
 * This is a simple mock implementation that returns a predefined response
 * @param {Buffer} audioBuffer - The audio buffer
 * @param {string} contentType - The content type
 * @returns {Promise<object>} - A mock transcription result
 */
async function useFallbackTranscription(audioBuffer, contentType) {
  console.log('[STT] Using fallback transcription mode');
  console.log(`[STT] Audio buffer size: ${audioBuffer ? audioBuffer.length : 'null'} bytes`);
  console.log(`[STT] Content type: ${contentType || 'not provided'}`);

  // In a real implementation, you might want to use a different speech-to-text service
  // or implement a simple speech recognition algorithm

  // For now, we'll just return a mock response with diagnostic information
  return {
    text: `I received your audio but I'm using fallback mode because Google Cloud Speech-to-Text is not configured properly.`,
    confidence: 1.0,
    audioLength: audioBuffer ? audioBuffer.length : 0,
    fallbackMode: true,
    diagnosticInfo: {
      hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      contentType: contentType || 'not provided'
    }
  };
}

/**
 * Utility function to check and debug Google Cloud credentials
 * @returns {object} - Information about the credentials
 */
function checkGoogleCredentials() {
  const result = {
    hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    clientInitialized: !!client,
    googleApplicationCredentialsValid: false,
    issues: []
  };

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Check if the file exists
    try {
      const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(filePath)) {
        result.googleApplicationCredentialsValid = true;
      } else {
        result.issues.push(`GOOGLE_APPLICATION_CREDENTIALS file does not exist: ${filePath}`);
      }
    } catch (e) {
      result.issues.push(`Error checking GOOGLE_APPLICATION_CREDENTIALS: ${e.message}`);
    }
  } else {
    result.issues.push('GOOGLE_APPLICATION_CREDENTIALS is not set');
  }

  return result;
}

/**
 * Record audio from the microphone
 * @param {number} maxDurationSec - Maximum recording duration in seconds
 * @returns {Promise<Buffer>} - The recorded audio buffer
 */
async function recordAudio(maxDurationSec = 10) {
  return new Promise((resolve, reject) => {
    console.log('[STT] Starting audio recording...');
    console.log('[STT] Press Enter to stop recording (or wait for timeout)');

    // Determine the command based on the platform
    let command, args;
    switch (process.platform) {
      case 'win32':
        // For Windows, use SoX if available
        command = 'sox';
        args = ['-d', '-t', 'wav', '-'];
        break;
      case 'darwin': // macOS
        command = 'rec';
        args = ['-t', 'wav', '-'];
        break;
      default: // Linux and others
        command = 'arecord';
        args = ['-f', 'cd', '-t', 'wav', '-d', maxDurationSec.toString()];
        break;
    }

    try {
      const recorder = spawn(command, args);
      const chunks = [];

      // Set up readline to detect Enter key
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Set a timeout to stop recording after maxDurationSec
      const timeout = setTimeout(() => {
        console.log('[STT] Recording timeout reached');
        recorder.kill();
        rl.close();
      }, maxDurationSec * 1000);

      // Listen for Enter key to stop recording
      rl.question('', () => {
        console.log('[STT] Stopping recording...');
        clearTimeout(timeout);
        recorder.kill();
        rl.close();
      });

      // Collect audio data
      recorder.stdout.on('data', (data) => {
        chunks.push(data);
      });

      // Handle recording completion
      recorder.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0 || code === null) {
          console.log('[STT] Recording completed successfully');
          const audioBuffer = Buffer.concat(chunks);
          resolve(audioBuffer);
        } else {
          console.error(`[STT] Recording process exited with code ${code}`);
          reject(new Error(`Recording process exited with code ${code}`));
        }
      });

      // Handle recording errors
      recorder.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[STT] Recording error:', err);
        reject(err);
      });
    } catch (error) {
      console.error('[STT] Error starting recording:', error);
      reject(error);
    }
  });
}

/**
 * Get user input via speech
 * @param {number} maxDurationSec - Maximum recording duration in seconds
 * @returns {Promise<string>} - The transcribed text
 */
async function getSpeechInput(maxDurationSec = 10) {
  try {
    console.log('[STT] Listening for speech input...');

    // Record audio from the microphone
    const audioBuffer = await recordAudio(maxDurationSec);

    if (!audioBuffer || audioBuffer.length === 0) {
      console.warn('[STT] No audio recorded');
      return '';
    }

    console.log(`[STT] Audio recorded (${audioBuffer.length} bytes), transcribing...`);

    // Transcribe the audio
    const result = await transcribeSpeech(audioBuffer, 'audio/wav');

    if (result.noSpeechDetected) {
      console.warn('[STT] No speech detected in the recording');
      return '';
    }

    console.log(`[STT] Transcription: "${result.text}" (confidence: ${result.confidence})`);
    return result.text;
  } catch (error) {
    console.error('[STT] Error getting speech input:', error);
    return '';
  }
}

module.exports = {
  transcribeSpeech,
  checkGoogleCredentials,
  getSpeechInput
};
