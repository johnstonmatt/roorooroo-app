// Notification handling service
import { type SMSMessage, type SMSResult, SMSService } from "./sms-service.ts";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types.ts";
import { frontendUrl, logger } from "./config.ts";

export type Status = "found" | "not_found" | "error" | "pending";

/** Every status except "pending", which is a starting state, not a result. */
export type NotificationType = Exclude<Status, "pending">;

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

/**
 * Narrow the monitors.notification_channels jsonb column.
 *
 * The column has no shape in the schema, so this validates rather than
 * asserting: a malformed entry is dropped instead of crashing the send path
 * with an undefined address.
 */
export function parseNotificationChannels(
  value: unknown,
): NotificationChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is NotificationChannel => {
    if (typeof entry !== "object" || entry === null) return false;
    const channel = entry as Record<string, unknown>;
    return (channel.type === "email" || channel.type === "sms") &&
      typeof channel.address === "string" && channel.address.length > 0;
  });
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

/**
 * Escape values that end up in the HTML body.
 *
 * contentSnippet is a slice of a page we do not control, so it is markup by
 * definition. Interpolating it raw would let a watched page inject arbitrary
 * HTML into the alert email.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The Resend client is stateless and holds only the API key, so one per
 * isolate is enough. Building it per send re-ran that setup on every email.
 */
let resendClient: Resend | null = null;
function getResend(apiKey: string): Resend {
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

/** Where alert email comes from. Overridable so a preview branch can differ. */
function fromAddress(): string {
  return Deno.env.get("NOTIFICATION_FROM_EMAIL") ??
    "notifications@roorooroo.com";
}

export class NotificationService {
  private smsService: SMSService;

  /**
   * Takes the admin client from the request context rather than building its
   * own. Client construction is withSupabase's job now, and a service client
   * assembled here would bypass the env resolution it performs.
   */
  constructor(private supabase: SupabaseClient<Database>) {
    this.smsService = new SMSService();
  }

  /**
   * Send notifications to all configured channels.
   *
   * Never rejects: a per-channel failure is reported in the returned results,
   * so the caller must read them to know whether anything was actually
   * delivered. Treating "did not throw" as success reported didNotify: true
   * during a total Resend and Twilio outage.
   */
  async sendNotifications(
    payload: NotificationPayload,
    channels: NotificationChannel[],
  ): Promise<NotificationResult[]> {
    const settled = await Promise.allSettled(
      channels.map((channel) => this.sendSingleNotification(payload, channel)),
    );

    const results: NotificationResult[] = settled.map((entry, index) =>
      entry.status === "fulfilled" ? entry.value : {
        success: false,
        payload,
        // Indexing by position: allSettled preserves input order, whereas the
        // previous indexOf(settled) matched the first structurally equal
        // entry and mislabelled the channel whenever two failed alike.
        channel: channels[index],
        error: entry.reason instanceof Error
          ? entry.reason.message
          : "Unknown error",
      }
    );

    for (const [index, entry] of settled.entries()) {
      if (entry.status === "rejected") {
        logger.error(
          `Notification to ${channels[index].type} rejected:`,
          entry.reason,
        );
      }
      await this.logNotification(
        payload,
        results[index].channel,
        results[index],
      );
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
    const apiKey = Deno.env.get("RESEND_API_KEY");

    if (!apiKey) {
      logger.error("'RESEND_API_KEY' is not set");
      return { success: false, channel, error: "Email service not configured" };
    }

    const { subject, text, html } = buildEmail(payload);

    let response;
    try {
      response = await getResend(apiKey).emails.send({
        from: fromAddress(),
        to: channel.address,
        subject,
        // Both parts: the body used to be newline-separated plain text handed
        // to `html`, which every client rendered as one unbroken paragraph.
        text,
        html,
      });
    } catch (error) {
      logger.error("Failed to send email:", error);
      return {
        success: false,
        channel,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    if (response?.error) {
      logger.error("resend failed to send:", response.error);
      return { success: false, channel, error: response.error.message };
    }

    if (!response?.data?.id) {
      return {
        success: false,
        channel,
        error: "Resend returned no message id",
      };
    }

    return { success: true, channel, messageId: response.data.id };
  }

  private async sendSMSNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
  ): Promise<NotificationResult> {
    const smsMessage: SMSMessage = {
      to: channel.address,
      message: buildSMS(payload),
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

  /**
   * Record what was sent.
   *
   * supabase-js resolves with `{ error }` instead of rejecting, so the
   * try/catch this replaced could never fire and every failed insert was
   * discarded silently.
   */
  private async logNotification(
    payload: NotificationPayload,
    channel: NotificationChannel,
    result: NotificationResult,
  ): Promise<void> {
    const message = channel.type === "email"
      ? (() => {
        const { subject, text } = buildEmail(payload);
        return `Subject: ${subject}\n\n${text}`;
      })()
      : buildSMS(payload);

    const { error } = await this.supabase.from("notifications").insert({
      monitor_id: payload.monitor.id,
      user_id: payload.monitor.user_id,
      type: payload.type,
      channel: channel.type,
      message,
      status: result.success ? "sent" : "failed",
    });

    if (error) {
      logger.error(
        `Failed to log ${channel.type} notification for monitor ${payload.monitor.id}: ${error.message}`,
      );
    }
  }
}

/** The lines of an alert, shared by the text and HTML renderings. */
function bodyLines(payload: NotificationPayload): string[] {
  const { monitor, type, contentSnippet, errorMessage } = payload;
  const lines: string[] = [];

  switch (type) {
    case "found":
      lines.push(`Your watcher "${monitor.name}" found a match!`);
      lines.push(`Website: ${monitor.url}`);
      lines.push(`Pattern: "${monitor.pattern}"`);
      if (contentSnippet) lines.push(`Content found: "${contentSnippet}"`);
      break;

    case "not_found":
      lines.push(`Your watcher "${monitor.name}" doesn't match your pattern!`);
      lines.push(`Website: ${monitor.url}`);
      lines.push(`Pattern: "${monitor.pattern}"`);
      lines.push("The pattern is no longer found on the page.");
      break;

    case "error":
      lines.push(
        `Your watcher "${monitor.name}" encountered an error at ${monitor.url}!`,
      );
      lines.push(`Website: ${monitor.url}`);
      if (errorMessage) lines.push(`Error: ${errorMessage}`);
      break;
  }

  lines.push(`Time: ${new Date().toISOString()}`);
  return lines;
}

export function buildEmail(
  payload: NotificationPayload,
): { subject: string; text: string; html: string } {
  const { monitor, type, reason } = payload;
  const prefix = subjectPrefixFor(reason);
  const dashboard = `${frontendUrl()}/dashboard`;

  const subject = type === "found"
    ? `${prefix} ${monitor.name} - Pattern Found`
    : type === "not_found"
    ? `${prefix} ${monitor.name} - Pattern Not Found`
    : type === "error"
    ? `${prefix} ${monitor.name} - Error`
    : `${prefix} ${monitor.name}`;

  const lines = bodyLines(payload);

  const text = [
    headline(reason),
    "",
    ...lines,
    "",
    `View your dashboard: ${dashboard}`,
  ].join("\n");

  const html = [
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;color:#111">`,
    `<h2 style="margin:0 0 16px">${escapeHtml(headline(reason))}</h2>`,
    ...lines.map((line) => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`),
    `<p style="margin:20px 0 0"><a href="${
      escapeHtml(dashboard)
    }">View your dashboard</a></p>`,
    `</div>`,
  ].join("");

  return { subject, text, html };
}

export function buildSMS(payload: NotificationPayload): string {
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
