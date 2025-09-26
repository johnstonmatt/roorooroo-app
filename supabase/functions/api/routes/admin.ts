// Admin SMS cost monitoring routes
import { Hono } from "jsr:@hono/hono@4.9.8";
import type { AppVariables } from "../types.ts";
import { SMSCostMonitor } from "../lib/sms-costs.ts";
import { logger } from "../lib/config.ts";

const admin = new Hono<{ Variables: AppVariables }>();
const costMonitor = new SMSCostMonitor();

/**
 * GET /api/admin/sms-costs
 * Get system-wide SMS cost statistics and alerts
 */
admin.get(
  "/sms-costs",
  async (c) => {
    try {
      // Get system-wide cost statistics
      const systemStats = await costMonitor.getSystemCostStats();

      // Get users exceeding limits
      const usersExceedingLimits = await costMonitor.getUsersExceedingLimits();

      // Get cost projections for top users
      const topUserProjections = [];
      if (systemStats?.topUsers) {
        for (const user of systemStats.topUsers.slice(0, 5)) {
          const projection = await costMonitor.getCostProjection(user.userId);
          if (projection) {
            topUserProjections.push({
              userId: user.userId,
              ...projection,
            });
          }
        }
      }

      const response = {
        systemStats: systemStats || {
          totalMonthlyCostUSD: 0,
          totalMonthlyMessages: 0,
          activeUsers: 0,
          averageCostPerUser: 0,
          topUsers: [],
        },
        alerts: usersExceedingLimits,
        projections: topUserProjections,
        timestamp: new Date().toISOString(),
      };

      logger.info("Admin SMS costs retrieved", {
        activeUsers: response.systemStats.activeUsers,
        totalCost: response.systemStats.totalMonthlyCostUSD,
        alertCount: response.alerts.length,
      });

      return c.json(response);
    } catch (error) {
      logger.error("Failed to get admin SMS costs:", error);
      return c.json({
        error: "Failed to retrieve SMS cost data",
        message: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  },
);

/**
 * POST /api/admin/sms-costs
 * Admin actions for SMS cost management
 */
admin.post(
  "/sms-costs",
  async (c) => {
    try {
      const body = await c.req.json();
      const { action, userId } = body;

      // Validate required action field
      if (!action || typeof action !== "string") {
        return c.json({
          error: "Missing or invalid required field: action",
          validActions: [
            "reset-monthly-costs",
            "check-user-alert",
            "get-user-projection",
          ],
        }, 400);
      }

      // Validate userId when required
      if (["check-user-alert", "get-user-projection"].includes(action)) {
        if (!userId || typeof userId !== "string") {
          return c.json({
            error:
              `Missing or invalid required field: userId for ${action} action`,
          }, 400);
        }

        // Basic UUID validation for userId
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
          return c.json({
            error: "Invalid userId format - must be a valid UUID",
          }, 400);
        }
      }

      switch (action) {
        case "reset-monthly-costs": {
          logger.info("Admin initiated monthly cost reset");
          const result = await costMonitor.resetMonthlyCosts();

          if (result.error) {
            return c.json({
              error: "Failed to reset monthly costs",
              message: result.error,
            }, 500);
          }

          return c.json({
            success: true,
            message:
              `Successfully reset monthly costs for ${result.resetCount} users`,
            resetCount: result.resetCount,
            timestamp: new Date().toISOString(),
          });
        }

        case "check-user-alert": {
          if (!userId) {
            return c.json({
              error:
                "Missing required field: userId for check-user-alert action",
            }, 400);
          }

          const alert = await costMonitor.checkUserCostAlert(userId);

          return c.json({
            success: true,
            userId,
            alert: alert || null,
            timestamp: new Date().toISOString(),
          });
        }

        case "get-user-projection": {
          if (!userId) {
            return c.json({
              error:
                "Missing required field: userId for get-user-projection action",
            }, 400);
          }

          const projection = await costMonitor.getCostProjection(userId);

          return c.json({
            success: true,
            userId,
            projection: projection || null,
            timestamp: new Date().toISOString(),
          });
        }

        default:
          return c.json({
            error: `Unknown action: ${action}`,
            validActions: [
              "reset-monthly-costs",
              "check-user-alert",
              "get-user-projection",
            ],
          }, 400);
      }
    } catch (error) {
      logger.error("Admin SMS costs action failed:", error);

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        return c.json({
          error: "Invalid JSON in request body",
        }, 400);
      }

      return c.json({
        error: "Failed to process admin action",
        message: error instanceof Error ? error.message : "Unknown error",
      }, 500);
    }
  },
);

export { admin };
