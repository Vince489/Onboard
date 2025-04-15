# PULSE™ Onboarding Agent

An agent-driven onboarding experience for the PULSE™ Smart Inbox system. This project replaces a traditional form-based onboarding with a conversational agent that guides users through the process of configuring their PULSE™ agent.

## Project Structure

```
project-root/
│
├── agent/
│   ├── pulseAgent.js         # Gemini agent init + prompt logic
│   ├── conversationController.js  # manages onboarding flow
│   ├── pulseSchema.js        # JSON schema and helpers
│   └── sectionHandlers/      # Section-specific conversation handlers
│       ├── personalInfo.js
│       ├── professional.js
│       ├── communication.js
│       ├── goals.js
│       ├── workflow.js
│       ├── techSetup.js
│       ├── priorities.js
│       ├── aiTraining.js
│       ├── personalization.js
│       └── consent.js
│
├── services/
│   ├── tts/                  # Text-to-Speech service
│   │   ├── index.js          # Service exports
│   │   └── ttsService.js     # TTS implementation
│   └── stt/                  # Speech-to-Text service
│       ├── index.js          # Service exports
│       └── sttService.js     # STT implementation
│
├── database/                # Database integration
│   ├── connection.js       # MongoDB connection
│   ├── dbService.js        # Database operations
│   ├── index.js           # Module exports
│   └── models/             # Mongoose models
│       ├── Profile.js        # User profile model
│       ├── Session.js        # Session data model
│       └── index.js         # Models exports
│
├── storage/
│   ├── profileManager.js     # Handles saving/loading profiles
│   └── sessionManager.js     # Manages onboarding session state
│
├── utils/
│   ├── schemaValidator.js    # Validates JSON against schema
│   └── conversationHelpers.js # Helper functions for conversation flow
│
├── cache/
│   └── audio/                # Cached audio files (created at runtime)
│
├── index.js                  # Entry point
├── package.json              # Project dependencies
└── .env                      # Environment variables
```

## Features

- **Conversational Onboarding**: Natural language interaction instead of form-filling
- **Adaptive Questioning**: Questions adapt based on previous answers
- **Progressive Disclosure**: Start with basic questions and progressively ask more detailed questions
- **Section Summaries**: Summarize information at the end of each section
- **Flexible Navigation**: Jump between sections, go back, or skip ahead
- **Save & Resume**: Save progress and resume later
- **Personal/Business Mode**: Adapt questions based on personal or business use
- **Text-to-Speech**: Voice responses from the agent with different voice profiles for different sections
- **Speech-to-Text**: Voice input support allowing users to speak their responses instead of typing
- **MongoDB Integration**: Persistent storage of user profiles and session data with file-based fallback

## Onboarding Sections

Based on the breakdown.txt file, the onboarding process covers 10 key areas:

1. **Personal Info**: Name, email, language preferences, etc.
2. **Professional Context**: Role, interests, responsibilities
3. **Communication Patterns**: Email volume, contacts, response expectations
4. **Goals**: Current projects, responsibilities, development goals
5. **Workflow Preferences**: Email checking times, organization methods
6. **Technical Environment**: Devices, email clients, productivity apps
7. **Priority Framework**: Time-sensitive matters, important contacts
8. **Semantic Training Data**: Examples of high/low priority emails
9. **Agent Personalization**: Preferred tone, autonomy level
10. **Data Processing Consent**: Privacy preferences, data retention

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Configure your environment variables in `.env`:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
   USER_ID=test_user_123
   MONGODB_URI=mongodb://localhost:27017/pulse-onboarding
   ```

   > **Important**: You need a valid Google API key with access to the Gemini API.
   > Get your API key from the [Google AI Studio](https://makersuite.google.com/app/apikey).
   >
   > For Text-to-Speech and Speech-to-Text functionality, you need Google Cloud credentials with the
   > Text-to-Speech and Speech-to-Text APIs enabled. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment
   > variable to the path of your service account JSON file. Get your credentials from the
   > [Google Cloud Console](https://console.cloud.google.com/).
   >
   > For Speech-to-Text functionality, you also need audio recording software installed:
   > - Windows: [SoX](https://sourceforge.net/projects/sox/)
   > - macOS: `brew install sox`
   > - Linux: `sudo apt-get install sox` or equivalent
   >
   > For MongoDB integration, you need MongoDB installed locally or a MongoDB Atlas account.
   > Set the `MONGODB_URI` environment variable to your MongoDB connection string.
   > If not provided, the application will fall back to file-based storage.

3. Run the application:
   ```
   npm start
   ```

4. Interact with the agent by answering its questions. You can use commands like `help`, `skip`, `back`, and `progress` to navigate the onboarding process.

## Implementation Notes

- The implementation uses Google's Gemini API to power the conversational agent
- The conversation flow is managed by the `conversationController.js` file
- Each section has its own handler in the `sectionHandlers/` directory
- Profile data is saved to JSON files in a `profiles/` directory
- The agent maintains conversation context across multiple interactions
- Fallback mechanisms are in place in case the API fails or returns invalid responses

## Commands

During the onboarding conversation, users can use these commands:

- `exit`: Save progress and quit
- `skip`: Move to the next section
- `back`: Go back to the previous section
- `progress`: Show current progress
- `voice` or `speak`: Switch to speech input mode
- `help`: Show help menu

## Output

The final output is a structured JSON profile that maps to the schema-v1.json format, which can be used to configure the PULSE™ agent's behavior.
