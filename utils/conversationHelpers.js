// Helper functions for conversation flow

// Format a section name for display
function formatSectionName(sectionName) {
  // Convert camelCase to Title Case with spaces
  const formatted = sectionName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
  
  return formatted;
}

// Generate a welcome message for a section
function generateSectionWelcome(sectionName) {
  const formattedName = formatSectionName(sectionName);
  
  const welcomeMessages = {
    personalInfo: `Let's start with your Personal Information. This helps me understand who you are and how to address you.`,
    professional: `Now, let's talk about your Professional Context. This helps me understand your work environment and responsibilities.`,
    communication: `Let's discuss your Communication Patterns. This will help me understand how you prefer to handle emails and messages.`,
    goals: `Let's talk about your Goals. What are you trying to accomplish that involves email communication?`,
    workflow: `Now for your Workflow Preferences. How do you like to organize your time and email habits?`,
    techSetup: `Let's configure your Technical Environment. What devices and tools do you use?`,
    priorities: `Let's establish your Priority Framework. This helps me understand what matters most to you.`,
    aiTraining: `Now for some AI Training examples. This helps me learn your specific preferences through examples.`,
    personalization: `Let's personalize your agent. How would you like me to communicate with you?`,
    consent: `Finally, let's confirm your Data Processing Consent. This ensures I respect your privacy preferences.`
  };
  
  return welcomeMessages[sectionName] || `Let's talk about your ${formattedName}.`;
}

// Generate section-specific questions
function getSectionQuestions(sectionName) {
  const questions = {
    personalInfo: [
      "What's your full name?",
      "What would you like me to call you?",
      "What's your primary email address that PULSE should monitor?",
      "Do you have any additional email addresses to include?",
      "What's your preferred language for communication?",
      "What time zone are you in?"
    ],
    professional: [
      "What's your current occupation or role?",
      "What industry or sector do you work in?",
      "What are your key responsibilities?",
      "What areas of interest generate significant email for you?",
      "Who do you report to or work with closely?"
    ],
    communication: [
      "How would you describe your daily email volume? (Low, Medium, High)",
      "Who are your most frequent contacts?",
      "How quickly do people expect you to respond to emails?",
      "Besides email, what other communication channels do you use?",
      "What types of recurring emails do you receive?"
    ],
    goals: [
      "What personal or professional projects are you currently working on?",
      "What recurring responsibilities do you have?",
      "What types of information do you never want to miss?",
      "Do you have any personal development goals that involve email?"
    ],
    workflow: [
      "When do you prefer to check your email?",
      "Are there times when you prefer not to be disturbed?",
      "How do you typically organize your email?",
      "How would you describe your decision-making style?"
    ],
    techSetup: [
      "What devices do you use to check email?",
      "What email client(s) do you use?",
      "What other productivity apps do you use regularly?",
      "How do you prefer to receive notifications for important emails?"
    ],
    priorities: [
      "What types of matters are time-sensitive for you?",
      "Which contacts should always get your immediate attention?",
      "What keywords or topics indicate high importance to you?",
      "What types of emails do you consider low priority?"
    ],
    aiTraining: [
      "Can you give an example of an email you'd consider high priority?",
      "Can you give an example of an email you'd consider low priority?",
      "What are some common requests you receive via email?",
      "What email tasks would you like to automate?",
      "What types of emails always need your human judgment?"
    ],
    personalization: [
      "What tone would you prefer for agent suggestions? (Friendly, Neutral, Direct)",
      "How much autonomy are you comfortable giving the agent?",
      "How often would you like to review the agent's actions?",
      "Do you have preferred greetings or sign-offs for emails?"
    ],
    consent: [
      "Do you consent to allowing the agent to process and analyze your email data?",
      "How long would you like your data to be stored?",
      "Who, if anyone, should have access to anonymized usage data?",
      "Do you authorize integration with other apps like your calendar?"
    ]
  };
  
  return questions[sectionName] || [
    `Tell me about your ${formatSectionName(sectionName)}.`
  ];
}

// Detect if user input contains a command
function detectCommand(input) {
  const lowerInput = input.toLowerCase().trim();
  
  if (lowerInput === 'exit' || lowerInput === 'quit') {
    return { command: 'exit' };
  } else if (lowerInput === 'help') {
    return { command: 'help' };
  } else if (lowerInput === 'skip' || lowerInput === 'next') {
    return { command: 'skip' };
  } else if (lowerInput === 'back' || lowerInput === 'previous') {
    return { command: 'back' };
  } else if (lowerInput === 'progress' || lowerInput === 'status') {
    return { command: 'progress' };
  } else if (lowerInput.startsWith('go to ')) {
    const section = lowerInput.replace('go to ', '');
    return { command: 'goto', section };
  }
  
  return { command: null };
}

// Extract potential data from user input
function extractPotentialData(input, sectionName) {
  const data = {};
  
  // Very basic extraction logic - would be replaced by LLM in real implementation
  if (sectionName === 'personalInfo') {
    // Try to extract name
    const nameMatch = input.match(/my name is ([a-zA-Z ]+)/i);
    if (nameMatch) {
      data.fullName = nameMatch[1].trim();
    }
    
    // Try to extract email
    const emailMatch = input.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
    if (emailMatch) {
      data.primaryEmail = emailMatch[1].trim();
    }
  }
  
  return data;
}

module.exports = {
  formatSectionName,
  generateSectionWelcome,
  getSectionQuestions,
  detectCommand,
  extractPotentialData
};
