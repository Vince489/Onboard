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
let autoStartSection = true; // Flag to control auto-starting sections

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

  // Add welcome message and auto-start first section
  setTimeout(() => {
    addAgentMessage('Welcome to the PULSE™ onboarding! I\'m Virtra, your personal onboarding agent. I\'ll help you configure your PULSE™ Smart Inbox through a conversational process. Let\'s start with some basic information about you.');

    // Auto-start the first section after welcome message
    if (autoStartSection) {
      setTimeout(() => {
        addTypingIndicator();

        setTimeout(() => {
          // Send an empty message to start the section
          socket.emit('message', {
            message: `start ${currentSection}`,
            section: currentSection,
            profile
          });
        }, 1000);
      }, 1500);
    }
  }, 500);

  // Add reset and clear memory buttons to the options
  addManagementButtons();
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

    // Check if the response contains a question or is asking for more information
    const isAskingForMoreInfo = data.response.includes('?') ||
                               data.response.toLowerCase().includes('tell me') ||
                               data.response.toLowerCase().includes('what about') ||
                               data.response.toLowerCase().includes('anything else') ||
                               data.response.toLowerCase().includes('should know');

    // Check if this is a skip response
    const isSkipResponse = data.response.toLowerCase().includes('skip this section') ||
                          data.response.toLowerCase().includes('like to skip');

    // Handle next action - only show completion if not asking for more info
    // For skip responses, we always want to show the completion prompt
    if (data.nextAction === 'complete_section' && (isSkipResponse || !isAskingForMoreInfo)) {
      // Mark section as complete and show completion prompt
      // The prompt will have a button to continue to next section
      completeSection(currentSection);
      // Note: moveToNextSection() is now called from the button click handler
    } else if (data.nextAction === 'complete_onboarding' && !isAskingForMoreInfo) {
      // For the final section
      completeSection(currentSection);
      // Note: showCompletionMessage() is now called from the button click handler
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
      // Show a confirmation dialog before skipping
      if (confirm('Are you sure you want to skip this section? Completing all sections provides the best experience with your PULSE™ Smart Inbox.')) {
        // Add a system message about skipping
        addSystemMessage('Skipping the current section. You can always come back to it later.');

        // Add a special skip message that will be handled differently
        addUserMessage('skip section');
        addTypingIndicator();

        // Send a special skip message to the server
        socket.emit('message', {
          message: 'skip_section_command',
          section: currentSection,
          profile
        });
      }
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

// Add section completion prompt
function addSectionCompletionPrompt(section) {
  const isLastSection = section === 'consent';
  const promptElement = document.createElement('div');
  promptElement.className = 'section-completion-prompt';

  // Check if this was likely a skipped section
  const lastMessage = document.querySelector('.message:last-of-type');
  const isSkipped = lastMessage && lastMessage.textContent.toLowerCase().includes('skip this section');

  // Different message for the final section
  if (isLastSection) {
    promptElement.innerHTML = `
      <div class="completion-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h3>Section Complete!</h3>
      <p>You've completed the ${formatSectionName(section)} section.</p>
      <p>This is the final section of the onboarding process.</p>
      <button class="btn primary-btn continue-btn">Complete Onboarding</button>
    `;
  } else if (isSkipped) {
    promptElement.innerHTML = `
      <div class="completion-icon">
        <i class="fas fa-forward"></i>
      </div>
      <h3>Section Skipped</h3>
      <p>You've chosen to skip the ${formatSectionName(section)} section.</p>
      <p><small>You can always come back to complete this section later for a better personalized experience.</small></p>
      <button class="btn primary-btn continue-btn">Continue to Next Section</button>
    `;
  } else {
    promptElement.innerHTML = `
      <div class="completion-icon">
        <i class="fas fa-check-circle"></i>
      </div>
      <h3>Section Complete!</h3>
      <p>You've completed the ${formatSectionName(section)} section.</p>
      <button class="btn primary-btn continue-btn">Continue to Next Section</button>
    `;
  }

  chatMessages.appendChild(promptElement);
  scrollToBottom();

  // Add event listener to the continue button
  const continueBtn = promptElement.querySelector('.continue-btn');
  continueBtn.addEventListener('click', () => {
    if (isLastSection) {
      showCompletionMessage();
    } else {
      moveToNextSection();
    }
    promptElement.remove();
  });
}

// Complete current section
function completeSection(section) {
  if (!completedSections.includes(section)) {
    completedSections.push(section);
    updateSectionUI();
    updateProgress();

    // Save progress
    saveProgress();

    // Add completion prompt instead of automatically moving to next section
    addSectionCompletionPrompt(section);
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

  // Auto-start the section with a typing indicator and delay
  if (autoStartSection) {
    addTypingIndicator();

    setTimeout(() => {
      // Send an empty message to start the section
      socket.emit('message', {
        message: `start ${section}`,
        section: currentSection,
        profile
      });
    }, 1000);
  }

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
  // Add a delay before showing the completion message
  setTimeout(() => {
    // Add agent message
    addAgentMessage('Congratulations! You\'ve completed the PULSE™ onboarding process. Your Smart Inbox is now configured according to your preferences.');

    // Add system message explaining next steps
    setTimeout(() => {
      addSystemMessage('Your profile has been saved and will be used to personalize your PULSE™ Smart Inbox experience.');
    }, 1000);

    // Add enhanced completion message with animation
    setTimeout(() => {
      const completionElement = document.createElement('div');
      completionElement.className = 'completion-message animated';
      completionElement.innerHTML = `
        <div class="completion-icon">
          <i class="fas fa-check-circle"></i>
        </div>
        <h3>Onboarding Complete!</h3>
        <p class="completion-summary">All 10 sections completed successfully</p>
        <p>Your PULSE™ Smart Inbox is now configured and ready to use.</p>
        <div class="completion-actions">
          <button class="btn primary-btn" onclick="window.location.href='/'">Return to Home</button>
          <button class="btn secondary-btn" onclick="resetOnboarding()">Start Over</button>
        </div>
      `;

      chatMessages.appendChild(completionElement);
      scrollToBottom();

      // Add animation class after a small delay
      setTimeout(() => {
        completionElement.classList.add('show');
      }, 100);
    }, 2000);
  }, 500);
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

// Reset onboarding
async function resetOnboarding() {
  // Show confirmation dialog
  if (!confirm('Are you sure you want to reset your onboarding progress? This will delete all your data and start over.')) {
    return;
  }

  try {
    // Call the reset API
    const response = await fetch('/api/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      // Clear local variables
      currentSection = 'personalInfo';
      completedSections = [];
      profile = {};

      // Clear chat messages
      chatMessages.innerHTML = '';

      // Update UI
      updateSectionUI();
      updateProgress();

      // Add system message
      addSystemMessage('Onboarding has been reset. Starting over from the beginning.');

      // Auto-start the first section
      setTimeout(() => {
        addTypingIndicator();

        setTimeout(() => {
          // Add welcome message
          removeTypingIndicator();
          addAgentMessage('Welcome to the PULSE™ onboarding! I\'m Virtra, your personal onboarding agent. I\'ll help you configure your PULSE™ Smart Inbox through a conversational process. Let\'s start with some basic information about you.');

          // Start the first section
          setTimeout(() => {
            addTypingIndicator();

            setTimeout(() => {
              socket.emit('message', {
                message: 'start personalInfo',
                section: currentSection,
                profile
              });
            }, 1000);
          }, 1500);
        }, 1500);
      }, 500);
    } else {
      addSystemMessage('Error resetting onboarding. Please try again.');
    }
  } catch (error) {
    console.error('Error resetting onboarding:', error);
    addSystemMessage('Error resetting onboarding. Please try again.');
  }
}

// Clear agent memory
async function clearAgentMemory() {
  // Show confirmation dialog
  if (!confirm('Are you sure you want to clear the agent\'s memory? This will reset the conversation context but keep your profile data.')) {
    return;
  }

  try {
    // Call the clear memory API
    const response = await fetch('/api/clear-memory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.success) {
      // Add system message
      addSystemMessage('Agent memory has been cleared. The agent will not remember previous conversations but your profile data is preserved.');
    } else {
      addSystemMessage('Error clearing agent memory. Please try again.');
    }
  } catch (error) {
    console.error('Error clearing agent memory:', error);
    addSystemMessage('Error clearing agent memory. Please try again.');
  }
}

// Add management buttons to the options container
function addManagementButtons() {
  const inputOptions = document.querySelector('.input-options');

  // Create reset button
  const resetButton = document.createElement('button');
  resetButton.className = 'option-btn danger-btn';
  resetButton.textContent = 'Reset Onboarding';
  resetButton.addEventListener('click', resetOnboarding);

  // Create clear memory button
  const clearMemoryButton = document.createElement('button');
  clearMemoryButton.className = 'option-btn warning-btn';
  clearMemoryButton.textContent = 'Clear Agent Memory';
  clearMemoryButton.addEventListener('click', clearAgentMemory);

  // Add buttons to the options container
  inputOptions.appendChild(document.createElement('hr'));
  inputOptions.appendChild(resetButton);
  inputOptions.appendChild(clearMemoryButton);
}
