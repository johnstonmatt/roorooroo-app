/**
 * Environment access for the parts of the function that need it.
 *
 * Read at module load, so a misconfigured deployment fails immediately and
 * loudly rather than at the first notification attempt. Twilio is a hard
 * requirement: the function will not boot without it. Only add a key here if
 * the function genuinely cannot run without it -- anything optional belongs
 * behind Deno.env.get at its point of use.
 */

interface Config {
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    webhookUrl?: string;
  };
  app: {
    environment: "development" | "production";
    logLevel: LogLevel;
  };
}

type LogLevel = "debug" | "info" | "warn" | "error";

function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(
      `Required environment variable ${key} is not set. ` +
        `The api function cannot start without it.`,
    );
  }
  return value;
}

export const config: Config = {
  twilio: {
    accountSid: getRequiredEnv("TWILIO_ACCOUNT_SID"),
    authToken: getRequiredEnv("TWILIO_AUTH_TOKEN"),
    phoneNumber: getRequiredEnv("TWILIO_PHONE_NUMBER"),
    webhookUrl: Deno.env.get("TWILIO_WEBHOOK_URL"),
  },
  app: {
    environment: Deno.env.get("DENO_DEPLOYMENT_ID")
      ? "production"
      : "development",
    logLevel: (Deno.env.get("LOG_LEVEL") ?? "info") as LogLevel,
  },
};

/**
 * The public origin users are sent to from a notification.
 *
 * PRODUCTION_FRONTEND_URL is the deployed origin; FRONTEND_URL is the local
 * one and must not win in production. Neither is required, so this falls back
 * to the real apex domain rather than a guess.
 */
export function frontendUrl(): string {
  return Deno.env.get("PRODUCTION_FRONTEND_URL") ??
    Deno.env.get("FRONTEND_URL") ??
    "https://roorooroo.com";
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function enabled(level: LogLevel): boolean {
  return LEVELS[level] >= (LEVELS[config.app.logLevel] ?? LEVELS.info);
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (enabled("debug")) console.debug(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (enabled("info")) console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (enabled("warn")) console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
