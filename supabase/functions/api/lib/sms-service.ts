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

export interface SMSDeliveryStatus {
  messageId: string;
  status: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  errorCode?: string;
  errorMessage?: string;
}

export class SMSService {
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 4000, 16000];

  constructor() {
    logger.info("SMS Service initialized for Deno environment");
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      const result = await this.sendWithRetry(message);

      return result;
    } catch (error) {
      logger.error("SMS Service Error:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Unknown error occurred",
      };
    }
  }

  async validateDelivery(messageId: string): Promise<SMSDeliveryStatus> {
    try {
      const response = await this.makeTwilioRequest(
        `Messages/${messageId}`,
        "GET",
      );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status}`);
      }

      const message = await response.json();

      return {
        messageId,
        status: message.status as SMSDeliveryStatus["status"],
        errorCode: message.error_code?.toString(),
        errorMessage: message.error_message || undefined,
      };
    } catch (error) {
      logger.error("Error validating SMS delivery:", error);
      return {
        messageId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
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
        const errorData = await response.json();
        throw new Error(
          `Twilio API error: ${errorData.message || response.status}`,
        );
      }

      const twilioMessage = await response.json();

      if (config.app.environment === "development") {
        logger.info("SMS sent successfully:", {
          messageId: twilioMessage.sid,
          to: message.to.replace(/\d(?=\d{4})/g, "*"),
          userId: message.userId,
          monitorId: message.monitorId,
        });
      }

      return {
        success: true,
        messageId: twilioMessage.sid,
      };
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

    const headers: Record<string, string> = {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    return await fetch(url, {
      method,
      headers,
      body: method === "POST" ? body : undefined,
    });
  }

  private sanitizeErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (config.app.environment === "production") {
        return "Failed to send SMS. Please try again later.";
      }
      return error.message;
    }

    if (
      typeof error === "object" && error !== null &&
      "message" in (error as Record<string, unknown>)
    ) {
      return config.app.environment === "production"
        ? "Failed to send SMS. Please try again later."
        : (error as { message?: string }).message ?? "Unknown error";
    }

    return "Failed to send SMS";
  }

  private isRetryableError(error: unknown): boolean {
    const retryableErrorCodes = [
      20429,
      21610,
      30001,
      30002,
      30003,
      30004,
      30005,
      30006,
    ];

    const code = (typeof error === "object" && error !== null &&
        "code" in (error as Record<string, unknown>))
      ? (error as { code?: unknown }).code
      : undefined;
    if (typeof code === "number" && retryableErrorCodes.includes(code)) {
      return true;
    }

    const message = (typeof error === "object" && error !== null &&
        "message" in (error as Record<string, unknown>))
      ? (error as { message?: unknown }).message
      : undefined;
    if (
      typeof message === "string" && (
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT") ||
        message.includes("ENOTFOUND")
      )
    ) {
      return true;
    }

    return false;
  }

  isConfigured(): boolean {
    return !!(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber
    );
  }

  getHealthStatus(): {
    configured: boolean;
    environment: string;
  } {
    return {
      configured: this.isConfigured(),
      environment: config.app.environment,
    };
  }
}
