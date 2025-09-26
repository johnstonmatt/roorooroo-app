import { Twilio } from "twilio";
import { getConfig } from "./config";
import { SMSRateLimiter } from "./sms-rate-limiter";

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
  rateLimited?: boolean;
}

export interface SMSDeliveryStatus {
  messageId: string;
  status: "queued" | "sent" | "delivered" | "failed" | "undelivered";
  errorCode?: string;
  errorMessage?: string;
}

export class SMSService {
  private client: Twilio;
  private config = getConfig();
  private rateLimiter = new SMSRateLimiter();
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 4000, 16000]; // exponential backoff in ms

  constructor() {
    try {
      // Use secure configuration management
      this.client = new Twilio(
        this.config.twilio.accountSid,
        this.config.twilio.authToken,
      );

      // Log configuration status (without sensitive data)
      if (this.config.isDevelopment) {
        console.log("SMS Service initialized with configuration:", {
          phoneNumber: this.config.twilio.phoneNumber,
          hasWebhook: !!this.config.twilio.webhookUrl,
          limits: this.config.smsLimits,
        });
      }
    } catch (error) {
      console.error("Failed to initialize SMS Service:", error);
      throw error;
    }
  }

  /**
   * Send SMS message with comprehensive rate limiting and security checks
   */
  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // Check comprehensive rate limits and cost controls
      const rateLimitResult = await this.rateLimiter.checkRateLimit(
        message.userId,
      );

      if (!rateLimitResult.allowed) {
        console.warn(
          `SMS rate limit exceeded for user ${message.userId}:`,
          rateLimitResult.reason,
        );
        return {
          success: false,
          error: rateLimitResult.reason || "Rate limit exceeded",
          rateLimited: true,
        };
      }

      // Log rate limit status in development
      if (this.config.isDevelopment) {
        console.log("SMS rate limit check passed:", {
          userId: message.userId,
          remainingHourly: rateLimitResult.remainingHourly,
          remainingDaily: rateLimitResult.remainingDaily,
          estimatedMonthlyCost: rateLimitResult.estimatedMonthlyCost,
        });
      }

      // Attempt to send with retry logic
      const result = await this.sendWithRetry(message);

      // Record usage if successful
      if (result.success) {
        await this.rateLimiter.recordSMSUsage(message.userId);
      }

      return result;
    } catch (error) {
      console.error("SMS Service Error:", error);
      return {
        success: false,
        error: error instanceof Error
          ? error.message
          : "Unknown error occurred",
      };
    }
  }

  /**
   * Validate SMS delivery status
   */
  async validateDelivery(messageId: string): Promise<SMSDeliveryStatus> {
    try {
      const message = await this.client.messages(messageId).fetch();

      return {
        messageId,
        status: message.status as SMSDeliveryStatus["status"],
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    } catch (error) {
      console.error("Error validating SMS delivery:", error);
      return {
        messageId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Send SMS with retry logic and secure error handling
   */
  private async sendWithRetry(
    message: SMSMessage,
    attempt: number = 0,
  ): Promise<SMSResult> {
    try {
      const twilioMessage = await this.client.messages.create({
        body: message.message,
        from: this.config.twilio.phoneNumber,
        to: message.to,
        // Add webhook URL for delivery status if configured
        ...(this.config.twilio.webhookUrl && {
          statusCallback: this.config.twilio.webhookUrl,
        }),
      });

      // Log successful send (without sensitive data)
      if (this.config.isDevelopment) {
        console.log("SMS sent successfully:", {
          messageId: twilioMessage.sid,
          to: message.to.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
          userId: message.userId,
          monitorId: message.monitorId,
        });
      }

      return {
        success: true,
        messageId: twilioMessage.sid,
      };
    } catch (error) {
      console.error(`SMS send attempt ${attempt + 1} failed:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: message.userId,
        monitorId: message.monitorId,
        attempt: attempt + 1,
      });

      // If we haven't exhausted retries and it's a retryable error
      if (attempt < this.RETRY_ATTEMPTS - 1 && this.isRetryableError(error)) {
        const delay = this.RETRY_DELAYS[attempt];
        console.log(`Retrying SMS send in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendWithRetry(message, attempt + 1);
      }

      return {
        success: false,
        error: this.sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Sanitize error messages to prevent information leakage
   */
  private sanitizeErrorMessage(error: any): string {
    if (error instanceof Error) {
      // Don't expose internal Twilio errors in production
      if (this.config.isProduction) {
        return "Failed to send SMS. Please try again later.";
      }
      return error.message;
    }

    if (error?.message) {
      return this.config.isProduction
        ? "Failed to send SMS. Please try again later."
        : error.message;
    }

    return "Failed to send SMS";
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Twilio error codes that are retryable
    const retryableErrorCodes = [
      20429, // Too Many Requests
      21610, // Message cannot be sent to the destination number
      30001, // Queue overflow
      30002, // Account suspended
      30003, // Unreachable destination handset
      30004, // Message blocked
      30005, // Unknown destination handset
      30006, // Landline or unreachable carrier
    ];

    if (error?.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }

    // Network errors are generally retryable
    if (
      error?.message?.includes("ECONNRESET") ||
      error?.message?.includes("ETIMEDOUT") ||
      error?.message?.includes("ENOTFOUND")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get comprehensive rate limit status for a user
   */
  async getRateLimitStatus(userId: string): Promise<
    {
      hourlyRemaining: number;
      dailyRemaining: number;
      monthlyCostUSD: number;
      maxMonthlyCostUSD: number;
    } | null
  > {
    try {
      const usage = await this.rateLimiter.getUserUsageStats(userId);
      if (!usage) return null;

      return {
        hourlyRemaining: Math.max(
          0,
          this.config.smsLimits.maxSMSPerUserPerHour - usage.hourlyCount,
        ),
        dailyRemaining: Math.max(
          0,
          this.config.smsLimits.maxSMSPerUserPerDay - usage.dailyCount,
        ),
        monthlyCostUSD: usage.monthlyCostUSD,
        maxMonthlyCostUSD: this.config.smsLimits.maxMonthlyCostUSD,
      };
    } catch (error) {
      console.error("Failed to get rate limit status:", error);
      return null;
    }
  }

  /**
   * Check if SMS service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.twilio.accountSid &&
      this.config.twilio.authToken &&
      this.config.twilio.phoneNumber
    );
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    configured: boolean;
    environment: string;
    limits: typeof this.config.smsLimits;
  } {
    return {
      configured: this.isConfigured(),
      environment: process.env.NODE_ENV || "unknown",
      limits: this.config.smsLimits,
    };
  }
}
