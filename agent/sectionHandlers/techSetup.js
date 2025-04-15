const { promptPulseAgent } = require('../pulseAgent');
const { mergeProfileUpdate } = require('../pulseSchema');
const { generateSectionWelcome } = require('../../utils/conversationHelpers');

// Placeholder implementation for the techSetup section handler
async function handleSection(sessionState, userInput) {
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "techSetup",
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
  
  // Determine next action
  if (agentResponse.nextAction === "complete_section") {
    updatedState.currentSection = "priorities";
    updatedState.currentQuestionIndex = 0;
  } else {
    updatedState.currentQuestionIndex = (sessionState.currentQuestionIndex || 0) + 1;
  }
  
  // If this is the first question, add the section welcome
  let response = agentResponse.response;
  if ((sessionState.currentQuestionIndex || 0) === 0) {
    response = `${generateSectionWelcome('techSetup')}\n\n${response}`;
  }
  
  return {
    response,
    updatedState
  };
}

module.exports = {
  handleSection
};
