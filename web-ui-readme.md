# PULSE™ Onboarding Agent Web UI

This is a web-based user interface for the PULSE™ Onboarding Agent, built with Express.js, EJS templates, CSS, and JavaScript.

## Features

- **Conversational Interface**: Natural dialogue with the onboarding agent
- **Voice Input/Output**: Speak to the agent and hear responses
- **Progress Tracking**: Visual indication of onboarding progress
- **Section Navigation**: Easily move between different sections
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Using Socket.IO for instant communication

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Configure your environment variables in `.env`:
   ```
   GOOGLE_API_KEY=your_google_api_key_here
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
   MONGODB_URI=mongodb://localhost:27017/pulse-onboarding
   SESSION_SECRET=your_session_secret
   ```

3. Start the web server:
   ```
   npm run web
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Project Structure

```
project-root/
│
├── public/                  # Static assets
│   ├── css/                 # Stylesheets
│   │   └── style.css        # Main CSS file
│   ├── js/                  # JavaScript files
│   │   ├── main.js          # Main JS file
│   │   └── onboarding.js    # Onboarding page JS
│   └── images/              # Image assets
│
├── views/                   # EJS templates
│   ├── index.ejs            # Home page
│   ├── onboarding.ejs       # Onboarding page
│   └── partials/            # Reusable template parts
│
├── routes/                  # Express routes
│   └── api.js               # API endpoints
│
├── server.js                # Express server
└── .env                     # Environment variables
```

## Technologies Used

- **Express.js**: Web server framework
- **EJS**: Templating engine
- **Socket.IO**: Real-time communication
- **MongoDB**: Data persistence
- **Google Cloud Speech-to-Text**: Voice input
- **Google Cloud Text-to-Speech**: Voice output

## Usage

1. **Home Page**: Introduction to the onboarding process
2. **Onboarding Page**: Interactive conversation with the agent
   - Type messages in the input field
   - Click the microphone button for voice input
   - Use quick commands for navigation
   - Track progress in the sidebar

## Integration with PULSE™ Agent

The web UI connects to the same agent logic used in the command-line version, ensuring a consistent onboarding experience across interfaces.

## Development

For development with auto-restart:
```
npm run dev
```

This uses nodemon to automatically restart the server when files change.
