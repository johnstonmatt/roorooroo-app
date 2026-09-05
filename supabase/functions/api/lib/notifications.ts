// Notification handling service
import { type SMSMessage, type SMSResult, SMSService } from "./sms-service.ts";
import { Resend } from "npm:resend@6.1.2";

export type Status = "found" | "not_found" | "error" | "pending";

export type NotificationType = Omit<"pending", Status>;

/**
 * Why a notification is being sent.
 * - "initial": first result for a monitor that had never been checked
 * - "changed": the status differs from the previous check
 * - "forced":  a manual run asked for a notification regardless of change,
 *              used by the debug button to exercise this path on demand
 */
export type NotifyReason = "initial" | "changed" | "forced";

export type NotificationSpec = {
  reason: NotifyReason;
  type: NotificationType;
};

/** Opening line, so a forced test is never mislabelled as setup. */
function headline(reason: NotifyReason): string {
  switch (reason) {
    case "initial":
      return "🐕 RooRooRoo Setup Successful!";
    case "forced":
      return "🐕 RooRooRoo Test Notification";
    default:
      return "🐕 RooRooRoo Alert!";
  }
}

function subjectPrefixFor(reason: NotifyReason): string {
  switch (reason) {
    case "initial":
      return "🐕 RooRooRoo Setup:";
    case "forced":
      return "🐕 RooRooRoo Test:";
    default:
      return "🐕 RooRooRoo Alert:";
  }
}

export interface NotificationChannel {
  type: "email" | "sms";
  address: string;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  pattern: string;
  pattern_type: string;
  user_id: string;
}

export interface NotificationPayload {
  monitor: Monitor;
  type: NotificationType;
  reason: NotifyReason;
  contentSnippet?: string;
  errorMessage?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  payload?: NotificationPayload;
  error?: string;
}

export class NotificationService {
  private smsService: SMSService;

  constructor() {
    this.smsService = new SMSService();
  }

  /**
   * Send notifications to all configured channels
   */
  async sendNotifications(
    payload: NotificationPayload,
    channels: NotificationChannel[],
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    const notificationPromises = channels.map((channel) =>
      this.sendSingleNotification(payload, channel)
    );

    const settledResults = await Promise.allSettled(notificationPromises);

    for (const settled of settledResults) {
      if (settled.status === "fulfilled") {
        results.push(settled.value);
        await this.logNotification(
          payload,
          settled.value.channel,
          settled.value,
        );
      } else {
        console.error("Notification promise rejected:", settled.reason);
        console.error("Failed Payload:", JSON.stringify(payload));
        results.push({
          success: false,
          payload,
          channel: channels[settledResults.indexOf(settled)],
          error: settled.reason instanceof Error
            ? settled.reason.message
            : "Unknown error",
        });
      }
    }

    return results;
  }

  private async sendSingleNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
  ): Promise<NotificationResult> {
    try {
      switch (channel.type) {
        case "email":
          return await this.sendEmailNotification(payload, channel);
        case "sms":
          return await this.sendSMSNotification(payload, channel);
        default:
          throw new Error(
            `Unsupported notification channel type: ${((channel as {
              type?: string;
            }).type ?? "unknown")}`,
          );
      }
    } catch (error) {
      return {
        success: false,
        channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async sendEmailNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
  ): Promise<NotificationResult> {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("'RESEND_API_KEY' is not set");
      return {
        success: false,
        channel,
        error: "Email service not configured",
      };
    }

    const resend = new Resend(RESEND_API_KEY);

    let response;
    try {
      response = await resend.emails.send({
        from: "notifications@roorooroo.com",
        to: channel.address,
        subject: this.getEmailSubject(payload),
        html: this.formatEmailMessage(payload),
      });
    } catch (error) {
      console.error("Failed to send email:", JSON.stringify(error));
      return {
        success: false,
        channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    if (response?.error) {
      console.error("resend failed to send", JSON.stringify(response.error));
      console.error("Failed Payload:", JSON.stringify(payload));
      return {
        success: false,
        channel,
        error: response.error.message,
      };
    }

    return {
      success: true,
      channel,
      messageId: response.data.id,
    };
  }

  private async sendSMSNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
  ): Promise<NotificationResult> {
    const message = this.formatSMSMessage(payload);

    const smsMessage: SMSMessage = {
      to: channel.address,
      message,
      monitorId: payload.monitor.id,
      userId: payload.monitor.user_id,
    };

    const result: SMSResult = await this.smsService.sendSMS(smsMessage);

    return {
      success: result.success,
      channel,
      messageId: result.messageId,
      error: result.error,
    };
  }

  private formatEmailMessage(payload: NotificationPayload): string {
    const { monitor, type, contentSnippet, errorMessage, reason } = payload;

    let message = `${headline(reason)}\n\n`;

    switch (type) {
      case "found":
        message += `Your watcher "${monitor.name}" found a match!\n\n`;
        message += `Website: ${monitor.url}\n`;
        message += `Pattern: "${monitor.pattern}"\n`;
        if (contentSnippet) {
          message += `\nContent found: "${contentSnippet}"\n`;
        }
        break;

      case "not_found":
        message +=
          `Your watcher "${monitor.name}" doesn't match your pattern!\n\n`;
        message += `Website: ${monitor.url}\n`;
        message += `Pattern: "${monitor.pattern}"\n`;
        message += `\nThe pattern is no longer found on the page.\n`;
        break;

      case "error":
        message +=
          `Your watcher "${monitor.name}" encountered an error at ${monitor.url}!\n\n`;
        message += `Website: ${monitor.url}\n`;
        if (errorMessage) {
          message += `Error: ${errorMessage}\n`;
        }
        break;
    }

    message += `\nTime: ${new Date().toLocaleString()}\n`;
    message += `\nView your dashboard: ${
      Deno.env.get("FRONTEND_URL") || "https://roorooroo.app"
    }/dashboard`;

    return message;
  }

  private formatSMSMessage(payload: NotificationPayload): string {
    const { monitor, type, contentSnippet, errorMessage, reason } = payload;

    let message = `${headline(reason)}\n\n`;

    switch (type) {
      case "found":
        message += `"${monitor.name}" found a match!`;
        if (contentSnippet && contentSnippet.length < 50) {
          message += ` Found: "${contentSnippet}"`;
        }
        break;

      case "not_found":
        message += `"${monitor.name}" did not find a match!`;
        break;

      case "error":
        message += `"${monitor.name}" error loading your page!`;
        if (errorMessage && errorMessage.length < 50) {
          message += ` ${errorMessage}`;
        }
        break;
    }

    message += ` ${monitor.url}`;

    if (message.length > 160) {
      message = message.substring(0, 157) + "...";
    }

    return message;
  }

  private getEmailSubject(payload: NotificationPayload): string {
    const { monitor, type, reason } = payload;

    const subjectPrefix = subjectPrefixFor(reason);

    switch (type) {
      case "found":
        return `${subjectPrefix} ${monitor.name} - Pattern Found`;
      case "not_found":
        return `${subjectPrefix} ${monitor.name} - Pattern Not Found`;
      case "error":
        return `${subjectPrefix} ${monitor.name} - Error`;
      default:
        return `${subjectPrefix} ${monitor.name}`;
    }
  }

  private async logNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
    result: NotificationResult,
  ): Promise<void> {
    try {
      const { createServiceClient } = await import("./supabase.ts");
      const supabase = createServiceClient();

      const message = channel.type === "email"
        ? `Subject: ${this.getEmailSubject(payload)}\n\n${
          this.formatEmailMessage(payload)
        }`
        : this.formatSMSMessage(payload);

      await supabase.from("notifications").insert({
        monitor_id: payload.monitor.id,
        user_id: payload.monitor.user_id,
        type: payload.type,
        channel: channel.type,
        message,
        status: result.success ? "sent" : "failed",
      });
    } catch (error) {
      console.error("Failed to log notification:", error);
    }
  }
}
