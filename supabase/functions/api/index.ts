// Single Edge Function hosting the whole API surface.
//
// Order matters. withCORS is outermost so every response carries CORS headers,
// including the ones middlewares above the auth gate return themselves.
// withOpenAPI then runs BEFORE withSupabase, so the document is public and
// undeclared paths 404 before reaching the auth gate. The handler then
// resolves and authorizes the monitor itself.
import { pipeline } from "@supabase/middleware";
import { withSupabase } from "@supabase/server";
import type { Database } from "../../db/database.types.ts";
import { logger } from "../_shared/config.ts";
import { apiDocument } from "../_shared/openapi-document.ts";
import { withCORS } from "../_shared/with-cors.ts";
import { withOpenAPI } from "../_shared/with-openapi.ts";
import {
  type CheckResult,
  getNotificationSpec,
  logMonitorCheck,
  performMonitorCheck,
} from "../_shared/monitor.ts";
import {
  type NotificationResult,
  NotificationService,
  parseNotificationChannels,
} from "../_shared/notifications.ts";
import type { Status } from "../_shared/notifications.ts";

interface RequestBody {
  monitor_id?: string;
  user_id?: string;
  force?: boolean;
}

function errorResponse(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): Response {
  // `success` means "the check ran", so it is false on every error path. It
  // used to be seeded from a mutable local, which reported success: false on
  // one of the completed-check paths too.
  return Response.json({ success: false, error, ...extra }, { status });
}

/**
 * One shape for every completed check, so a caller never has to work out
 * which branch produced the response. The four return paths this replaced
 * disagreed on `success`, omitted `contentSnippet`/`checkedAt` in some
 * branches, and reported `statusChanged: true` unconditionally.
 */
function checkResponse(args: {
  monitorId: string;
  result: CheckResult;
  statusChanged: boolean;
  checkedAt: string;
  didNotify: boolean;
  message: string;
  channels?: NotificationResult[];
}): Response {
  return Response.json({
    success: true,
    data: {
      monitorId: args.monitorId,
      status: args.result.status,
      responseTime: args.result.responseTime,
      contentSnippet: args.result.contentSnippet,
      errorMessage: args.result.errorMessage,
      statusChanged: args.statusChanged,
      checkedAt: args.checkedAt,
      didNotify: args.didNotify,
      channels: args.channels?.map((r) => ({
        type: r.channel.type,
        success: r.success,
        error: r.error,
      })),
    },
    message: args.message,
    timestamp: new Date().toISOString(),
  });
}

export default {
  fetch: pipeline(
    [
      withCORS({}),
      withOpenAPI({ document: apiDocument }),
      withSupabase<Database>({ auth: ["user", "secret"] }),
    ],
    async (req, ctx) => {
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

        let body: RequestBody;
        try {
          body = await req.json();
        } catch {
          return errorResponse(400, "body is not valid JSON");
        }

        if (!body.monitor_id) {
          return errorResponse(400, "monitor_id is required");
        }

        // The security rule: a user-mode caller is pinned to the subject in
        // their verified JWT, and any user_id in the body is discarded. Only
        // secret mode (pg_cron) is trusted to name a user.
        const userId = ctx.authMode === "user"
          ? ctx.userClaims?.id
          : body.user_id;

        if (!userId) {
          return errorResponse(400, "user_id is required for this caller");
        }

        const { data: row, error: lookupError } = await supabase
          .from("monitors")
          .select("*")
          .eq("id", body.monitor_id)
          .eq("user_id", userId)
          .single();

        if (lookupError || !row) {
          return errorResponse(404, "Monitor not found or access denied", {
            details: lookupError?.message,
          });
        }

        if (!row.is_active) {
          return errorResponse(400, "Monitor is not active", {
            message: "Cannot check inactive monitors",
          });
        }

        // Forcing a notification is a debug affordance for a signed-in user.
        // Ignored for cron so a malformed payload cannot turn every scheduled
        // check into an alert.
        const force = Boolean(body.force) && ctx.authMode === "user";

        // The generated types report these as nullable / raw Json, since jsonb
        // and a nullable text column carry no shape in the schema. Narrow once
        // here rather than casting at each use.
        const lastStatus = (row.last_status ?? "pending") as Status;
        const notificationChannels = parseNotificationChannels(
          row.notification_channels,
        );

        const checkResult = await performMonitorCheck(row);
        const newStatus = checkResult.status;
        // Whether the world changed -- independent of whether that earns a
        // notification, which `force` also influences.
        const statusChanged = newStatus !== lastStatus;
        const checkedAt = new Date().toISOString();

        await logMonitorCheck(supabase, row.id, checkResult);

        const { error: updateError } = await supabase
          .from("monitors")
          .update({ last_checked: checkedAt, last_status: newStatus })
          .eq("id", row.id);

        // supabase-js resolves with `{ error }` rather than rejecting, so this
        // has to be read. It previously went unchecked entirely, and a monitor
        // that failed to record its status would re-alert on every run.
        if (updateError) {
          logger.error(
            `Failed to update monitor ${row.id}: ${updateError.message}`,
          );
        }

        logger.debug(`Check result for monitor ${row.id}:`, checkResult);

        if (!notificationChannels.length) {
          logger.warn(
            "No notification channels configured, skipping notifications.",
          );
          return checkResponse({
            monitorId: row.id,
            result: checkResult,
            statusChanged,
            checkedAt,
            didNotify: false,
            message:
              "Monitor check completed, but no notification channels configured",
          });
        }

        const notificationSpec = getNotificationSpec(
          lastStatus,
          newStatus,
          force,
        );

        if (!notificationSpec) {
          logger.debug("No status change or no notification needed, skipping.");
          return checkResponse({
            monitorId: row.id,
            result: checkResult,
            statusChanged,
            checkedAt,
            didNotify: false,
            message: "Monitor check completed successfully | no status change",
          });
        }

        const results = await new NotificationService(supabase)
          .sendNotifications({
            monitor: row,
            type: notificationSpec.type,
            reason: notificationSpec.reason,
            contentSnippet: checkResult.contentSnippet,
            errorMessage: checkResult.errorMessage,
          }, notificationChannels);

        // sendNotifications catches per-channel failures and never rejects, so
        // "it did not throw" says nothing. Only the results do.
        const didNotify = results.some((r) => r.success);
        const failed = results.filter((r) => !r.success);

        if (failed.length) {
          logger.error(
            `${failed.length}/${results.length} notification channel(s) failed for monitor ${row.id}: ` +
              failed.map((r) => `${r.channel.type}: ${r.error}`).join("; "),
          );
        }

        return checkResponse({
          monitorId: row.id,
          result: checkResult,
          statusChanged,
          checkedAt,
          didNotify,
          channels: results,
          message: didNotify
            ? failed.length
              ? "Monitor check completed; some notification channels failed"
              : "Monitor check completed successfully"
            : "Monitor check completed, but every notification channel failed",
        });
      } catch (error) {
        logger.error("Error processing monitor check:", error);
        return errorResponse(500, "Internal server error", {
          details: error instanceof Error ? error.message : String(error),
        });
      }
    },
  ),
};
