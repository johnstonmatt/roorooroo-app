/**
 * Configuration management utilities
 * Centralizes environment variable access and validation
 */

interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    webhookUrl?: string;
  };
  frontend: {
    url: string;
    productionUrl?: string;
  };
  auth: {
    allowedEmails: string[];
    allowedDomain: string;
  };
  app: {
    environment: "development" | "production";
    logLevel: "debug" | "info" | "warn" | "error";
  };
}

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return Deno.env.get(key) || defaultValue;
}

export const config: Config = {
  supabase: {
    url: getRequiredEnv("SUPABASE_URL"),
    anonKey: getRequiredEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  },
  twilio: {
    accountSid: getRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: getRequiredEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: getRequiredEnv("TWILIO_PHONE_NUMBER"),
    webhookUrl: Deno.env.get("TWILIO_WEBHOOK_URL"),
  },
  frontend: {
    url: getOptionalEnv("FRONTEND_URL", "http://localhost:3000"),
    productionUrl: Deno.env.get("PRODUCTION_FRONTEND_URL"),
  },
  auth: {
    allowedEmails: getOptionalEnv("ALLOWED_SIGNUP_EMAILS", "").split(",")
      .filter(Boolean),
    allowedDomain: getOptionalEnv("ALLOWED_SIGNUP_DOMAIN", "@supabase.io"),
  },
  app: {
    environment:
      (Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "development") as
        | "development"
        | "production",
    logLevel: (getOptionalEnv("LOG_LEVEL", "info")) as
      | "debug"
      | "info"
      | "warn"
      | "error",
  },
};

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (["debug"].includes(config.app.logLevel)) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: unknown[]) => {
    if (["debug", "info"].includes(config.app.logLevel)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (["debug", "info", "warn"].includes(config.app.logLevel)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
