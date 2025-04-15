// Schema validation utilities
const { pulseSchema } = require('../agent/pulseSchema');

// Validate a complete profile against the schema
function validateFullProfile(profile) {
  const errors = {};
  
  // Check each section of the schema
  for (const section in pulseSchema) {
    const sectionErrors = validateSection(section, profile[section] || {});
    if (sectionErrors.length > 0) {
      errors[section] = sectionErrors;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Validate a specific section against the schema
function validateSection(sectionName, sectionData) {
  const errors = [];
  const schemaSection = pulseSchema[sectionName] || {};
  
  // Check for required fields based on section
  switch(sectionName) {
    case 'personalInfo':
      if (!sectionData.fullName) errors.push('Full name is required');
      if (!sectionData.primaryEmail) errors.push('Primary email is required');
      break;
      
    case 'professional':
      // Only validate if business context is true
      if (sectionData.businessContext) {
        if (!sectionData.role) errors.push('Role is required for business context');
        if (!sectionData.industry) errors.push('Industry is required for business context');
      }
      break;
      
    case 'communication':
      if (!sectionData.emailVolume) errors.push('Email volume is required');
      break;
      
    case 'consent':
      if (sectionData.dataProcessingConsent !== true) {
        errors.push('Data processing consent is required');
      }
      break;
  }
  
  // Type validation for arrays
  const arrayFields = {
    personalInfo: ['secondaryEmails'],
    professional: ['areasOfInterest', 'responsibilities', 'typesOfOrganizations'],
    communication: ['frequentContacts', 'preferredChannels', 'recurringEmailTypes'],
    goals: ['currentProjects', 'recurringResponsibilities', 'developmentGoals'],
    workflow: ['emailCheckTimes', 'doNotDisturbTimes'],
    techSetup: ['devices', 'emailClients', 'productivityApps'],
    priorities: ['timeSensitiveMatters', 'importantContacts', 'highPriorityKeywords'],
    aiTraining: ['highPriorityExamples', 'lowPriorityExamples', 'commonRequestExamples'],
    personalization: ['preferredGreetings', 'preferredSignoffs']
  };
  
  // Check that array fields are actually arrays
  if (arrayFields[sectionName]) {
    for (const field of arrayFields[sectionName]) {
      if (sectionData[field] && !Array.isArray(sectionData[field])) {
        errors.push(`${field} must be an array`);
      }
    }
  }
  
  return errors;
}

// Check if a profile is complete enough to finalize
function isProfileComplete(profile) {
  // Required sections for a minimally viable profile
  const requiredSections = [
    'personalInfo',
    'communication',
    'priorities',
    'personalization',
    'consent'
  ];
  
  for (const section of requiredSections) {
    const sectionErrors = validateSection(section, profile[section] || {});
    if (sectionErrors.length > 0) {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  validateFullProfile,
  validateSection,
  isProfileComplete
};
