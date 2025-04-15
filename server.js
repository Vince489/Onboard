/**
 * PULSE™ Onboarding Agent Web Server
 *
 * Express server with EJS templating for the PULSE™ Onboarding Agent web interface.
 */

// Import dependencies
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const socketIo = require('socket.io');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import database and agent modules
const db = require('./database');
const { pulseSchema, mergeProfileUpdate } = require('./agent/pulseSchema');
const { promptPulseAgent } = require('./agent/pulseAgent');
const ttsService = require('./services/tts');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Get MongoDB URI from environment variables
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const sessionSecret = process.env.SESSION_SECRET || 'pulse-onboarding-secret';

// Configure session store
const sessionStore = mongoUri
  ? MongoStore.create({
      mongoUrl: mongoUri,
      collectionName: 'sessions',
      ttl: 14 * 24 * 60 * 60, // 14 days
      autoRemove: 'native'
    })
  : null;

// Configure session middleware
const sessionMiddleware = session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  store: sessionStore || undefined,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 14 // 14 days
  }
});

// Set up middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Share session with Socket.IO
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Initialize database connection
db.initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  console.log('Continuing with file-based storage');
});

// Import routes
const apiRoutes = require('./routes/api');

// Routes
app.get('/', (req, res) => {
  // Initialize session if needed
  if (!req.session.userId) {
    req.session.userId = uuidv4();
  }

  res.render('index', {
    title: 'PULSE™ Onboarding Agent',
    userId: req.session.userId
  });
});

app.get('/onboarding', async (req, res) => {
  // Initialize session if needed
  if (!req.session.userId) {
    req.session.userId = uuidv4();
  }

  // Load existing profile if available
  let profile;
  try {
    profile = await db.loadProfile(req.session.userId);
  } catch (err) {
    console.error('Error loading profile:', err);
  }

  res.render('onboarding', {
    title: 'PULSE™ Onboarding',
    userId: req.session.userId,
    profile: profile || null,
    sections: [
      'personalInfo',
      'professional',
      'communication',
      'goals',
      'workflow',
      'techSetup',
      'priorities',
      'aiTraining',
      'personalization',
      'consent'
    ]
  });
});

// Use API routes
app.use('/api', apiRoutes);

// Serve cached audio files
app.get('/audio/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const audioPath = path.join(__dirname, 'cache/audio', filename);

    // Check if file exists
    await fs.access(audioPath);

    // Send file
    res.sendFile(path.resolve(audioPath));
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(404).json({ error: 'Audio file not found' });
  }
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected');

  // Get user ID from session
  const userId = socket.request.session.userId;

  if (userId) {
    // Join user-specific room
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  }

  // Handle messages
  socket.on('message', async (data) => {
    try {
      const { message, section, profile } = data;

      if (!userId) {
        socket.emit('error', { error: 'No user session found' });
        return;
      }

      // Special handling for skip command
      if (message === 'skip_section_command') {
        // Create a custom response for skipping
        const skipResponse = {
          response: "I understand you'd like to skip this section. While completing all sections provides the best personalized experience with your PULSE™ Smart Inbox, we can always come back to this later. Let's move on to the next section.",
          JSONUpdate: {},
          nextAction: "complete_section"
        };

        // Send the skip response
        socket.emit('response', {
          response: skipResponse.response,
          profile: profile,
          nextAction: skipResponse.nextAction
        });

        return;
      }

      // Normal message handling
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

      // Update completedSections if the agent indicates the section is complete
      // But only if the agent is not asking for more information
      let completedSections = profile?.completedSections || [];
      const isAskingForMoreInfo = agentResponse.response.includes('?') ||
                                 agentResponse.response.toLowerCase().includes('tell me') ||
                                 agentResponse.response.toLowerCase().includes('what about') ||
                                 agentResponse.response.toLowerCase().includes('anything else') ||
                                 agentResponse.response.toLowerCase().includes('should know');

      if (agentResponse.nextAction === 'complete_section' && !isAskingForMoreInfo && !completedSections.includes(section)) {
        completedSections.push(section);
        console.log(`Section ${section} completed and added to completedSections array`);
      }

      // Save updated profile
      await db.saveProfile(userId, {
        profile: updatedProfile,
        currentSection: section,
        completedSections: completedSections
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

      // Send response to client
      socket.emit('response', {
        response: agentResponse.response,
        profile: updatedProfile,
        nextAction: agentResponse.nextAction,
        audioUrl
      });
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { error: 'Failed to process message' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
