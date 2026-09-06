import { config, logger } from "./config.ts";

export interface SMSMessage {
  to: string;
  message: string;
  monitorId: string;
  userId: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * A non-2xx response from Twilio, carrying the two things that decide whether
 * a retry is worth attempting.
 *
 * The retry logic used to match on `error.code`, but the thrown value was a
 * bare `Error` built from the response body, so it never carried one and
 * every Twilio-side failure -- including 20429 rate limiting, which the
 * retryable list explicitly names -- gave up after a single attempt.
 */
class TwilioRequestError extends Error {
  constructor(
    message: string,
    readonly code: number | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = "TwilioRequestError";
  }
}

/** Twilio error codes worth a second attempt. */
const RETRYABLE_TWILIO_CODES = new Set([
  20429,
  21610,
  30001,
  30002,
  30003,
  30004,
  30005,
  30006,
]);

const RETRYABLE_NETWORK_MARKERS = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "connection closed",
  "error sending request",
];

export class SMSService {
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 4000, 16000];

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      return await this.sendWithRetry(message);
    } catch (error) {
      logger.error("SMS Service Error:", error);
      return {
        success: false,
        error: this.sanitizeErrorMessage(error),
      };
    }
  }

  private async sendWithRetry(
    message: SMSMessage,
    attempt: number = 0,
  ): Promise<SMSResult> {
    try {
      const body = new URLSearchParams({
        Body: message.message,
        From: config.twilio.phoneNumber,
        To: message.to,
        ...(config.twilio.webhookUrl && {
          StatusCallback: config.twilio.webhookUrl,
        }),
      });

      const response = await this.makeTwilioRequest("Messages", "POST", body);

      if (!response.ok) {
        // Twilio returns JSON for API errors, but an edge/proxy failure can
        // return HTML. Parsing unguarded turned a clean 503 into an opaque
        // SyntaxError and lost the status code with it.
        const payload = await this.readJsonSafely(response);
        throw new TwilioRequestError(
          `Twilio API error (HTTP ${response.status}): ${
            payload?.message ?? response.statusText ?? "unknown"
          }`,
          typeof payload?.code === "number" ? payload.code : undefined,
          response.status,
        );
      }

      const twilioMessage = await response.json();

      logger.debug("SMS sent successfully:", {
        messageId: twilioMessage.sid,
        to: message.to.replace(/\d(?=\d{4})/g, "*"),
        userId: message.userId,
        monitorId: message.monitorId,
      });

      return { success: true, messageId: twilioMessage.sid };
    } catch (error) {
      logger.error(`SMS send attempt ${attempt + 1} failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: message.userId,
        monitorId: message.monitorId,
        attempt: attempt + 1,
      });

      if (attempt < this.RETRY_ATTEMPTS - 1 && this.isRetryableError(error)) {
        const delay = this.RETRY_DELAYS[attempt];
        logger.info(`Retrying SMS send in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(message, attempt + 1);
      }

      return {
        success: false,
        error: this.sanitizeErrorMessage(error),
      };
    }
  }

  private async readJsonSafely(
    response: Response,
  ): Promise<{ message?: string; code?: number } | null> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private async makeTwilioRequest(
    endpoint: string,
    method: "GET" | "POST",
    body?: URLSearchParams,
  ): Promise<Response> {
    const url =
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/${endpoint}.json`;

    const credentials = btoa(
      `${config.twilio.accountSid}:${config.twilio.authToken}`,
    );

    return await fetch(url, {
      method,
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: method === "POST" ? body : undefined,
    });
  }

  private sanitizeErrorMessage(error: unknown): string {
    if (config.app.environment === "production") {
      return "Failed to send SMS. Please try again later.";
    }
    if (error instanceof Error) return error.message;
    if (
      typeof error === "object" && error !== null &&
      "message" in (error as Record<string, unknown>)
    ) {
      return String(
        (error as { message?: unknown }).message ?? "Unknown error",
      );
    }
    return "Failed to send SMS";
  }

  isRetryableError(error: unknown): boolean {
    if (error instanceof TwilioRequestError) {
      if (error.code !== undefined && RETRYABLE_TWILIO_CODES.has(error.code)) {
        return true;
      }
      // Rate limiting and Twilio-side faults are transient regardless of
      // whether a machine-readable code came back with them.
      return error.status === 429 || error.status >= 500;
    }

    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null &&
          "message" in (error as Record<string, unknown>)
      ? String((error as { message?: unknown }).message ?? "")
      : "";

    return RETRYABLE_NETWORK_MARKERS.some((marker) => message.includes(marker));
  }
}
