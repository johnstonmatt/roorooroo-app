// Monitor checking logic routes
import { Hono } from "jsr:@hono/hono@4.9.8";
import type { AppVariables } from "../types.ts";
import { validateAndThrow } from "../lib/validation.ts";
import { NotificationService } from "../lib/notifications.ts";

const monitorCheck = new Hono<{ Variables: AppVariables }>();

interface MonitorCheckRequest {
  monitor_id: string;
  user_id: string;
}

interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  pattern: string;
  pattern_type: "contains" | "not_contains" | "regex";
  notification_channels: Array<{
    type: "email" | "sms";
    address: string;
  }>;
  last_status: string;
  is_active: boolean;
}

/**
 * POST /api/monitors/check
 * invoked by cron job, not user
 * Execute a monitor check for a specific monitor
 */
monitorCheck.post(
  "/",
  async (c) => {
    const supabase = c.get("supabase");

    try {
      // Parse and validate request body
      const body = await c.req.json();

      // Define validation schema for monitor check request
      const checkSchema = {
        monitor_id: { required: true, type: "string" as const, minLength: 1 },
        user_id: { required: true, type: "string" as const, minLength: 1 },
      };
      console.log("REQUEST BODY:");
      console.log(JSON.stringify(body));

      if (!supabase) {
        return c.json(
          { error: "Authorized Supabase client not found", body },
          401,
        );
      }

      validateAndThrow(checkSchema, body);

      const { monitor_id, user_id } = body as MonitorCheckRequest;

      // Fetch the monitor from database
      const { data: monitor, error: fetchError } = await supabase
        .from("monitors")
        .select(`
        id,
        user_id,
        name,
        url,  
        pattern,
        pattern_type,
        notification_channels,
        last_status,
        is_active
      `)
        .eq("id", monitor_id)
        .eq("user_id", user_id) // Ensure user can only check their own monitors
        .single();

      if (fetchError || !monitor) {
        console.error("Monitor not found or access denied:", fetchError);
        return c.json({
          error: "Monitor not found or access denied",
          details: fetchError?.message,
        }, 404);
      }

      if (!monitor.is_active) {
        return c.json({
          error: "Monitor is not active",
          message: "Cannot check inactive monitors",
        }, 400);
      }

      // Perform the monitor check
      const checkResult = await performMonitorCheck(monitor as Monitor);

      // Log the check result
      await logMonitorCheck(
        supabase as unknown as SupabaseLike,
        monitor.id,
        checkResult,
      );

      // Update monitor's last_checked and last_status
      await supabase
        .from("monitors")
        .update({
          last_checked: new Date().toISOString(),
          last_status: checkResult.status,
        })
        .eq("id", monitor.id);

      // Send notifications only for actionable status transitions to reduce cost
      // - Entering error from any non-error state => notify "error"
      // - Any transition into "found" => notify "pattern_found"
      // - Transition from "found" to "not_found" => notify "pattern_lost"
      // - Initial transition from "pending" to "not_found" => do NOT notify
      if (
        checkResult.status !== monitor.last_status &&
        monitor.notification_channels?.length > 0
      ) {
        const notificationService = new NotificationService();

        let shouldNotify = false;
        let notificationType:
          | "pattern_found"
          | "pattern_lost"
          | "error"
          | null = null;

        const prev = (monitor.last_status || "pending") as
          | "pending"
          | "found"
          | "not_found"
          | "error";
        const next = checkResult.status as "found" | "not_found" | "error";

        if (next === "error") {
          // Notify when entering error state (from any non-error state)
          if (prev !== "error") {
            shouldNotify = true;
            notificationType = "error";
          }
        } else if (next === "found") {
          // Notify when pattern becomes found from any non-found state
          if (prev !== "found") {
            shouldNotify = true;
            notificationType = "pattern_found";
          }
        } else if (next === "not_found") {
          // Only notify loss when transitioning from found to not_found
          if (prev === "found") {
            shouldNotify = true;
            notificationType = "pattern_lost";
          }
        }

        if (shouldNotify && notificationType) {
          try {
            console.log(`Sending ${notificationType} notification...`);
            await notificationService.sendNotifications(
              {
                monitor: monitor as Monitor,
                type: notificationType,
                contentSnippet: checkResult.contentSnippet,
                errorMessage: checkResult.errorMessage,
              },
              monitor.notification_channels,
            );
          } catch (notificationError) {
            console.error("Failed to send notifications:", notificationError);
            // Don't fail the check if notifications fail
          }
        } else {
          // Skip notifications for non-actionable transitions (e.g., initial not_found)
          console.log(
            `Skipping notifications for transition from ${prev} to ${next}`,
          );
        }
      }

      // Return success response
      return c.json({
        success: true,
        data: {
          monitorId: monitor.id,
          status: checkResult.status,
          responseTime: checkResult.responseTime,
          contentSnippet: checkResult.contentSnippet,
          errorMessage: checkResult.errorMessage,
          statusChanged: checkResult.status !== monitor.last_status,
          checkedAt: new Date().toISOString(),
        },
        message: "Monitor check completed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Unexpected error in monitor check:", error);

      // Handle validation errors specifically
      if (error instanceof Error && error.name === "ValidationError") {
        return c.json({
          error: "Validation failed",
          message: error.message,
        }, 400);
      }

      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while checking the monitor",
      }, 500);
    }
  },
);

/**
 * Perform the actual monitor check by fetching the URL and checking the pattern
 */
async function performMonitorCheck(monitor: Monitor): Promise<{
  status: "found" | "not_found" | "error";
  responseTime: number;
  contentSnippet?: string;
  errorMessage?: string;
}> {
  const startTime = Date.now();

  try {
    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(monitor.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "RooRooRoo-Monitor/1.0 (Website Monitor)",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: "error",
        responseTime,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Get response content
    const content = await response.text();

    // Check pattern based on pattern type
    const patternResult = checkPattern(
      content,
      monitor.pattern,
      monitor.pattern_type,
    );

    return {
      status: patternResult.found ? "found" : "not_found",
      responseTime,
      contentSnippet: patternResult.snippet,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        errorMessage = "Request timeout (30 seconds)";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      status: "error",
      responseTime,
      errorMessage,
    };
  }
}

/**
 * Check if pattern matches content based on pattern type
 */
function checkPattern(content: string, pattern: string, patternType: string): {
  found: boolean;
  snippet?: string;
} {
  try {
    switch (patternType) {
      case "contains": {
        const containsMatch = content.toLowerCase().includes(
          pattern.toLowerCase(),
        );
        if (containsMatch) {
          // Find the snippet around the match
          const index = content.toLowerCase().indexOf(pattern.toLowerCase());
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + pattern.length + 50);
          const snippet = content.substring(start, end).trim();
          return { found: true, snippet };
        }
        return { found: false };
      }

      case "not_contains": {
        const notContainsMatch = !content.toLowerCase().includes(
          pattern.toLowerCase(),
        );
        return { found: notContainsMatch };
      }

      case "regex": {
        const regex = new RegExp(pattern, "i"); // Case insensitive
        const regexMatch = regex.exec(content);
        if (regexMatch) {
          // Get the matched text and some context
          const matchText = regexMatch[0];
          const index = regexMatch.index;
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + matchText.length + 50);
          const snippet = content.substring(start, end).trim();
          return { found: true, snippet };
        }
        return { found: false };
      }

      default:
        throw new Error(`Unsupported pattern type: ${patternType}`);
    }
  } catch (error) {
    console.error("Pattern matching error:", error);
    // If pattern matching fails, treat as not found
    return { found: false };
  }
}

/**
 * Log the monitor check result to the database
 */
type SupabaseLike = {
  from: (table: string) => {
    insert: (data: Record<string, unknown>) => Promise<unknown>;
  };
};

async function logMonitorCheck(
  supabase: SupabaseLike,
  monitorId: string,
  result: {
    status: "found" | "not_found" | "error";
    responseTime: number;
    contentSnippet?: string;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    await supabase
      .from("monitor_logs")
      .insert({
        monitor_id: monitorId,
        status: result.status,
        response_time: result.responseTime,
        content_snippet: result.contentSnippet || null,
        error_message: result.errorMessage || null,
        checked_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error("Failed to log monitor check:", error);
    // Don't throw here as we don't want logging failures to break the check
  }
}

export { monitorCheck };
