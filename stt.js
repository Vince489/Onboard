/**
 * Speech-to-Text Service
 *
 * Provides functionality for converting speech to text using Google Cloud Speech-to-Text.
 */

import speech from '@google-cloud/speech';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the directory name (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a client using the credentials set in app.js
let client;
try {
  // Create the client using GOOGLE_APPLICATION_CREDENTIALS
  client = new speech.SpeechClient();
  console.log('Google Speech-to-Text client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Speech-to-Text client:', error);
  console.error('Error details:', error.message);
}

/**
 * Transcribe speech from an audio buffer
 * @param {Buffer} audioBuffer - The audio buffer to transcribe
 * @param {string} contentType - The MIME type of the audio (e.g., 'audio/wav', 'audio/mp3')
 * @returns {Promise<object>} - The transcription result
 */
export async function transcribeSpeech(audioBuffer, contentType) {
  try {
    console.log(`Transcribing audio with content type: ${contentType}`);

    // Validate inputs
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer provided');
    }

    if (!contentType) {
      console.warn('No content type provided, defaulting to LINEAR16');
    }

    // Determine encoding based on content type
    let encoding = 'LINEAR16';
    if (contentType?.includes('mp3')) {
      encoding = 'MP3';
    } else if (contentType?.includes('ogg')) {
      encoding = 'OGG_OPUS';
    } else if (contentType?.includes('webm')) {
      encoding = 'WEBM_OPUS';
    }

    // Check if the audio buffer starts with a WebM header
    if (audioBuffer.length > 4 && audioBuffer.slice(0, 4).toString('hex').includes('1a45dfa3')) {
      console.log('Detected WebM header in audio buffer');
      encoding = 'WEBM_OPUS';
    }

    console.log(`Using encoding: ${encoding}`);

    // Check if Google credentials are available
    if (!client) {
      console.warn('Google Speech-to-Text client not available, using fallback mode');
      console.log('GOOGLE_CLOUD_CREDENTIALS available:', !!process.env.GOOGLE_CLOUD_CREDENTIALS);
      console.log('GOOGLE_APPLICATION_CREDENTIALS available:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS);
      return useFallbackTranscription(audioBuffer, contentType);
    }

    // Configure the request
    const config = {
      encoding: encoding,
      // Don't specify sampleRateHertz to let Google auto-detect it
      // sampleRateHertz: 16000,
      languageCode: 'en-US',
      model: 'default',
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: false,
      // Add audio channel count
      audioChannelCount: 1,
      // Enable enhanced models for better accuracy
      useEnhanced: true,
      // Add model options for better speech recognition
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
      // config.sampleRateHertz = 44100;
    }

    console.log('Using speech recognition config:', JSON.stringify(config, null, 2));

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
      .join('\\n');

    // Get the confidence score
    const confidence = response.results.length > 0
      ? response.results[0].alternatives[0].confidence
      : 0;

    // If no transcription was found, return a fallback message
    if (!transcription) {
      console.log('No speech detected in the audio');
      return {
        text: "I couldn't detect any speech in the audio. Please try speaking more clearly or check your microphone.",
        confidence: 0,
        audioLength: response.totalBilledTime?.seconds || 0,
        noSpeechDetected: true
      };
    }

    return {
      text: transcription,
      confidence: confidence,
      audioLength: response.totalBilledTime?.seconds || 0,
    };
  } catch (error) {
    console.error('Error in transcribeSpeech:', error);

    // Provide more specific error messages
    if (error.code === 7) {
      throw new Error('Google API permission denied. Check your credentials.');
    } else if (error.code === 3) {
      throw new Error('Invalid audio format. Check the audio encoding.');
    } else if (error.code === 13) {
      throw new Error('Google API quota exceeded.');
    } else if (error.message && error.message.includes('GOOGLE_APPLICATION_CREDENTIALS')) {
      throw new Error('Google credentials not properly configured.');
    } else {
      throw new Error(`Speech-to-text error: ${error.message || 'Unknown error'}`);
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
  console.log('Using fallback transcription mode');
  console.log(`Audio buffer size: ${audioBuffer ? audioBuffer.length : 'null'} bytes`);
  console.log(`Content type: ${contentType || 'not provided'}`);

  // Check if we have GOOGLE_CLOUD_CREDENTIALS but it's not being parsed correctly
  let credentialIssue = '';
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      // Try to parse the credentials to see if that's the issue
      JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS.replace(/^'|'$/g, ''));
      credentialIssue = 'Credentials are present but not being used correctly.';
    } catch (e) {
      credentialIssue = `Credentials are present but not valid JSON: ${e.message}`;
    }
  } else {
    credentialIssue = 'GOOGLE_CLOUD_CREDENTIALS environment variable is not set.';
  }

  // In a real implementation, you might want to use a different speech-to-text service
  // or implement a simple speech recognition algorithm

  // For now, we'll just return a mock response with diagnostic information
  return {
    text: `I received your audio but I'm using fallback mode because Google Cloud Speech-to-Text is not configured properly. ${credentialIssue}`,
    confidence: 1.0,
    audioLength: audioBuffer ? audioBuffer.length : 0,
    fallbackMode: true,
    diagnosticInfo: {
      hasGoogleCloudCredentials: !!process.env.GOOGLE_CLOUD_CREDENTIALS,
      hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      contentType: contentType || 'not provided'
    }
  };
}

/**
 * Utility function to check and debug Google Cloud credentials
 * @returns {object} - Information about the credentials
 */
export function checkGoogleCredentials() {
  const result = {
    hasGoogleCloudCredentials: !!process.env.GOOGLE_CLOUD_CREDENTIALS,
    hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    clientInitialized: !!client,
    googleCloudCredentialsValid: false,
    googleApplicationCredentialsValid: false,
    issues: []
  };

  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    try {
      // Check if the credentials can be parsed as JSON
      const credStr = process.env.GOOGLE_CLOUD_CREDENTIALS.replace(/^'|'$/g, '');
      const creds = JSON.parse(credStr);

      // Check if the credentials have the required fields
      const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
      const missingFields = requiredFields.filter(field => !creds[field]);

      if (missingFields.length > 0) {
        result.issues.push(`GOOGLE_CLOUD_CREDENTIALS is missing required fields: ${missingFields.join(', ')}`);
      } else {
        result.googleCloudCredentialsValid = true;
      }
    } catch (e) {
      result.issues.push(`GOOGLE_CLOUD_CREDENTIALS is not valid JSON: ${e.message}`);
      // Log a small portion of the credentials to help debug
      const credStr = process.env.GOOGLE_CLOUD_CREDENTIALS;
      result.credentialPreview = credStr.substring(0, 50) + '...';
    }
  } else {
    result.issues.push('GOOGLE_CLOUD_CREDENTIALS is not set');
  }

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

export default {
  transcribeSpeech,
  checkGoogleCredentials
};
