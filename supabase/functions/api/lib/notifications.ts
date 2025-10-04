// Notification handling service
import { type SMSMessage, type SMSResult, SMSService } from "./sms-service.ts";
import { Resend } from "npm:resend@6.1.2";

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
  type: "pattern_found" | "pattern_lost" | "error";
  contentSnippet?: string;
  errorMessage?: string;
}

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
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

    const notificationResults = await Promise.allSettled(notificationPromises);

    for (let i = 0; i < notificationResults.length; i++) {
      const result = notificationResults[i];
      const channel = channels[i];

      if (result.status === "fulfilled") {
        results.push(result.value);
        await this.logNotification(payload, channel, result.value);
      } else {
        const errorResult: NotificationResult = {
          success: false,
          channel,
          error: (() => {
            const reason = (result as PromiseRejectedResult).reason;
            if (
              typeof reason === "object" && reason &&
              "message" in (reason as Record<string, unknown>) &&
              typeof (reason as { message?: unknown }).message === "string"
            ) return (reason as { message: string }).message;
            return "Unknown error";
          })(),
        };
        results.push(errorResult);
        await this.logNotification(payload, channel, errorResult);
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
    await Promise.resolve();
    const message = this.formatEmailMessage(payload);

    console.log("Email notification:", {
      to: channel.address,
      subject: this.getEmailSubject(payload),
      message,
    });

    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    resend.emails.send({
      from: "notifications@roorooroo.com",
      to: channel.address,
      subject: this.getEmailSubject(payload),
      html: this.formatEmailMessage(payload),
    });

    return {
      success: true,
      channel,
      messageId: `email_${Date.now()}_${
        Math.random().toString(36).slice(2, 9)
      }`,
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
    const { monitor, type, contentSnippet, errorMessage } = payload;

    let message = `🐕 RooRooRoo Alert!\n\n`;

    switch (type) {
      case "pattern_found":
        message += `Your watcher "${monitor.name}" found a match!\n\n`;
        message += `Website: ${monitor.url}\n`;
        message += `Pattern: "${monitor.pattern}"\n`;
        if (contentSnippet) {
          message += `\nContent found: "${contentSnippet}"\n`;
        }
        break;

      case "pattern_lost":
        message += `Your watcher "${monitor.name}" lost the pattern!\n\n`;
        message += `Website: ${monitor.url}\n`;
        message += `Pattern: "${monitor.pattern}"\n`;
        message += `\nThe pattern is no longer found on the page.\n`;
        break;

      case "error":
        message += `Your watcher "${monitor.name}" encountered an error!\n\n`;
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
    const { monitor, type, contentSnippet, errorMessage } = payload;

    let message = `🐕 RooRooRoo Alert: `;

    switch (type) {
      case "pattern_found":
        message += `"${monitor.name}" found match!`;
        if (contentSnippet && contentSnippet.length < 50) {
          message += ` Found: "${contentSnippet}"`;
        }
        break;

      case "pattern_lost":
        message += `"${monitor.name}" lost pattern!`;
        break;

      case "error":
        message += `"${monitor.name}" error!`;
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
    const { monitor, type } = payload;

    switch (type) {
      case "pattern_found":
        return `🐕 RooRooRoo Alert: ${monitor.name} - Pattern Found`;
      case "pattern_lost":
        return `🐕 RooRooRoo Alert: ${monitor.name} - Pattern Lost`;
      case "error":
        return `🐕 RooRooRoo Alert: ${monitor.name} - Error`;
      default:
        return `🐕 RooRooRoo Alert: ${monitor.name}`;
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
        ? this.formatEmailMessage(payload)
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

  async getNotificationStats(
    userId: string,
    timeframe: "hour" | "day" | "week" = "day",
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    byChannel: Record<string, number>;
  }> {
    try {
      const { createServiceClient } = await import("./supabase.ts");
      const supabase = createServiceClient();

      const timeFilter = new Date();
      switch (timeframe) {
        case "hour":
          timeFilter.setHours(timeFilter.getHours() - 1);
          break;
        case "day":
          timeFilter.setDate(timeFilter.getDate() - 1);
          break;
        case "week":
          timeFilter.setDate(timeFilter.getDate() - 7);
          break;
      }

      const { data: notifications, error } = await supabase
        .from("notifications")
        .select("status, channel")
        .eq("user_id", userId)
        .gte("sent_at", timeFilter.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        total: notifications?.length || 0,
        successful: notifications?.filter((n) => n.status === "sent").length ||
          0,
        failed: notifications?.filter((n) => n.status === "failed").length || 0,
        byChannel: {} as Record<string, number>,
      };

      notifications?.forEach((notification) => {
        stats.byChannel[notification.channel] =
          (stats.byChannel[notification.channel] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error("Failed to get notification stats:", error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        byChannel: {},
      };
    }
  }
}
