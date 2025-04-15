const { promptPulseAgent } = require('../pulseAgent');
const { mergeProfileUpdate } = require('../pulseSchema');
const { 
  generateSectionWelcome, 
  getSectionQuestions 
} = require('../../utils/conversationHelpers');

// Questions for the professional section
const PROFESSIONAL_QUESTIONS = [
  "What's your current occupation or role?",
  "What industry or sector do you work in?",
  "What are your key responsibilities?",
  "What areas of interest generate significant email for you?",
  "Who do you report to or work with closely?"
];

// Handle the professional section of the onboarding
async function handleSection(sessionState, userInput) {
  // Get the current question index or default to 0
  const { currentQuestionIndex = 0 } = sessionState;
  
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "professional",
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
    updatedState.currentSection = "communication";
    updatedState.currentQuestionIndex = 0;
    
    // Add a summary of what we learned
    const professional = updatedState.profile.professional || {};
    const summary = `
Great! I've collected information about your professional context:
- Role: ${professional.role || 'Not provided'}
- Industry: ${professional.industry || 'Not provided'}
- Responsibilities: ${professional.responsibilities ? professional.responsibilities.join(', ') : 'Not provided'}
- Areas of interest: ${professional.areasOfInterest ? professional.areasOfInterest.join(', ') : 'Not provided'}

Now, let's talk about your communication patterns.
`;
    
    return {
      response: summary,
      updatedState
    };
  } else {
    // Move to next question
    const nextQuestionIndex = Math.min(
      currentQuestionIndex + 1, 
      PROFESSIONAL_QUESTIONS.length - 1
    );
    
    updatedState.currentQuestionIndex = nextQuestionIndex;
    
    // If this is the first question, add the section welcome
    let response = agentResponse.response;
    if (currentQuestionIndex === 0) {
      response = `${generateSectionWelcome('professional')}\n\n${response}`;
    }
    
    // Add the next question if the agent didn't already include one
    if (!response.includes('?')) {
      response += `\n\n${PROFESSIONAL_QUESTIONS[nextQuestionIndex]}`;
    }
    
    return {
      response,
      updatedState
    };
  }
}

module.exports = {
  handleSection,
  PROFESSIONAL_QUESTIONS
};
