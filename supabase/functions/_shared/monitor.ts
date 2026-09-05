// Monitor checking logic
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types.ts";
import type {
  NotificationSpec,
  NotificationType,
  Status,
} from "./notifications.ts";

/**
 * Exactly what a check needs. Narrower than the monitors row on purpose: a
 * row from the generated types satisfies this structurally, so callers pass
 * it straight through without a cast.
 */
export interface MonitorCheckTarget {
  url: string;
  pattern: string;
  pattern_type: string;
}
/**
 * Perform the actual monitor check by fetching the URL and checking the pattern
 */
export async function performMonitorCheck(
  monitor: MonitorCheckTarget,
): Promise<{
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
export async function logMonitorCheck(
  supabase: SupabaseClient<Database>,
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

export function getNotificationSpec(
  lastStatus: Status,
  newStatus: NotificationType,
  force = false,
): NotificationSpec | null {
  // A forced run reports honestly as "forced" rather than borrowing the
  // "initial" wording, which would claim to be a setup confirmation.
  if (force) {
    return { reason: "forced", type: newStatus };
  }

  if (lastStatus === "pending") {
    return { reason: "initial", type: newStatus };
  }

  if (newStatus === lastStatus) {
    return null;
  }

  return { reason: "changed", type: newStatus };
}
