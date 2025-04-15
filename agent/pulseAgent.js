// Real implementation using the Google Generative AI SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Get API key from environment variables
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

// System prompt based on breakdown.txt sections
const SYSTEM_PROMPT = `
You are Virtra, a personal onboarding agent for the PULSE™ intelligent email system.
Your job is to collect data from the user to fill out a JSON configuration through a conversational onboarding process.

You are conducting a 10-section interview covering:
1. Personal Info - Name, email, language preferences, etc.
2. Professional Context - Role, interests, responsibilities
3. Communication Patterns - Email volume, contacts, response expectations
4. Goals - Current projects, responsibilities, development goals
5. Workflow Preferences - Email checking times, organization methods
6. Technical Environment - Devices, email clients, productivity apps
7. Priority Framework - Time-sensitive matters, important contacts
8. Semantic Training Data - Examples of high/low priority emails
9. Agent Personalization - Preferred tone, autonomy level
10. Data Processing Consent - Privacy preferences, data retention

IMPORTANT SECTION NAVIGATION RULES:
- You MUST complete each section in order from 1 to 10.
- You MUST NOT skip sections unless explicitly instructed by the user.
- You MUST NOT mark the onboarding as complete until ALL 10 sections are finished.
- When a section is complete, use nextAction: "complete_section" to move to the next section.
- Only use nextAction: "complete_onboarding" when ALL 10 sections are complete.
- Otherwise, use nextAction: "continue" to continue in the current section.

Ask onboarding questions in a conversational tone. Be empathetic and insightful.
After each reply, return a response AND a JSON fragment that reflects what was learned.

IMPORTANT: You must ALWAYS respond in valid JSON format with the following structure:
{
  "response": "what you say to the user",
  "JSONUpdate": { ...partial pulse config based on the current section... },
  "nextAction": "continue" | "complete_section" | "complete_onboarding"
}

The JSONUpdate should contain only the fields that were extracted from the user's message, organized by section.
For example, if the user provides their name and email in the personalInfo section, the JSONUpdate would be:
{
  "personalInfo": {
    "fullName": "John Doe",
    "primaryEmail": "john@example.com"
  }
}

NEXTACTION RULES:
- "continue": Use this when you need more information in the current section.
- "complete_section": Use this ONLY when the current section is complete and you're ready to move to the next section.
- "complete_onboarding": Use this ONLY when ALL 10 sections are complete.
`;

// Chat instances cache to maintain conversation context
const chatInstances = {};

// Function to get or create a chat instance for a user
function getChatInstance(userId) {
  if (!chatInstances[userId]) {
    chatInstances[userId] = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT
    }).startChat({
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
  }
  return chatInstances[userId];
}

// Main function to prompt the Pulse Agent
async function promptPulseAgent(userMessage, currentSection, profileContext, userId = 'default') {
  console.log(`[Agent] Processing message for section: ${currentSection}`);

  try {
    // Get or create a chat instance for this user
    const chat = getChatInstance(userId);

    // Create a context message that includes the current section and profile data
    const contextMessage = `
Current onboarding section: ${currentSection}
Current profile data: ${JSON.stringify(profileContext)}

User message: ${userMessage}

Remember to extract relevant information for the ${currentSection} section and return it in the JSONUpdate field.
Always respond in the required JSON format with response, JSONUpdate, and nextAction fields.

IMPORTANT SECTION NAVIGATION REMINDERS:
- You are currently in the "${currentSection}" section.
- Only use nextAction: "complete_section" when you have gathered all necessary information for this section.
- Only use nextAction: "complete_onboarding" when ALL 10 sections are complete.
- Otherwise, use nextAction: "continue" to continue gathering information in the current section.
- Follow the section order: personalInfo -> professional -> communication -> goals -> workflow -> techSetup -> priorities -> aiTraining -> personalization -> consent
`;

    // Send the message to the Gemini API
    const result = await chat.sendMessage(contextMessage);
    const responseText = result.response.text();

    console.log(`[Agent] Raw response: ${responseText}`);

    // Check if the response contains markdown code blocks first
    let cleanedResponse = responseText;
    let isMarkdown = false;

    // Remove markdown code block markers if present
    if (responseText.includes('```json')) {
      cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```/g, '');
      isMarkdown = true;
      console.log('[Agent] Detected markdown JSON code block, cleaning response');
    } else if (responseText.includes('```')) {
      cleanedResponse = responseText.replace(/```\n?/g, '').replace(/```/g, '');
      isMarkdown = true;
      console.log('[Agent] Detected markdown code block, cleaning response');
    }

    if (isMarkdown) {
      console.log('[Agent] Cleaned response for JSON parsing:', cleanedResponse);
    }

    // Parse the JSON response
    try {
      // Handle potential non-JSON responses by wrapping in try/catch
      const parsedResponse = JSON.parse(isMarkdown ? cleanedResponse.trim() : responseText);

      // Validate the response structure
      if (!parsedResponse.response || !parsedResponse.JSONUpdate || !parsedResponse.nextAction) {
        console.warn("[Agent] Response missing required fields, using fallback");
        return createFallbackResponse(currentSection, userMessage);
      }

      // Validate nextAction value
      if (!["continue", "complete_section", "complete_onboarding"].includes(parsedResponse.nextAction)) {
        parsedResponse.nextAction = "continue";
      }

      return parsedResponse;
    } catch (parseError) {
      console.error("[Agent] Failed to parse JSON response:", parseError);

      // If we already tried cleaning the response above, don't do it again
      if (!isMarkdown) {
        // Try to extract JSON from the response if it contains JSON-like content
        cleanedResponse = responseText;

        // Remove markdown code block markers if present
        if (responseText.includes('```json')) {
          cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```/g, '');
          console.log('[Agent] Detected markdown JSON code block in fallback, cleaning response');
        } else if (responseText.includes('```')) {
          cleanedResponse = responseText.replace(/```\n?/g, '').replace(/```/g, '');
          console.log('[Agent] Detected markdown code block in fallback, cleaning response');
        }

        console.log('[Agent] Cleaned response for JSON parsing in fallback:', cleanedResponse);
      }

      // Try to find a JSON object in the cleaned response
      try {
        // First, try to parse the entire cleaned response
        try {
          const parsedJson = JSON.parse(cleanedResponse.trim());
          if (parsedJson.response && parsedJson.JSONUpdate && parsedJson.nextAction) {
            console.log('[Agent] Successfully parsed cleaned JSON response');
            return parsedJson;
          }
        } catch (fullParseError) {
          // If that fails, try to extract just the JSON object
          const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extractedJson = JSON.parse(jsonMatch[0]);
            if (extractedJson.response && extractedJson.JSONUpdate && extractedJson.nextAction) {
              console.log('[Agent] Successfully parsed extracted JSON object');
              return extractedJson;
            }
          } else {
            throw new Error('No JSON object found in response');
          }
        }
      } catch (e) {
        console.error("[Agent] Failed to parse JSON after cleaning:", e);
        // Extraction failed, use fallback
      }

      // Use fallback response
      return createFallbackResponse(currentSection, userMessage);
    }
  } catch (error) {
    console.error("[Agent] API error:", error);
    return createFallbackResponse(currentSection, userMessage);
  }
}

// Create a fallback response when the API fails or returns invalid JSON
function createFallbackResponse(currentSection, userMessage) {
  // Simple keyword detection for basic fallback functionality
  const hasName = userMessage.match(/my name is ([a-zA-Z ]+)/i);
  const hasEmail = userMessage.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i);
  const hasDone = userMessage.toLowerCase().includes("done") ||
                  userMessage.toLowerCase().includes("next") ||
                  userMessage.toLowerCase().includes("continue");

  let response, jsonUpdate, nextAction;

  // Basic fallback logic based on section and keywords
  switch(currentSection) {
    case "personalInfo":
      if (hasName) {
        const name = hasName[1];
        response = `Nice to meet you, ${name}! What email address would you like PULSE to monitor?`;
        jsonUpdate = { personalInfo: { fullName: name, preferredName: name } };
        nextAction = "continue";
      } else if (hasEmail) {
        const email = hasEmail[1];
        response = `Great! I've added ${email} as your primary email. What's your preferred language for communication?`;
        jsonUpdate = { personalInfo: { primaryEmail: email } };
        nextAction = "continue";
      } else if (hasDone) {
        response = "Perfect! Let's move on to understanding your professional context.";
        jsonUpdate = {};
        nextAction = "complete_section";
      } else {
        response = "I'm having trouble processing that. Let's start with the basics. What's your full name?";
        jsonUpdate = {};
        nextAction = "continue";
      }
      break;

    default:
      response = `I'm having trouble understanding. Let's continue with your ${currentSection}. What would you like to share?`;
      jsonUpdate = {};
      nextAction = hasDone ? "complete_section" : "continue";
  }

  return {
    response,
    JSONUpdate: jsonUpdate,
    nextAction
  };
}

module.exports = {
  promptPulseAgent,
  SYSTEM_PROMPT
};
