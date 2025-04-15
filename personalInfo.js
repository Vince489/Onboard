const { promptPulseAgent } = require('../pulseAgent');

// Questions derived from breakdown.txt section 1
const PERSONAL_INFO_QUESTIONS = [
  "Let's start with the basics. What's your full name and what would you like me to call you?",
  "Which email address would you like PULSE to primarily monitor?",
  "Do you have any additional email addresses you'd like to include?",
  "What's your preferred language for communication?",
  "What time zone are you in?"
];

async function handlePersonalInfoSection(sessionState, userInput) {
  // Track progress through this section's questions
  const { currentQuestionIndex = 0 } = sessionState;
  
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "personalInfo",
    sessionState.profile
  );
  
  // Update session state
  let updatedState = {
    ...sessionState,
    profile: {
      ...sessionState.profile,
      personalInfo: {
        ...sessionState.profile.personalInfo,
        ...agentResponse.JSONUpdate.personalInfo
      }
    }
  };
  
  // Determine next question or section completion
  if (agentResponse.nextAction === "complete_section") {
    updatedState.currentSection = "professional"; // Move to next section
    updatedState.currentQuestionIndex = 0;
  } else {
    // Move to next question in this section
    updatedState.currentQuestionIndex = currentQuestionIndex + 1;
  }
  
  return {
    response: agentResponse.response,
    updatedState
  };
}

module.exports = {
  handlePersonalInfoSection,
  PERSONAL_INFO_QUESTIONS
};
