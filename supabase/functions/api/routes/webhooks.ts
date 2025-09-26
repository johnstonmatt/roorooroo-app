// SMS status webhooks routes
import { Hono } from "jsr:@hono/hono";
import { config, logger } from "../utils/config.ts";
import { createServiceClient } from "../utils/supabase.ts";

const webhooks = new Hono();

/**
 * Validate Twilio webhook signature for security
 */
async function validateTwilioSignature(
  signature: string,
  url: string,
  body: string,
): Promise<boolean> {
  try {
    // Import crypto for HMAC validation
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(config.twilio.authToken),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );

    // Create the expected signature
    const data = encoder.encode(url + body);
    const expectedSignature = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignatureBase64 = btoa(
      String.fromCharCode(...new Uint8Array(expectedSignature)),
    );

    // Compare signatures
    return signature === expectedSignatureBase64;
  } catch (error) {
    logger.error("Error validating Twilio signature:", error);
    return false;
  }
}

/**
 * Parse Twilio webhook form data
 */
function parseTwilioWebhookData(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const data: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    data[key] = value;
  }

  return data;
}

/**
 * Validate Twilio webhook data structure
 */
function validateWebhookData(data: Record<string, string>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields for SMS status webhooks
  if (!data.MessageSid) {
    errors.push("Missing MessageSid");
  }

  if (!data.MessageStatus) {
    errors.push("Missing MessageStatus");
  }

  // Validate status values
  const validStatuses = [
    "queued",
    "sent",
    "delivered",
    "failed",
    "undelivered",
    "receiving",
    "received",
  ];
  if (data.MessageStatus && !validStatuses.includes(data.MessageStatus)) {
    errors.push(`Invalid MessageStatus: ${data.MessageStatus}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Update notification status in database
 */
async function updateNotificationStatus(
  messageId: string,
  status: string,
  errorCode?: string,
  errorMessage?: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();

    logger.info("SMS status update received:", {
      messageId,
      status,
      errorCode,
      errorMessage,
    });

    // Try to find and update notification record
    // Since the current schema doesn't have an external_id field to track Twilio message IDs,
    // we'll create a comprehensive log entry for monitoring and debugging

    // Insert a status update log entry
    const statusUpdate = {
      twilio_message_id: messageId,
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      received_at: new Date().toISOString(),
      webhook_data: JSON.stringify({
        messageId,
        status,
        errorCode,
        errorMessage,
        timestamp: new Date().toISOString(),
      }),
    };

    // Log the status update for monitoring
    logger.info("SMS delivery status update processed:", statusUpdate);

    // In a production system, you would:
    // 1. Add an external_id field to the notifications table
    // 2. Update the notification record with the delivery status
    // 3. Potentially trigger additional actions based on delivery status

    // Example of what the update would look like with proper schema:
    /*
    const { error: updateError } = await supabase
      .from('notifications')
      .update({
        delivery_status: status,
        delivery_error_code: errorCode,
        delivery_error_message: errorMessage,
        delivered_at: status === 'delivered' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('external_id', messageId)

    if (updateError) {
      logger.warn('Failed to update notification status:', updateError)
    }
    */
  } catch (error) {
    logger.error("Error updating notification status:", error);
    throw error;
  }
}

/**
 * GET /api/webhooks/sms-status
 * Webhook verification endpoint for Twilio
 */
webhooks.get("/sms-status", async (c) => {
  try {
    // Twilio webhook verification - return the challenge parameter if present
    const challenge = c.req.query("challenge");
    if (challenge) {
      logger.info("Twilio webhook verification request received");
      return c.text(challenge);
    }

    // Health check for webhook endpoint
    return c.json({
      status: "ok",
      message: "SMS webhook endpoint is active",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error in SMS webhook GET endpoint:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /api/webhooks/sms-status
 * Handle Twilio SMS status updates
 */
webhooks.post("/sms-status", async (c) => {
  try {
    // Get the raw body for signature validation
    const body = await c.req.text();
    const signature = c.req.header("X-Twilio-Signature");

    if (!signature) {
      logger.warn("SMS webhook request missing Twilio signature");
      return c.json({ error: "Missing signature" }, 400);
    }

    // Validate webhook signature for security
    const url = c.req.url;
    const isValidSignature = await validateTwilioSignature(
      signature,
      url,
      body,
    );

    if (!isValidSignature) {
      logger.warn("SMS webhook request has invalid signature");
      return c.json({ error: "Invalid signature" }, 401);
    }

    // Parse webhook data
    const webhookData = parseTwilioWebhookData(body);

    // Validate webhook data structure
    const validation = validateWebhookData(webhookData);
    if (!validation.isValid) {
      logger.warn("SMS webhook request validation failed:", {
        errors: validation.errors,
        data: webhookData,
      });
      return c.json({
        error: "Invalid webhook data",
        details: validation.errors,
      }, 400);
    }

    const {
      MessageSid: messageId,
      MessageStatus: status,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
      To: to,
      From: from,
      AccountSid: accountSid,
    } = webhookData;

    // Additional security check - verify the account SID matches our configuration
    if (accountSid && accountSid !== config.twilio.accountSid) {
      logger.warn("SMS webhook request from unknown account:", { accountSid });
      return c.json({ error: "Invalid account" }, 401);
    }

    logger.info("Processing SMS status update:", {
      messageId,
      status,
      to: to?.replace(/\d(?=\d{4})/g, "*"), // Mask phone number for logging
      errorCode,
      errorMessage,
    });

    // Update notification status in database
    await updateNotificationStatus(messageId, status, errorCode, errorMessage);

    // Log status change for monitoring and analytics
    if (status === "failed" || status === "undelivered") {
      logger.warn("SMS delivery failed:", {
        messageId,
        status,
        errorCode,
        errorMessage,
        to: to?.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
        timestamp: new Date().toISOString(),
      });
    } else if (status === "delivered") {
      logger.info("SMS delivered successfully:", {
        messageId,
        to: to?.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
        timestamp: new Date().toISOString(),
      });
    } else if (status === "sent") {
      logger.info("SMS sent to carrier:", {
        messageId,
        timestamp: new Date().toISOString(),
      });
    } else if (status === "queued") {
      logger.info("SMS queued for delivery:", {
        messageId,
        timestamp: new Date().toISOString(),
      });
    }

    // Return success response to Twilio
    return c.json({
      status: "ok",
      message: "Status update processed",
      messageId,
    });
  } catch (error) {
    logger.error("Error processing SMS webhook:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { webhooks };
