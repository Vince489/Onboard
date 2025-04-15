/**
 * PULSE™ Onboarding Agent - Onboarding Page JavaScript
 */

// Initialize variables
let currentSection = 'personalInfo';
let completedSections = [];
let profile = {};
let socket;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-btn');
const voiceButton = document.getElementById('voice-btn');
const optionButtons = document.querySelectorAll('.option-btn');
const sectionItems = document.querySelectorAll('.section-item');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');
const audioPlayer = document.getElementById('audio-player');
const userId = document.getElementById('user-id').dataset.userId;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  initializeSocket();
  loadProfile();
  addEventListeners();

  // Add welcome message
  setTimeout(() => {
    addAgentMessage('Welcome to the PULSE™ onboarding! I\'m Virtra, your personal onboarding agent. I\'ll help you configure your PULSE™ Smart Inbox through a conversational process. Let\'s start with some basic information about you.');
  }, 500);
});

// Initialize Socket.IO connection
function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('response', (data) => {
    // Hide typing indicator
    removeTypingIndicator();

    // Add agent message
    addAgentMessage(data.response);

    // Update profile
    if (data.profile) {
      profile = data.profile;
      updateProgress();
    }

    // Play audio if available
    if (data.audioUrl) {
      playAudio(data.audioUrl);
    }

    // Handle next action
    if (data.nextAction === 'complete_section') {
      completeSection(currentSection);
      moveToNextSection();
    } else if (data.nextAction === 'complete_onboarding') {
      completeSection(currentSection);
      showCompletionMessage();
    }
  });

  socket.on('error', (data) => {
    console.error('Socket error:', data.error);
    removeTypingIndicator();
    addAgentMessage('I\'m sorry, I encountered an error. Please try again.');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    addAgentMessage('Connection lost. Please refresh the page to reconnect.');
  });
}

// Load user profile
async function loadProfile() {
  try {
    const response = await fetch(`/api/profile`);
    const data = await response.json();

    if (data.profile) {
      profile = data.profile.profile || {};
      currentSection = data.profile.currentSection || 'personalInfo';
      completedSections = data.profile.completedSections || [];

      // Update UI
      updateSectionUI();
      updateProgress();
    }
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Add event listeners
function addEventListeners() {
  // Send message on button click
  sendButton.addEventListener('click', sendMessage);

  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Voice input
  voiceButton.addEventListener('click', toggleVoiceInput);

  // Option buttons
  optionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const command = button.dataset.command;
      handleCommand(command);
    });
  });

  // Section items
  sectionItems.forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (completedSections.includes(section) || section === currentSection) {
        switchToSection(section);
      }
    });
  });
}

// Send message to the agent
function sendMessage() {
  const message = messageInput.value.trim();

  if (!message) return;

  // Add user message to chat
  addUserMessage(message);

  // Clear input
  messageInput.value = '';

  // Show typing indicator
  addTypingIndicator();

  // Send message to server
  socket.emit('message', {
    message,
    section: currentSection,
    profile
  });
}

// Handle command
function handleCommand(command) {
  switch (command) {
    case 'help':
      sendCommandMessage('help');
      break;
    case 'skip':
      sendCommandMessage('skip');
      break;
    case 'back':
      sendCommandMessage('back');
      break;
    case 'progress':
      sendCommandMessage('progress');
      break;
    default:
      console.warn('Unknown command:', command);
  }
}

// Send command message
function sendCommandMessage(command) {
  addUserMessage(command);
  addTypingIndicator();

  socket.emit('message', {
    message: command,
    section: currentSection,
    profile
  });
}

// Toggle voice input
function toggleVoiceInput() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// Start voice recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Try to use a more compatible audio format
    let options = {};

    // Check if browser supports specific mime types
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      options = { mimeType: 'audio/webm;codecs=opus' };
    } else if (MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/webm' };
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      options = { mimeType: 'audio/mp4' };
    } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
      options = { mimeType: 'audio/ogg' };
    }

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    console.log(`Using audio format: ${mediaRecorder.mimeType}`);

    mediaRecorder.addEventListener('dataavailable', event => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener('stop', async () => {
      // Use the same mime type that was used for recording
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      await processAudioInput(audioBlob);

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
    });

    // Start recording
    mediaRecorder.start();
    isRecording = true;
    voiceButton.classList.add('recording');
    voiceButton.innerHTML = '<i class="fas fa-stop"></i>';

    // Add recording message
    addSystemMessage('Recording... Click the button again to stop.');

    // Auto-stop after 15 seconds
    setTimeout(() => {
      if (isRecording) {
        stopRecording();
      }
    }, 15000);

  } catch (error) {
    console.error('Error starting recording:', error);
    addSystemMessage('Could not access microphone. Please check your permissions.');
  }
}

// Stop voice recording
function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    voiceButton.classList.remove('recording');
    voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';

    // Add processing message
    addSystemMessage('Processing your speech...');
  }
}

// Process audio input
async function processAudioInput(audioBlob) {
  try {
    // Create form data
    const formData = new FormData();
    formData.append('audio', audioBlob);

    // Send to server for processing
    const response = await fetch('/api/stt', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    // Check for error responses
    if (response.status !== 200) {
      // Handle specific error types
      if (data.errorCode === 'DECODER_UNSUPPORTED') {
        addSystemMessage(data.text || 'Audio format not supported. Please try typing your response instead.');
        return;
      }

      // Handle other errors
      addSystemMessage(data.text || 'Error processing your speech. Please try typing instead.');
      return;
    }

    // Handle successful response with text
    if (data.text) {
      // Add user message
      addUserMessage(data.text);

      // Show typing indicator
      addTypingIndicator();

      // Send message to server
      socket.emit('message', {
        message: data.text,
        section: currentSection,
        profile
      });
    } else if (data.error) {
      // Handle error in the response
      addSystemMessage(data.text || 'Error processing your speech. Please try typing instead.');
    } else {
      // No speech detected
      addSystemMessage('I couldn\'t detect any speech. Please try again or type your response.');
    }
  } catch (error) {
    console.error('Error processing audio:', error);
    addSystemMessage('Error processing your speech. Please try typing instead.');
  }
}

// Add user message to chat
function addUserMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message user';

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';
  contentElement.textContent = message;

  const metaElement = document.createElement('div');
  metaElement.className = 'message-meta';

  const timeElement = document.createElement('span');
  timeElement.className = 'message-time';
  timeElement.textContent = getCurrentTime();

  metaElement.appendChild(timeElement);
  messageElement.appendChild(contentElement);
  messageElement.appendChild(metaElement);

  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

// Add agent message to chat
function addAgentMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message agent';

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';
  contentElement.textContent = message;

  const metaElement = document.createElement('div');
  metaElement.className = 'message-meta';

  const nameElement = document.createElement('span');
  nameElement.className = 'message-name';
  nameElement.textContent = 'Virtra';

  const timeElement = document.createElement('span');
  timeElement.className = 'message-time';
  timeElement.textContent = getCurrentTime();

  metaElement.appendChild(nameElement);
  metaElement.appendChild(timeElement);
  messageElement.appendChild(contentElement);
  messageElement.appendChild(metaElement);

  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

// Add system message to chat
function addSystemMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.className = 'message system';

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';
  contentElement.textContent = message;

  messageElement.appendChild(contentElement);
  chatMessages.appendChild(messageElement);
  scrollToBottom();
}

// Add typing indicator
function addTypingIndicator() {
  // Remove existing indicator if any
  removeTypingIndicator();

  const indicatorElement = document.createElement('div');
  indicatorElement.className = 'typing-indicator';
  indicatorElement.innerHTML = 'Virtra is typing <span></span><span></span><span></span>';

  chatMessages.appendChild(indicatorElement);
  scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
  const indicator = document.querySelector('.typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

// Get current time in HH:MM format
function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Scroll chat to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update section UI
function updateSectionUI() {
  sectionItems.forEach(item => {
    const section = item.dataset.section;

    // Reset classes
    item.classList.remove('active', 'completed');

    // Add appropriate class
    if (section === currentSection) {
      item.classList.add('active');
    } else if (completedSections.includes(section)) {
      item.classList.add('completed');
      item.querySelector('.section-status i').className = 'fas fa-check-circle';
    } else {
      item.querySelector('.section-status i').className = 'fas fa-circle-notch';
    }
  });
}

// Update progress
function updateProgress() {
  const totalSections = sectionItems.length;
  const completedCount = completedSections.length;
  const progressPercent = Math.floor((completedCount / totalSections) * 100);

  progressFill.style.width = `${progressPercent}%`;
  progressText.textContent = `${progressPercent}% Complete`;
}

// Complete current section
function completeSection(section) {
  if (!completedSections.includes(section)) {
    completedSections.push(section);
    updateSectionUI();
    updateProgress();

    // Save progress
    saveProgress();
  }
}

// Move to next section
function moveToNextSection() {
  const currentIndex = Array.from(sectionItems).findIndex(item => item.dataset.section === currentSection);

  if (currentIndex < sectionItems.length - 1) {
    const nextSection = sectionItems[currentIndex + 1].dataset.section;
    switchToSection(nextSection);
  }
}

// Switch to a specific section
function switchToSection(section) {
  currentSection = section;
  updateSectionUI();

  // Add section transition message
  addSystemMessage(`Switching to ${formatSectionName(section)} section`);

  // Save progress
  saveProgress();
}

// Save progress
async function saveProgress() {
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profile,
        currentSection,
        completedSections
      })
    });
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

// Show completion message
function showCompletionMessage() {
  addAgentMessage('Congratulations! You\'ve completed the PULSE™ onboarding process. Your Smart Inbox is now configured according to your preferences.');

  // Add completion button
  const completionElement = document.createElement('div');
  completionElement.className = 'completion-message';
  completionElement.innerHTML = `
    <h3>Onboarding Complete!</h3>
    <p>Your PULSE™ Smart Inbox is ready to use.</p>
    <button class="btn primary-btn" onclick="window.location.href='/'">Return to Home</button>
  `;

  chatMessages.appendChild(completionElement);
  scrollToBottom();
}

// Format section name
function formatSectionName(sectionName) {
  return sectionName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
}

// Play audio
function playAudio(url) {
  audioPlayer.src = url;
  audioPlayer.play().catch(error => {
    console.warn('Error playing audio:', error);
  });
}
