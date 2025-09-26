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
  app: {
    environment: "development" | "production";
    logLevel: "debug" | "info" | "warn" | "error";
  };
  smsLimits: {
    maxSMSPerUserPerHour: number;
    maxSMSPerUserPerDay: number;
    maxMonthlyCostUSD: number;
    costPerSMSUSD: number;
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

function getNumericEnv(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
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
  smsLimits: {
    maxSMSPerUserPerHour: getNumericEnv("SMS_MAX_PER_USER_PER_HOUR", 10),
    maxSMSPerUserPerDay: getNumericEnv("SMS_MAX_PER_USER_PER_DAY", 50),
    maxMonthlyCostUSD: getNumericEnv("SMS_MAX_MONTHLY_COST_USD", 25.0),
    costPerSMSUSD: getNumericEnv("SMS_COST_PER_SMS_USD", 0.0075),
  },
};

export function validateConfig(): void {
  const requiredKeys = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
  ];

  const missing = requiredKeys.filter((key) => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

export function isDevelopment(): boolean {
  return config.app.environment === "development";
}

export function isProduction(): boolean {
  return config.app.environment === "production";
}

export function getLogLevel(): string {
  return config.app.logLevel;
}

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
