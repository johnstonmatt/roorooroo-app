// Single Edge Function hosting the whole API surface.
//
// Order matters: withOpenAPI runs BEFORE withSupabase, so the document is
// public and undeclared paths 404 before reaching the auth gate. The handler
// then resolves and authorizes the monitor itself.
import { pipeline } from "@supabase/middleware";
import { withSupabase } from "@supabase/server";
import type { Database } from "../../db/database.types.ts";
import { apiDocument } from "../_shared/openapi-document.ts";
import { withOpenAPI } from "../_shared/with-openapi.ts";
import {
  getNotificationSpec,
  logMonitorCheck,
  performMonitorCheck,
} from "../_shared/monitor.ts";
import {
  NotificationService,
  parseNotificationChannels,
} from "../_shared/notifications.ts";
import type { Status } from "../_shared/notifications.ts";

export default {
  fetch: pipeline(
    [
      withOpenAPI({ document: apiDocument }),
      withSupabase<Database>({ auth: ["user", "secret"] }),
    ],
    async (req, ctx) => {
      let success = false;
      try {
        // Least privilege per caller. A user gets the RLS-scoped client, so
        // their own policies are a backstop and the user_id filter below is
        // defence in depth rather than the only thing between them and
        // another user's rows. Cron has no auth.uid() to scope by and
        // legitimately acts for a user it is not, so it needs the admin
        // client -- note ctx.supabase is RLS-restricted in secret mode too,
        // despite the docs describing it as full access.
        const supabase = ctx.authMode === "user"
          ? ctx.supabase
          : ctx.supabaseAdmin;

        let body: {
          monitor_id?: string;
          user_id?: string;
          force?: boolean;
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "body is not valid JSON" }, {
            status: 400,
          });
        }

        if (!body.monitor_id) {
          return Response.json({ error: "monitor_id is required" }, {
            status: 400,
          });
        }

        // The security rule: a user-mode caller is pinned to the subject in
        // their verified JWT, and any user_id in the body is discarded. Only
        // secret mode (pg_cron) is trusted to name a user.
        const userId = ctx.authMode === "user"
          ? ctx.userClaims?.id
          : body.user_id;

        if (!userId) {
          return Response.json(
            { error: "user_id is required for this caller" },
            { status: 400 },
          );
        }

        const { data: row, error: lookupError } = await supabase
          .from("monitors")
          .select("*")
          .eq("id", body.monitor_id)
          .eq("user_id", userId)
          .single();

        if (lookupError || !row) {
          return Response.json({
            error: "Monitor not found or access denied",
            details: lookupError?.message,
          }, { status: 404 });
        }

        // Forcing a notification is a debug affordance for a signed-in user.
        // Ignored for cron so a malformed payload cannot turn every scheduled
        // check into an alert.
        const force = Boolean(body.force) && ctx.authMode === "user";

        if (!row.is_active) {
          return Response.json({
            error: "Monitor is not active",
            message: "Cannot check inactive monitors",
            success,
          }, { status: 400 });
        }

        // The generated types report these as nullable / raw Json, since jsonb and
        // a nullable text column carry no shape in the schema. Narrow once here
        // rather than casting at each use.
        const lastStatus = (row.last_status ?? "pending") as Status;
        const notificationChannels = parseNotificationChannels(
          row.notification_channels,
        );

        // Perform the monitor check
        const checkResult = await performMonitorCheck(row);

        // Log the check result
        await logMonitorCheck(
          supabase,
          row.id,
          checkResult,
        );

        const lastChecked = new Date().toISOString();

        // Update monitor's last_checked and last_status
        await supabase
          .from("monitors")
          .update({
            last_checked: lastChecked,
            last_status: checkResult.status,
          })
          .eq("id", row.id);

        const newStatus = checkResult.status;

        console.debug(`Check result for monitor ${row.id}:`, checkResult);

        if (!notificationChannels.length) {
          console.warn(
            "No notification channels configured, skipping notifications.",
          );
          return Response.json({
            success,
            data: {
              monitorId: row.id,
              status: newStatus,
              responseTime: checkResult.responseTime,
              didNotify: false,
            },
            message:
              "Monitor check completed, but no notification channels configured",
            timestamp: new Date().toISOString(),
          });
        }

        const notificationService = new NotificationService(supabase);

        const notificationSpec = getNotificationSpec(
          lastStatus,
          newStatus,
          // Already restricted to user-mode callers above.
          force,
        );

        if (!notificationSpec) {
          console.debug(
            "No status change or no notification needed, skipping.",
          );
          return Response.json({
            success: true,
            data: {
              monitorId: row.id,
              status: newStatus,
              responseTime: checkResult.responseTime,
              contentSnippet: checkResult.contentSnippet,
              errorMessage: checkResult.errorMessage,
              statusChanged: false,
              checkedAt: lastChecked,
              didNotify: false,
            },
            message: "Monitor check completed successfully | no status change",
            timestamp: new Date().toISOString(),
          });
        }

        console.debug(
          "Status changed and notifications configured, evaluating notifications...",
        );

        try {
          await notificationService.sendNotifications({
            monitor: row,
            type: notificationSpec.type,
            reason: notificationSpec.reason,
            contentSnippet: checkResult.contentSnippet,
          }, notificationChannels);
          success = true;
        } catch (error) {
          console.error("Failed to send notifications:", error);
        }

        return Response.json({
          success,
          data: {
            monitorId: row.id,
            status: newStatus,
            responseTime: checkResult.responseTime,
            contentSnippet: checkResult.contentSnippet,
            errorMessage: checkResult.errorMessage,
            statusChanged: !!notificationSpec,
            checkedAt: lastChecked,
            // The other return paths all report didNotify; without it here the
            // one path that actually sends is the only one a caller cannot read.
            didNotify: success,
          },
          message: "Monitor check completed successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Error processing monitor check:", error);
        return Response.json({
          error: "Internal server error",
          success,
          details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
      }
    },
  ),
};
