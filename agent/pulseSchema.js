// Define the schema structure based on breakdown.txt sections
const pulseSchema = {
  personalInfo: {
    fullName: "",
    preferredName: "",
    primaryEmail: "",
    secondaryEmails: [],
    preferredLanguage: "",
    timeZone: "",
    // Additional fields from breakdown.txt section 1
    preferredLanguage: "",
    businessContext: false, // Flag to determine if this is for personal or business use
    employeeId: "",
    department: ""
  },
  professional: {
    occupation: "",
    role: "",
    areasOfInterest: [],
    industry: "",
    department: "",
    responsibilities: [],
    reportingManager: "",
    // Additional fields from breakdown.txt section 2
    typesOfOrganizations: []
  },
  communication: {
    emailVolume: "", // Low, Medium, High
    frequentContacts: [],
    responseExpectations: "",
    preferredChannels: [],
    recurringEmailTypes: [],
    // Additional fields from breakdown.txt section 3
    internalCorrespondents: [],
    externalCorrespondents: [],
    typicalResponseTimes: {
      internal: "",
      external: ""
    },
    meetingTypes: []
  },
  goals: {
    currentProjects: [],
    recurringResponsibilities: [],
    importantInformation: [],
    developmentGoals: [],
    // Additional fields from breakdown.txt section 4
    quarterlyObjectives: [],
    annualGoals: [],
    kpis: []
  },
  workflow: {
    emailCheckTimes: [],
    doNotDisturbTimes: [],
    organizationMethod: "",
    decisionMakingStyle: "",
    // Additional fields from breakdown.txt section 5
    preferredWorkingHours: [],
    deepFocusTimeBlocks: [],
    meetingPreferences: {
      timeOfDay: "",
      duration: "",
      frequency: ""
    },
    delegationPreferences: {}
  },
  techSetup: {
    devices: [],
    emailClients: [],
    productivityApps: [],
    notificationPreferences: {},
    // Additional fields from breakdown.txt section 6
    operatingSystems: [],
    integrationRequirements: []
  },
  priorities: {
    timeSensitiveMatters: [],
    importantContacts: [],
    highPriorityKeywords: [],
    lowPriorityTypes: [],
    // Additional fields from breakdown.txt section 7
    criticalProjectDeadlines: [],
    vipContacts: [],
    highValueActivities: [],
    lowValueTasks: []
  },
  aiTraining: {
    highPriorityExamples: [],
    lowPriorityExamples: [],
    commonRequestExamples: [],
    automationTasks: [],
    humanJudgmentExamples: [],
    // Additional fields from breakdown.txt section 8
    sampleRequests: []
  },
  personalization: {
    agentTone: "",
    autonomyLevel: "",
    reviewFrequency: "",
    preferredGreetings: [],
    preferredSignoffs: [],
    // Additional fields from breakdown.txt section 9
    communicationStyle: "", // Formal, Casual, Concise, Detailed
    decisionAutonomy: "",
    learningFeedbackPreferences: "",
    escalationThresholds: {}
  },
  consent: {
    dataProcessingConsent: false,
    dataRetentionPreference: "",
    privacyPreferences: {},
    appIntegrationConsent: false,
    overrideUnderstanding: false,
    // Additional fields from breakdown.txt section 10
    permissionLevels: {},
    dataRetentionPolicies: {},
    privacyBoundaries: {},
    integrationAuthorization: {},
    reviewProtocols: {}
  }
};

// Helper function to merge updates into the profile
function mergeProfileUpdate(baseProfile, update) {
  // Create a deep copy of the base profile
  const result = JSON.parse(JSON.stringify(baseProfile));
  
  // Helper function for deep merging
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  // Perform the deep merge
  deepMerge(result, update);
  return result;
}

// Validate profile completeness
function validateProfileSection(section, data) {
  // Basic validation for required fields in each section
  const validations = {
    personalInfo: () => {
      return data.fullName && data.primaryEmail;
    },
    professional: () => {
      return data.businessContext ? (data.role && data.industry) : true;
    },
    communication: () => {
      return data.emailVolume && data.responseExpectations;
    },
    goals: () => {
      return data.currentProjects && data.currentProjects.length > 0;
    },
    workflow: () => {
      return data.emailCheckTimes && data.emailCheckTimes.length > 0;
    },
    techSetup: () => {
      return data.devices && data.devices.length > 0 && data.emailClients && data.emailClients.length > 0;
    },
    priorities: () => {
      return data.importantContacts && data.importantContacts.length > 0;
    },
    aiTraining: () => {
      return true; // Optional section
    },
    personalization: () => {
      return data.agentTone && data.autonomyLevel;
    },
    consent: () => {
      return data.dataProcessingConsent === true;
    }
  };
  
  // Return validation result if validator exists, otherwise true
  return validations[section] ? validations[section]() : true;
}

// Calculate overall profile completion percentage
function calculateProfileCompletion(profile) {
  const sections = Object.keys(pulseSchema);
  let completedSections = 0;
  
  for (const section of sections) {
    if (validateProfileSection(section, profile[section] || {})) {
      completedSections++;
    }
  }
  
  return Math.floor((completedSections / sections.length) * 100);
}

module.exports = {
  pulseSchema,
  mergeProfileUpdate,
  validateProfileSection,
  calculateProfileCompletion
};
