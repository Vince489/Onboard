/**
 * API Routes for PULSE™ Onboarding Agent
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import services
const sttService = require('../services/stt');
const ttsService = require('../services/tts');
const db = require('../database');
const { pulseSchema, mergeProfileUpdate } = require('../agent/pulseSchema');
const { promptPulseAgent } = require('../agent/pulseAgent');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../cache/audio');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Speech-to-Text endpoint
router.post('/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Read the file
    const audioBuffer = await fs.readFile(req.file.path);

    // Determine content type
    let contentType = req.file.mimetype;
    if (!contentType) {
      // Try to infer from extension
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext === '.wav') contentType = 'audio/wav';
      else if (ext === '.mp3') contentType = 'audio/mp3';
      else if (ext === '.ogg') contentType = 'audio/ogg';
      else if (ext === '.webm') contentType = 'audio/webm';
      else contentType = 'audio/wav'; // Default
    }

    // Transcribe the audio
    const result = await sttService.transcribeSpeech(audioBuffer, contentType);

    // Clean up the file
    await fs.unlink(req.file.path).catch(err => console.warn('Error deleting temp file:', err));

    res.json(result);
  } catch (error) {
    console.error('Error in STT endpoint:', error);

    // If the error has a specific message about DECODER routines
    if (error.message && error.message.includes('DECODER routines::unsupported')) {
      return res.status(400).json({
        error: 'Audio format not supported',
        text: "I couldn't process your audio due to a format issue. Could you please type your response instead?",
        errorCode: 'DECODER_UNSUPPORTED'
      });
    }

    // For other errors
    res.status(500).json({
      error: 'Failed to process speech',
      text: "I'm having trouble processing your speech right now. Could you please type your response instead?"
    });
  }
});

// Message endpoint
router.post('/message', async (req, res) => {
  try {
    const { message, section, profile } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'No user session found' });
    }

    // Get agent response
    const agentResponse = await promptPulseAgent(
      message,
      section || 'personalInfo',
      profile || {}
    );

    // Update profile with new information
    const updatedProfile = mergeProfileUpdate(
      profile || JSON.parse(JSON.stringify(pulseSchema)),
      agentResponse.JSONUpdate
    );

    // Save updated profile
    await db.saveProfile(userId, {
      profile: updatedProfile,
      currentSection: section,
      completedSections: profile?.completedSections || []
    });

    // Generate speech if TTS is available
    let audioUrl = null;
    try {
      const audioPath = await ttsService.synthesizeSpeech(
        agentResponse.response,
        section in ttsService.VOICE_PROFILES ? section : 'virtra'
      );

      if (audioPath) {
        // Convert file path to URL
        const filename = path.basename(audioPath);
        audioUrl = `/audio/${filename}`;
      }
    } catch (ttsError) {
      console.warn('Error generating speech:', ttsError);
    }

    // Return response
    res.json({
      response: agentResponse.response,
      profile: updatedProfile,
      nextAction: agentResponse.nextAction,
      audioUrl
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Profile endpoints
router.get('/profile', async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'No user session found' });
    }

    // Load profile
    const profile = await db.loadProfile(userId);

    res.json({ profile: profile || null });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.post('/profile', async (req, res) => {
  try {
    const { profile, currentSection, completedSections } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'No user session found' });
    }

    // Save profile
    await db.saveProfile(userId, {
      profile,
      currentSection,
      completedSections
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

// TTS endpoint
router.get('/tts', async (req, res) => {
  try {
    const { text, persona } = req.query;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Generate speech
    const audioPath = await ttsService.synthesizeSpeech(
      text,
      persona || 'virtra'
    );

    if (!audioPath) {
      return res.status(500).json({ error: 'Failed to generate speech' });
    }

    // Send audio file
    res.sendFile(path.resolve(audioPath));
  } catch (error) {
    console.error('Error generating speech:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Reset onboarding endpoint
router.post('/reset', async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'No user session found' });
    }

    // Delete user profile
    await db.deleteProfile(userId);

    // Clear chat instance
    if (typeof promptPulseAgent.clearChatInstances === 'function') {
      promptPulseAgent.clearChatInstances(userId);
    }

    res.json({ success: true, message: 'Onboarding reset successfully' });
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

// Clear agent memory endpoint
router.post('/clear-memory', async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ error: 'No user session found' });
    }

    // Clear chat instance
    if (typeof promptPulseAgent.clearChatInstances === 'function') {
      promptPulseAgent.clearChatInstances(userId);
    }

    res.json({ success: true, message: 'Agent memory cleared successfully' });
  } catch (error) {
    console.error('Error clearing agent memory:', error);
    res.status(500).json({ error: 'Failed to clear agent memory' });
  }
});

// Serve cached audio files
router.get('/audio/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const audioPath = path.join(__dirname, '../cache/audio', filename);

    // Check if file exists
    await fs.access(audioPath);

    // Send file
    res.sendFile(path.resolve(audioPath));
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(404).json({ error: 'Audio file not found' });
  }
});

module.exports = router;
