const { promptPulseAgent } = require('../pulseAgent');
const { mergeProfileUpdate } = require('../pulseSchema');
const { generateSectionWelcome } = require('../../utils/conversationHelpers');

// Placeholder implementation for the consent section handler
async function handleSection(sessionState, userInput) {
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "consent",
    sessionState.profile
  );
  
  // Update session state
  let updatedState = {
    ...sessionState,
    profile: mergeProfileUpdate(
      sessionState.profile, 
      agentResponse.JSONUpdate
    )
  };
  
  // For consent, we need to check if they've explicitly consented
  const consentGiven = userInput.toLowerCase().includes('yes') || 
                      userInput.toLowerCase().includes('agree') ||
                      userInput.toLowerCase().includes('consent');
                      
  if (consentGiven) {
    updatedState.profile.consent = {
      ...updatedState.profile.consent,
      dataProcessingConsent: true
    };
  }
  
  // Determine next action
  if (agentResponse.nextAction === "complete_section" || consentGiven) {
    // This is the last section, so we'll mark onboarding as complete
    updatedState.completedSections = [
      ...sessionState.completedSections,
      "consent"
    ];
    
    // Final response
    return {
      response: `Thank you for providing your consent! This completes the onboarding process. Your PULSE™ agent is now configured according to your preferences and ready to assist you with your email management.`,
      updatedState
    };
  } else {
    updatedState.currentQuestionIndex = (sessionState.currentQuestionIndex || 0) + 1;
  }
  
  // If this is the first question, add the section welcome
  let response = agentResponse.response;
  if ((sessionState.currentQuestionIndex || 0) === 0) {
    response = `${generateSectionWelcome('consent')}\n\n${response}`;
  }
  
  return {
    response,
    updatedState
  };
}

module.exports = {
  handleSection
};
