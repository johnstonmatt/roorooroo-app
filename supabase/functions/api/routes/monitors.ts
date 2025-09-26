// Monitor CRUD operations routes
import { Hono } from "jsr:@hono/hono";
import { asyncHandler } from "../middleware/error-handler.ts";
import { commonSchemas, validateAndThrow } from "../utils/validation.ts";
import { createMonitorCronJob, validateCronJobConfig } from "../utils/cron.ts";

const monitors = new Hono();

/**
 * GET /api/monitors
 * Fetch all monitors for the authenticated user
 * Requires authentication middleware
 */
monitors.get(
  "/",
  asyncHandler(async (c) => {
    const userId = c.get("userId");
    const supabase = c.get("supabase");

    if (!userId || !supabase) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      // Fetch user's monitors with proper ordering (newest first)
      const { data: monitors, error } = await supabase
        .from("monitors")
        .select(`
        id,
        user_id,
        name,
        url,
        pattern,
        pattern_type,
        check_interval,
        is_active,
        last_checked,
        last_status,
        notification_channels,
        created_at,
        updated_at
      `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database error fetching monitors:", error);
        return c.json({
          error: "Failed to fetch monitors",
          details: error.message,
        }, 500);
      }

      // Return monitors data with proper formatting
      return c.json({
        success: true,
        data: monitors || [],
        count: monitors?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Unexpected error in monitors GET:", error);
      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while fetching monitors",
      }, 500);
    }
  }),
);

/**
 * POST /api/monitors
 * Create a new monitor for the authenticated user
 * Requires authentication middleware
 */
monitors.post(
  "/",
  asyncHandler(async (c) => {
    const userId = c.get("userId");
    const supabase = c.get("supabase");

    if (!userId || !supabase) {
      return c.json({ error: "Authentication required" }, 401);
    }

    try {
      // Parse and validate request body
      const body = await c.req.json();

      // Define validation schema for monitor creation
      const monitorSchema = {
        name: {
          required: true,
          type: "string" as const,
          minLength: 1,
          maxLength: 100,
        },
        url: { required: true, type: "url" as const },
        pattern: {
          required: true,
          type: "string" as const,
          minLength: 1,
          maxLength: 500,
        },
        pattern_type: {
          required: false,
          type: "string" as const,
          enum: ["contains", "not_contains", "regex"],
        },
        check_interval: {
          required: true,
          type: "number" as const,
          min: 60,
          max: 86400,
        },
        notification_channels: {
          required: true,
          custom: (value: any) => {
            if (
              !Array.isArray(value)
            ) return "notification_channels must be an array";
            if (
              value.length === 0
            ) return "At least one notification channel is required";
            if (
              value.length > 5
            ) return "Maximum 5 notification channels allowed";

            for (const channel of value) {
              if (!channel.type || !["email", "sms"].includes(channel.type)) {
                return "Each notification channel must have a valid type (email or sms)";
              }
              if (!channel.address || typeof channel.address !== "string") {
                return "Each notification channel must have a valid address";
              }
            }
            return true;
          },
        },
      };

      // Validate the request data
      validateAndThrow(monitorSchema, body);

      // Prepare monitor data for database insertion
      const monitorData = {
        user_id: userId,
        name: body.name.trim(),
        url: body.url.trim(),
        pattern: body.pattern.trim(),
        pattern_type: body.pattern_type || "contains",
        check_interval: body.check_interval,
        notification_channels: body.notification_channels,
        is_active: true,
        last_status: "pending",
      };

      // Insert monitor into database
      const { data: monitor, error: insertError } = await supabase
        .from("monitors")
        .insert(monitorData)
        .select()
        .single();

      if (insertError) {
        console.error("Database error creating monitor:", insertError);
        return c.json({
          error: "Failed to create monitor",
          details: insertError.message,
        }, 500);
      }

      // Create cron job for the monitor
      const cronConfig = {
        monitorId: monitor.id,
        checkInterval: body.check_interval,
        userId: userId,
      };

      // Validate cron job configuration
      const cronValidationErrors = validateCronJobConfig(cronConfig);
      if (cronValidationErrors.length > 0) {
        console.error("Cron job validation failed:", cronValidationErrors);
        // Don't fail the monitor creation, but log the error
        await supabase
          .from("monitor_logs")
          .insert({
            monitor_id: monitor.id,
            status: "error",
            error_message: `Cron job validation failed: ${
              cronValidationErrors.join(", ")
            }`,
            checked_at: new Date().toISOString(),
          });
      } else {
        // Create the cron job
        const cronJobCreated = await createMonitorCronJob(cronConfig);

        if (!cronJobCreated) {
          console.error("Failed to create cron job for monitor:", monitor.id);
          // Log the error but don't fail the monitor creation
          await supabase
            .from("monitor_logs")
            .insert({
              monitor_id: monitor.id,
              status: "error",
              error_message: "Failed to create cron job for automated checking",
              checked_at: new Date().toISOString(),
            });
        } else {
          // Log successful cron job creation
          await supabase
            .from("monitor_logs")
            .insert({
              monitor_id: monitor.id,
              status: "info",
              error_message:
                `Monitor created with automated checking every ${body.check_interval} seconds`,
              checked_at: new Date().toISOString(),
            });
        }
      }

      // Return success response with created monitor
      return c.json({
        success: true,
        data: monitor,
        message: "Monitor created successfully",
        timestamp: new Date().toISOString(),
      }, 201);
    } catch (error) {
      console.error("Unexpected error in monitor creation:", error);

      // Handle validation errors specifically
      if (error instanceof Error && error.name === "ValidationError") {
        return c.json({
          error: "Validation failed",
          message: error.message,
        }, 400);
      }

      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while creating the monitor",
      }, 500);
    }
  }),
);

/**
 * PUT /api/monitors/:id
 * Update an existing monitor for the authenticated user
 * Requires authentication middleware
 */
monitors.put(
  "/:id",
  asyncHandler(async (c) => {
    const userId = c.get("userId");
    const supabase = c.get("supabase");
    const monitorId = c.req.param("id");

    if (!userId || !supabase) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!monitorId) {
      return c.json({ error: "Monitor ID is required" }, 400);
    }

    try {
      // Parse and validate request body
      const body = await c.req.json();

      // Define validation schema for monitor updates (all fields optional)
      const updateSchema = {
        name: {
          required: false,
          type: "string" as const,
          minLength: 1,
          maxLength: 100,
        },
        url: { required: false, type: "url" as const },
        pattern: {
          required: false,
          type: "string" as const,
          minLength: 1,
          maxLength: 500,
        },
        pattern_type: {
          required: false,
          type: "string" as const,
          enum: ["contains", "not_contains", "regex"],
        },
        check_interval: {
          required: false,
          type: "number" as const,
          min: 60,
          max: 86400,
        },
        is_active: { required: false, type: "boolean" as const },
        notification_channels: {
          required: false,
          custom: (value: any) => {
            if (
              !Array.isArray(value)
            ) return "notification_channels must be an array";
            if (
              value.length === 0
            ) return "At least one notification channel is required";
            if (
              value.length > 5
            ) return "Maximum 5 notification channels allowed";

            for (const channel of value) {
              if (!channel.type || !["email", "sms"].includes(channel.type)) {
                return "Each notification channel must have a valid type (email or sms)";
              }
              if (!channel.address || typeof channel.address !== "string") {
                return "Each notification channel must have a valid address";
              }
            }
            return true;
          },
        },
      };

      // Validate the request data
      validateAndThrow(updateSchema, body);

      // Prepare update data (only include provided fields)
      const updateData: any = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.url !== undefined) updateData.url = body.url.trim();
      if (body.pattern !== undefined) updateData.pattern = body.pattern.trim();
      if (body.pattern_type !== undefined) {
        updateData.pattern_type = body.pattern_type;
      }
      if (body.check_interval !== undefined) {
        updateData.check_interval = body.check_interval;
      }
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.notification_channels !== undefined) {
        updateData
          .notification_channels = body.notification_channels;
      }

      // Add updated timestamp
      updateData.updated_at = new Date().toISOString();

      // Update monitor in database (ensure user owns the monitor)
      const { data: monitor, error: updateError } = await supabase
        .from("monitors")
        .update(updateData)
        .eq("id", monitorId)
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        console.error("Database error updating monitor:", updateError);
        return c.json({
          error: "Failed to update monitor",
          details: updateError.message,
        }, 500);
      }

      if (!monitor) {
        return c.json({
          error: "Monitor not found or access denied",
        }, 404);
      }

      // Return success response with updated monitor
      return c.json({
        success: true,
        data: monitor,
        message: "Monitor updated successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Unexpected error in monitor update:", error);

      // Handle validation errors specifically
      if (error instanceof Error && error.name === "ValidationError") {
        return c.json({
          error: "Validation failed",
          message: error.message,
        }, 400);
      }

      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while updating the monitor",
      }, 500);
    }
  }),
);

/**
 * DELETE /api/monitors/:id
 * Delete a monitor for the authenticated user
 * Requires authentication middleware
 */
monitors.delete(
  "/:id",
  asyncHandler(async (c) => {
    const userId = c.get("userId");
    const supabase = c.get("supabase");
    const monitorId = c.req.param("id");

    if (!userId || !supabase) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (!monitorId) {
      return c.json({ error: "Monitor ID is required" }, 400);
    }

    try {
      // Delete monitor from database (ensure user owns the monitor)
      const { data: monitor, error: deleteError } = await supabase
        .from("monitors")
        .delete()
        .eq("id", monitorId)
        .eq("user_id", userId)
        .select()
        .single();

      if (deleteError) {
        console.error("Database error deleting monitor:", deleteError);
        return c.json({
          error: "Failed to delete monitor",
          details: deleteError.message,
        }, 500);
      }

      if (!monitor) {
        return c.json({
          error: "Monitor not found or access denied",
        }, 404);
      }

      // Return success response
      return c.json({
        success: true,
        message: "Monitor deleted successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Unexpected error in monitor deletion:", error);
      return c.json({
        error: "Internal server error",
        message: "An unexpected error occurred while deleting the monitor",
      }, 500);
    }
  }),
);

export { monitors };
