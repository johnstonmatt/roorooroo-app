/**
 * Environment configuration and validation for SMS notifications
 * Provides secure access to Twilio credentials and configuration
 */

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl?: string;
}

interface AppConfig {
  twilio: TwilioConfig;
  apiBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Validates that required environment variables are present
 */
function validateEnvironmentVariables(): void {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env.local file and ensure all Twilio credentials are configured.",
    );
  }

  // Validate Twilio Account SID format
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  if (!accountSid.startsWith("AC") || accountSid.length !== 34) {
    throw new Error(
      'TWILIO_ACCOUNT_SID must start with "AC" and be 34 characters long',
    );
  }

  // Validate phone number format (E.164)
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER!;
  if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
    throw new Error(
      "TWILIO_PHONE_NUMBER must be in E.164 format (e.g., +1234567890)",
    );
  }
}

/**
 * Gets validated application configuration
 */
export function getConfig(): AppConfig {
  // Always validate in server-side contexts
  validateEnvironmentVariables();

  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  return {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || "",
      webhookUrl: process.env.TWILIO_WEBHOOK_URL,
    },
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:54321/functions/v1/api",
    isDevelopment,
    isProduction,
  };
}

/**
 * Safely logs configuration (without sensitive data)
 */
export function logConfigStatus(): void {
  try {
    const config = getConfig();
    console.log("SMS Configuration Status:", {
      twilioConfigured: !!config.twilio.accountSid,
      phoneNumberConfigured: !!config.twilio.phoneNumber,
      webhookConfigured: !!config.twilio.webhookUrl,
      environment: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error(
      "SMS Configuration Error:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
