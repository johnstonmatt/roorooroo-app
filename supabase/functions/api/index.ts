// Single Edge Function hosting the whole API surface.
//
// The pipeline is withOpenApi, then withSupabase, then the handler.
//
// withOpenApi is outermost, which is what makes /openapi.json and /reference
// genuinely public: they are answered above the gate, so no credential is
// read for them and a caller presenting a bad one is no longer told 401 for a
// public document. Under the previous order that was a real failure, not a
// hypothetical -- the legacy anon key is not a valid user JWT, and
// api-client.ts sends it as a bearer whenever there is no session.
//
// Being outermost also makes CORS withOpenApi's, since nothing below it sees
// a request it answers itself. withSupabase's own handling is switched off so
// exactly one layer stamps headers, and most of the policy is then read off
// the document: a preflight for /check-endpoint advertises POST rather than
// the blanket verb list a hand-written policy has to guess at.
//
// The gate no longer needs a mode that matches unconditionally. `none` existed
// only so an anonymous caller could reach the document from below it; with the
// document served above it, an anonymous /check-endpoint request is refused by
// the gate rather than by a guard clause in the handler.
//
// What the order costs: routing and body validation now run before any
// credential is looked at, so an unauthenticated caller sending a malformed
// body gets a 400 naming the violation where it used to get a 401. The
// document is public, so the schema it leaks is not a secret -- but the
// validator does now run for callers the gate would have turned away.
//
// Authorizing the monitor stays the handler's job: the document says what a
// request must look like, never whose monitor it may name.
import { withOpenApi } from "@croutonian/with-openapi";
import { pipeline } from "@supabase/middleware";
import { withSupabase } from "@supabase/server";
import type { Database } from "../../db/database.types.ts";
import { logger } from "../_shared/config.ts";
import { apiDocument } from "../_shared/openapi-document.ts";
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

/**
 * The /check-endpoint body as the handler receives it -- after withOpenApi has
 * checked it against the document, which is why `monitor_id` is not optional
 * here when it is optional in a hand-parsed body.
 */
interface RequestBody {
  monitor_id: string;
  user_id?: string;
  force?: boolean;
}

function errorResponse(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): Response {
  // `success` means "the check ran", so it is false on every error path.
  // Centralised here so no branch can disagree about that.
  return Response.json({ success: false, error, ...extra }, { status });
}

/**
 * One shape for every completed check, so a caller never has to work out
 * which branch produced the response: `success` is always true, every field
 * is always present, and `statusChanged` always reports the real comparison.
 * The four return paths this replaced each broke one of those.
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

/**
 * Where this API is mounted *from the worker's point of view*, which is not
 * what its public URL says.
 *
 * A caller fetches /functions/v1/api/<path>; the platform routes on that,
 * strips /functions/v1, and hands the worker /api/<path> with the function
 * name still on the front. So this is deliberately not `servers[0].url` in
 * apiDocument -- that field describes the public prefix, and setting basePath
 * to it makes every single request a 404, preflights included, because nothing
 * the worker ever sees starts with it.
 */
const BASE_PATH = "/api";

/**
 * Request headers allowed on every route, on top of the ones withOpenApi
 * derives from each operation.
 *
 * These belong to the platform rather than to this API, which is why no
 * document can describe them per-operation. `apikey` and the bearer are what
 * the Functions gateway routes on, and api-client.ts attaches both to every
 * request including the one for the public document, whose operation declares
 * `security: []` and so derives neither; `content-type` rides along on that
 * GET the same way; supabase-js adds the rest (client identity, its retry
 * counter, W3C trace propagation) to anything sent through `functions.invoke`.
 *
 * This is the set withSupabase used to stamp on every response, kept whole so
 * moving CORS between layers does not quietly narrow what a browser may send.
 */
const PLATFORM_CORS_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "x-client-info",
  "x-retry-count",
  "traceparent",
  "tracestate",
  "baggage",
];

export default {
  fetch: pipeline(
    [
      withOpenApi({
        document: apiDocument,
        basePath: BASE_PATH,
        // Reference paths are matched against the whole pathname, before
        // basePath is stripped, so they repeat BASE_PATH themselves. The
        // document keeps the /openapi.json it has always been served from --
        // that is where the dashboard status badge looks -- and the Scalar
        // page is new alongside it, rendered from the same document rather
        // than a second copy that could disagree with it.
        reference: {
          path: `${BASE_PATH}/reference`,
          documentPath: `${BASE_PATH}/openapi.json`,
        },
        // Who may call an API is the one thing its description does not say,
        // so `origin` is the only part of this not derived. Wildcard, as
        // before: the credential is what protects the route, never the origin.
        //
        // x-supabase-server-error is exposed because withSupabase's own CORS
        // did it and we turned that off: the gate names its refusal there
        // (MISSING_CREDENTIALS, and so on) and a non-safelisted response
        // header is unreadable cross-origin unless it is listed. Not
        // derivable -- the header is the gate's, so no Response Object in the
        // document declares it.
        cors: {
          origin: "*",
          allowedHeaders: PLATFORM_CORS_HEADERS,
          exposedHeaders: ["x-supabase-server-error"],
        },
      }),
      // cors: "disabled" because withOpenApi above already answered every
      // preflight and stamps every response on the way out. Left on, this
      // layer would re-advertise a blanket GET/POST/PUT/PATCH/DELETE/OPTIONS
      // on responses whose route accepts one verb.
      withSupabase<Database>({ auth: ["user", "secret"], cors: "disabled" }),
    ],
    async (_req, ctx) => {
      try {
        // Least privilege per caller: a user gets the RLS-scoped client,
        // cron gets the admin one. Cron has no auth.uid() to scope by and
        // legitimately acts for a user it is not, so the scoped client cannot
        // serve it -- note ctx.supabase stays RLS-restricted in secret mode
        // too, despite the docs describing it as full access.
        //
        // For a user, those policies are a backstop, which makes the user_id
        // filter below defence in depth rather than the only thing between
        // them and another user's rows.
        // Tested positively for "secret" rather than negatively for "user",
        // so a mode added to the config later fails closed.
        const supabase = ctx.authMode === "secret"
          ? ctx.supabaseAdmin
          : ctx.supabase;

        // Not a path a request can take: onUnknownRoute and onUnknownMethod
        // both default to "reject", so withOpenApi answered anything it could
        // not match before this ran. It is here to narrow the union.
        if (!ctx.openapi.matched) {
          return errorResponse(404, "Not Found");
        }

        // Read, parsed and checked against the document upstream -- a body
        // that is not JSON, omits monitor_id, or spells it as something other
        // than a uuid was already answered 400, naming the violation. The cast
        // is the one thing the document cannot supply: a schema is data, so
        // ctx.openapi.body is `unknown` by construction.
        const body = ctx.openapi.body as RequestBody;

        // The security rule: a user-mode caller is pinned to the subject in
        // their verified JWT, and any user_id in the body is discarded. Only
        // secret mode (pg_cron) is trusted to name a user.
        const userId = ctx.authMode === "secret"
          ? body.user_id
          : ctx.userClaims?.id;

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

        // A jsonb column and a nullable text column carry no shape in the
        // schema, so the generated types report these as raw Json and
        // nullable. Narrow once here rather than casting at each use.
        const lastStatus = (row.last_status ?? "pending") as Status;
        const notificationChannels = parseNotificationChannels(
          row.notification_channels,
        );

        const checkResult = await performMonitorCheck(row);
        const newStatus = checkResult.status;
        // Did the observed status change? Separate from whether that earns
        // a notification, which `force` also feeds into.
        const statusChanged = newStatus !== lastStatus;
        const checkedAt = new Date().toISOString();

        await logMonitorCheck(supabase, row.id, checkResult);

        const { error: updateError } = await supabase
          .from("monitors")
          .update({ last_checked: checkedAt, last_status: newStatus })
          .eq("id", row.id);

        // supabase-js resolves with `{ error }` rather than rejecting, so a
        // failed update is silent unless the error is read. Left unread, a
        // monitor that never records its new status re-alerts on every run.
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

        // sendNotifications catches per-channel failures and never rejects,
        // so "it did not throw" says nothing -- only the results do.
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
