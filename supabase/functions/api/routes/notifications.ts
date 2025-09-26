// Notifications routes
import { Hono } from "jsr:@hono/hono";
import { asyncHandler } from "../middleware/error-handler.ts";

const notifications = new Hono();

/**
 * GET /api/notifications
 * Fetch notifications for the authenticated user
 * Optional query parameters:
 * - since: Filter notifications since a time period (e.g., "24h", "7d", "30d")
 * - limit: Maximum number of notifications to return (default: 100)
 * Requires authentication middleware
 */
notifications.get(
  "/",
  asyncHandler(async (c) => {
    const userId = c.get("userId");
    const supabase = c.get("supabase");

    if (!userId || !supabase) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      // Parse query parameters
      const since = c.req.query("since");
      const limitParam = c.req.query("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : 100;

      // Validate limit
      if (isNaN(limit) || limit < 1 || limit > 1000) {
        return c.json({
          error: "Invalid limit parameter",
          message: "Limit must be between 1 and 1000",
        }, 400);
      }

      // Build query
      let query = supabase
        .from("notifications")
        .select(`
        id,
        monitor_id,
        type,
        channel,
        message,
        status,
        error_message,
        message_id,
        created_at,
        sent_at,
        monitors:monitor_id (
          name,
          url
        )
      `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      // Add time filter if provided
      if (since) {
        const sinceDate = parseSinceParameter(since);
        if (!sinceDate) {
          return c.json({
            error: "Invalid since parameter",
            message: 'Use formats like "24h", "7d", "30d", or ISO date string',
          }, 400);
        }
        query = query.gte("created_at", sinceDate.toISOString());
      }

      // Execute query
      const { data: notifications, error } = await query;

      if (error) {
        console.error("Database error fetching notifications:", error);
        return c.json({
          error: "Failed to fetch notifications",
          details: error.message,
        }, 500);
      }

      // Return notifications data with proper formatting
      return c.json({
        success: true,
        data: notifications || [],
        count: notifications?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Unexpected error in notifications GET:", error);
      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while fetching notifications",
      }, 500);
    }
  }),
);

/**
 * Parse "since" parameter into a Date object
 * Supports formats like "24h", "7d", "30d" or ISO date strings
 */
function parseSinceParameter(since: string): Date | null {
  try {
    // Try parsing as ISO date string first
    const isoDate = new Date(since);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Parse relative time formats
    const match = since.match(/^(\d+)([hdw])$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case "h": // hours
        return new Date(now.getTime() - value * 60 * 60 * 1000);
      case "d": // days
        return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
      case "w": // weeks
        return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export { notifications };
