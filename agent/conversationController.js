const readline = require('readline');
const { pulseSchema, mergeProfileUpdate, calculateProfileCompletion } = require('./pulseSchema');
const { promptPulseAgent } = require('./pulseAgent');
const { saveProfile, loadProfile } = require('../storage/profileManager');

// Import TTS service
let ttsService;
try {
  ttsService = require('../services/tts');
  console.log('TTS service loaded successfully');
} catch (error) {
  console.warn('TTS service not available:', error.message);
  // Create a dummy TTS service instead of crashing the application when TTS isn't available
  ttsService = {
    speak: async (text) => Promise.resolve(), // Do nothing
    VOICE_PROFILES: {}
  };
}

// Import STT service
let sttService;
try {
  sttService = require('../services/stt');
  console.log('STT service loaded successfully');
} catch (error) {
  console.warn('STT service not available:', error.message);
  // Create a dummy TTS service instead of crashing the application when TTS isn't available
  sttService = {
    getSpeechInput: async () => Promise.resolve('') // Do nothing
  };
}

// Import section handlers
const personalInfoHandler = require('./sectionHandlers/personalInfo');
const professionalHandler = require('./sectionHandlers/professional');
const communicationHandler = require('./sectionHandlers/communication');
const goalsHandler = require('./sectionHandlers/goals');
const workflowHandler = require('./sectionHandlers/workflow');
const techSetupHandler = require('./sectionHandlers/techSetup');
const prioritiesHandler = require('./sectionHandlers/priorities');
const aiTrainingHandler = require('./sectionHandlers/aiTraining');
const personalizationHandler = require('./sectionHandlers/personalization');
const consentHandler = require('./sectionHandlers/consent');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Enhanced ask function with speech input support
async function ask(question) {
  // First, ask the question using text
  const textPrompt = await new Promise(resolve => rl.question(question, resolve));

  // Check if the user wants to use speech input
  if (textPrompt.toLowerCase() === 'voice' || textPrompt.toLowerCase() === 'speak') {
    console.log('\nSpeech input mode activated. Start speaking after the beep...');
    console.log('Press Enter when you\'re done speaking (or wait for timeout).\n');

    // Play a beep sound to indicate recording is starting
    process.stdout.write('\x07'); // ASCII bell character (beep)

    try {
      // Get speech input (max 15 seconds)
      const speechInput = await sttService.getSpeechInput(15);

      if (speechInput && speechInput.trim().length > 0) {
        console.log(`\nYou said: "${speechInput}"\n`);
        return speechInput;
      } else {
        console.log('\nNo speech detected or transcription failed. Please try typing your response.\n');
        return ask(question); // Try again
      }
    } catch (error) {
      console.error('Error with speech input:', error.message);
      console.log('\nFalling back to text input. Please type your response.\n');
      return ask(question); // Fall back to text input
    }
  }

  // Return the text input
  return textPrompt;
}

// Map section names to their handlers
const sectionHandlers = {
  personalInfo: personalInfoHandler,
  professional: professionalHandler,
  communication: communicationHandler,
  goals: goalsHandler,
  workflow: workflowHandler,
  techSetup: techSetupHandler,
  priorities: prioritiesHandler,
  aiTraining: aiTrainingHandler,
  personalization: personalizationHandler,
  consent: consentHandler
};

// Section order based on breakdown.txt
const sectionOrder = [
  "personalInfo",
  "professional",
  "communication",
  "goals",
  "workflow",
  "techSetup",
  "priorities",
  "aiTraining",
  "personalization",
  "consent"
];

// Helper function to display progress
function displayProgress(completedSections, currentSection) {
  const totalSections = sectionOrder.length;
  const completedCount = completedSections.length;
  const progressPercent = Math.floor((completedCount / totalSections) * 100);

  console.log(`\nProgress: ${progressPercent}% (${completedCount}/${totalSections} sections)`);
  console.log(`Current section: ${currentSection}`);

  // Display completed and remaining sections
  console.log("\nCompleted sections:");
  completedSections.forEach(section => console.log(`✅ ${section}`));

  console.log("\nRemaining sections:");
  const remainingSections = sectionOrder.filter(section => !completedSections.includes(section));
  remainingSections.forEach(section => console.log(`⬜ ${section}`));

  console.log("\n");
}

// Main onboarding function
async function runPulseOnboarding(userId) {
  // Initialize or load existing session
  let sessionState = {
    userId,
    currentSection: "personalInfo",
    currentQuestionIndex: 0,
    profile: JSON.parse(JSON.stringify(pulseSchema)), // Deep copy
    completedSections: []
  };

  // Try to load existing profile
  const existingProfile = await loadProfile(userId);
  if (existingProfile) {
    sessionState.profile = existingProfile.profile;
    sessionState.completedSections = existingProfile.completedSections || [];
    sessionState.currentSection = existingProfile.currentSection || "personalInfo";
    sessionState.currentQuestionIndex = existingProfile.currentQuestionIndex || 0;

    const welcomeBackMessage = "Welcome back to PULSE™ onboarding! " +
      `You've completed ${sessionState.completedSections.length} out of ${sectionOrder.length} sections. ` +
      `Let's continue with the "${sessionState.currentSection}" section.`;

    console.log(welcomeBackMessage);

    // Use TTS for welcome back message
    try {
      ttsService.speak(welcomeBackMessage, 'welcome');
    } catch (ttsError) {
      console.warn('Error using TTS for welcome message:', ttsError.message);
    }
  } else {
    const welcomeMessage = "Welcome to the PULSE™ onboarding. I'll help configure your cognitive agent. " +
      "You can type 'help' at any time for assistance, 'skip' to move to the next section, " +
      "'voice' to use speech input, or 'exit' to save your progress and quit.";

    console.log(welcomeMessage);

    // Use TTS for welcome message
    try {
      ttsService.speak(welcomeMessage, 'welcome');
    } catch (ttsError) {
      console.warn('Error using TTS for welcome message:', ttsError.message);
    }
  }

  // Display initial progress
  displayProgress(sessionState.completedSections, sessionState.currentSection);

  // Main conversation loop
  while (true) {
    const currentSection = sessionState.currentSection;

    // Check if we've completed all sections
    if (sessionState.completedSections.length === sectionOrder.length) {
      const completionMessage = "\n🎉 Onboarding complete! Your PULSE™ agent is ready.";
      console.log(completionMessage);

      // Use TTS for completion message
      try {
        ttsService.speak("Congratulations! Onboarding complete! Your PULSE agent is now ready to assist you.", 'completion');
      } catch (ttsError) {
        console.warn('Error using TTS for completion message:', ttsError.message);
      }

      break;
    }

    // Get the handler for the current section
    const handler = sectionHandlers[currentSection];

    // Get user input
    const input = await ask("You: ");

    // Check for special commands
    if (input.toLowerCase() === "exit") {
      // Save current state before exiting
      await saveProfile(userId, {
        profile: sessionState.profile,
        completedSections: sessionState.completedSections,
        currentSection: sessionState.currentSection,
        currentQuestionIndex: sessionState.currentQuestionIndex
      });
      console.log("Onboarding progress saved. You can continue later.");
      break;
    } else if (input.toLowerCase() === "help") {
      console.log("\nHelp Menu:");
      console.log("- 'exit': Save progress and quit");
      console.log("- 'skip': Move to the next section");
      console.log("- 'back': Go back to the previous section");
      console.log("- 'progress': Show your current progress");
      console.log("- 'voice' or 'speak': Switch to speech input mode");
      console.log("- 'help': Show this help menu\n");
      continue;
    } else if (input.toLowerCase() === "skip") {
      // Move to the next section
      const currentIndex = sectionOrder.indexOf(currentSection);
      if (currentIndex < sectionOrder.length - 1) {
        sessionState.currentSection = sectionOrder[currentIndex + 1];
        sessionState.currentQuestionIndex = 0;
        console.log(`Skipping to the "${sessionState.currentSection}" section.`);
        displayProgress(sessionState.completedSections, sessionState.currentSection);
      } else {
        console.log("You're already in the last section!");
      }
      continue;
    } else if (input.toLowerCase() === "back") {
      // Go back to the previous section
      const currentIndex = sectionOrder.indexOf(currentSection);
      if (currentIndex > 0) {
        sessionState.currentSection = sectionOrder[currentIndex - 1];
        sessionState.currentQuestionIndex = 0;
        // Remove from completed sections if we're going back
        sessionState.completedSections = sessionState.completedSections
          .filter(section => section !== sessionState.currentSection);
        console.log(`Going back to the "${sessionState.currentSection}" section.`);
        displayProgress(sessionState.completedSections, sessionState.currentSection);
      } else {
        console.log("You're already in the first section!");
      }
      continue;
    } else if (input.toLowerCase() === "progress") {
      displayProgress(sessionState.completedSections, sessionState.currentSection);
      continue;
    }

    // Process with the appropriate section handler
    try {
      // If the handler doesn't exist yet, use the generic agent
      if (!handler || !handler.handleSection) {
        // Fallback to direct agent interaction
        const agentResponse = await promptPulseAgent(
          input,
          currentSection,
          sessionState.profile
        );

        const agentResponseText = agentResponse.response;
        console.log("Virtra:", agentResponseText);

        // Use TTS to speak the response
        try {
          // Determine the appropriate voice profile based on the section
          const voiceProfile = currentSection in ttsService.VOICE_PROFILES ?
            currentSection : 'virtra';

          // Speak the response asynchronously (don't await to avoid blocking)
          ttsService.speak(agentResponseText, voiceProfile);
        } catch (ttsError) {
          console.warn('Error using TTS:', ttsError.message);
        }

        // Update profile with new information
        sessionState.profile = mergeProfileUpdate(
          sessionState.profile,
          agentResponse.JSONUpdate
        );

        // Check if we should move to the next section
        if (agentResponse.nextAction === "complete_section") {
          // Add current section to completed sections if not already there
          if (!sessionState.completedSections.includes(currentSection)) {
            sessionState.completedSections.push(currentSection);
          }

          // Move to the next section
          const currentIndex = sectionOrder.indexOf(currentSection);
          if (currentIndex < sectionOrder.length - 1) {
            sessionState.currentSection = sectionOrder[currentIndex + 1];
            sessionState.currentQuestionIndex = 0;
            console.log(`\n--- Moving to ${sessionState.currentSection} ---\n`);
            displayProgress(sessionState.completedSections, sessionState.currentSection);
          } else {
            console.log("\n🎉 All sections completed!");
          }
        } else {
          // Stay in the current section, increment question index
          sessionState.currentQuestionIndex++;
        }
      } else {
        // Use the specialized section handler
        const { response, updatedState } = await handler.handleSection(
          sessionState,
          input
        );

        console.log("Virtra:", response);

        // Use TTS to speak the response
        try {
          // Determine the appropriate voice profile based on the section
          const voiceProfile = currentSection in ttsService.VOICE_PROFILES ?
            currentSection : 'virtra';

          // Speak the response asynchronously (don't await to avoid blocking)
          ttsService.speak(response, voiceProfile);
        } catch (ttsError) {
          console.warn('Error using TTS:', ttsError.message);
        }

        // Update session state
        sessionState = updatedState;

        // Check if we've moved to a new section
        if (updatedState.currentSection !== currentSection) {
          // Add current section to completed sections if not already there
          if (!sessionState.completedSections.includes(currentSection)) {
            sessionState.completedSections.push(currentSection);
          }

          console.log(`\n--- Moving to ${updatedState.currentSection} ---\n`);
          displayProgress(sessionState.completedSections, sessionState.currentSection);
        }
      }

      // Save progress after each interaction
      await saveProfile(userId, {
        profile: sessionState.profile,
        completedSections: sessionState.completedSections,
        currentSection: sessionState.currentSection,
        currentQuestionIndex: sessionState.currentQuestionIndex
      });

    } catch (e) {
      console.error("Error in conversation:", e);
      console.log("Virtra: I'm having trouble with that. Let's try again.");
    }
  }

  // Calculate and display profile completion
  const completionPercentage = calculateProfileCompletion(sessionState.profile);
  console.log(`\nProfile Completion: ${completionPercentage}%`);

  // Display final profile
  console.log("\nYour PULSE™ Configuration:");
  console.dir(sessionState.profile, { depth: null });

  rl.close();
  return sessionState.profile;
}

module.exports = {
  runPulseOnboarding
};
