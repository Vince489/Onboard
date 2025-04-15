const { promptPulseAgent } = require('../pulseAgent');
const { mergeProfileUpdate } = require('../pulseSchema');
const { generateSectionWelcome } = require('../../utils/conversationHelpers');

// Questions for the communication section
const COMMUNICATION_QUESTIONS = [
  "How would you describe your daily email volume? (Low, Medium, High)",
  "Who are your most frequent contacts?",
  "How quickly do people expect you to respond to emails?",
  "Besides email, what other communication channels do you use?",
  "What types of recurring emails do you receive?"
];

// Handle the communication section of the onboarding
async function handleSection(sessionState, userInput) {
  // Get the current question index or default to 0
  const { currentQuestionIndex = 0 } = sessionState;
  
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "communication",
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
  
  // Determine next question or section completion
  if (agentResponse.nextAction === "complete_section") {
    // Move to next section
    updatedState.currentSection = "goals";
    updatedState.currentQuestionIndex = 0;
    
    return {
      response: `Great! Now let's talk about your goals and what you're trying to accomplish.`,
      updatedState
    };
  } else {
    // Move to next question
    const nextQuestionIndex = Math.min(
      currentQuestionIndex + 1, 
      COMMUNICATION_QUESTIONS.length - 1
    );
    
    updatedState.currentQuestionIndex = nextQuestionIndex;
    
    // If this is the first question, add the section welcome
    let response = agentResponse.response;
    if (currentQuestionIndex === 0) {
      response = `${generateSectionWelcome('communication')}\n\n${response}`;
    }
    
    // Add the next question if the agent didn't already include one
    if (!response.includes('?')) {
      response += `\n\n${COMMUNICATION_QUESTIONS[nextQuestionIndex]}`;
    }
    
    return {
      response,
      updatedState
    };
  }
}

module.exports = {
  handleSection,
  COMMUNICATION_QUESTIONS
};
