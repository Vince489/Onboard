const { promptPulseAgent } = require('../pulseAgent');
const { mergeProfileUpdate } = require('../pulseSchema');
const { 
  generateSectionWelcome, 
  getSectionQuestions, 
  extractPotentialData 
} = require('../../utils/conversationHelpers');

// Questions for the personal info section
const PERSONAL_INFO_QUESTIONS = [
  "Let's start with the basics. What's your full name?",
  "What would you like me to call you (preferred name or nickname)?",
  "Which email address would you like PULSE to primarily monitor?",
  "Do you have any additional email addresses you'd like to include?",
  "What's your preferred language for communication?",
  "What time zone are you in?"
];

// Handle the personal info section of the onboarding
async function handleSection(sessionState, userInput) {
  // Get the current question index or default to 0
  const { currentQuestionIndex = 0 } = sessionState;
  
  // Extract any potential data from the user input
  const extractedData = extractPotentialData(userInput, 'personalInfo');
  
  // Get agent response
  const agentResponse = await promptPulseAgent(
    userInput, 
    "personalInfo",
    sessionState.profile
  );
  
  // Merge extracted data with agent's JSON update
  const combinedUpdate = {
    personalInfo: {
      ...extractedData,
      ...(agentResponse.JSONUpdate.personalInfo || {})
    }
  };
  
  // Update session state
  let updatedState = {
    ...sessionState,
    profile: mergeProfileUpdate(sessionState.profile, combinedUpdate)
  };
  
  // Determine next question or section completion
  if (agentResponse.nextAction === "complete_section") {
    // Move to next section
    updatedState.currentSection = "professional";
    updatedState.currentQuestionIndex = 0;
    
    // Add a summary of what we learned
    const summary = `
      Great! I've collected your personal information:
      - Name: ${updatedState.profile.personalInfo.fullName || 'Not provided'}
      - Preferred name: ${updatedState.profile.personalInfo.preferredName || 'Not provided'}
      - Primary email: ${updatedState.profile.personalInfo.primaryEmail || 'Not provided'}
      - Language: ${updatedState.profile.personalInfo.preferredLanguage || 'Not provided'}
      - Time zone: ${updatedState.profile.personalInfo.timeZone || 'Not provided'}

      Now, let's move on to understanding your professional context.
      `;
    
    return {
      response: summary,
      updatedState
    };
  } else {
    // Determine the next question to ask
    let nextQuestionIndex = currentQuestionIndex;
    
    // If we extracted data or the agent provided data, we can potentially skip questions
    if (extractedData.fullName || (agentResponse.JSONUpdate.personalInfo && agentResponse.JSONUpdate.personalInfo.fullName)) {
      // Skip the name question if we already have it
      if (nextQuestionIndex === 0) nextQuestionIndex = 1;
    }
    
    if (extractedData.primaryEmail || (agentResponse.JSONUpdate.personalInfo && agentResponse.JSONUpdate.personalInfo.primaryEmail)) {
      // Skip the email question if we already have it
      if (nextQuestionIndex === 2) nextQuestionIndex = 3;
    }
    
    // Move to next question or stay on current if we couldn't extract anything
    nextQuestionIndex = Math.min(
      nextQuestionIndex + 1, 
      PERSONAL_INFO_QUESTIONS.length - 1
    );
    
    updatedState.currentQuestionIndex = nextQuestionIndex;
    
    // If this is the first question, add the section welcome
    let response = agentResponse.response;
    if (currentQuestionIndex === 0) {
      response = `${generateSectionWelcome('personalInfo')}\n\n${response}`;
    }
    
    // Add the next question if the agent didn't already include one
    if (!response.includes('?')) {
      response += `\n\n${PERSONAL_INFO_QUESTIONS[nextQuestionIndex]}`;
    }
    
    return {
      response,
      updatedState
    };
  }
}

module.exports = {
  handleSection,
  PERSONAL_INFO_QUESTIONS
};
