const { runPulseOnboarding } = require('./agent/conversationController');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

// Main entry point for the application
async function main() {
  // Initialize database connection
  try {
    await db.initializeDatabase();
  } catch (err) {
    console.error('Failed to initialize database:', err);
    console.log('Continuing with file-based storage');
  }
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                                                            ║");
  console.log("║                 PULSE™ ONBOARDING AGENT                    ║");
  console.log("║                                                            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\nWelcome to the PULSE™ Smart Inbox onboarding experience!");
  console.log("I'm Virtra, your personal onboarding agent.");
  console.log("I'll guide you through setting up your PULSE™ configuration.");
  console.log("\nThis conversation will help me understand your:");
  console.log("• Communication style and preferences");
  console.log("• Email habits and workflow");
  console.log("• Priorities and important contacts");
  console.log("• And much more!");
  console.log("\nLet's get started!\n");

  // In a real app, this would be a user ID from authentication
  // For demo purposes, we'll generate a random ID or use one from environment
  const userId = process.env.USER_ID || uuidv4();

  try {
    // Run the onboarding process
    const finalProfile = await runPulseOnboarding(userId);

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                                                            ║");
    console.log("║                 ONBOARDING COMPLETE!                       ║");
    console.log("║                                                            ║");
    console.log("╚════════════════════════════════════════════════════════════╝");

    console.log("\nYour PULSE™ agent is now configured and ready to assist you!");
    console.log("In a real implementation, this profile would be used to:");
    console.log("• Configure your personalized PULSE™ agent");
    console.log("• Set up your email triage rules");
    console.log("• Establish your communication patterns");
    console.log("• And much more!");

    console.log("\nThank you for completing the onboarding process!");
  } catch (err) {
    console.error("An error occurred during onboarding:", err);
    console.log("Please try again later or contact support.");
  }
}

// Run the application
if (require.main === module) {
  main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}

module.exports = { main };
