import { Context, Next } from "jsr:@hono/hono@^4.6.3";
import type { AppVariables } from "../types.ts";
import { createServiceClient } from "../lib/supabase.ts";

/**
 * Strict auth for cron-only endpoints.
 * - Accepts X-Cron-Secret header matching CRON_SECRET (or OG_CRON_SECRET)
 * - If CRON_SECRET is not configured, falls back to service role Authorization/apikey for compatibility
 * - Attaches a service Supabase client to context and does NOT set user context
 */
export async function cronAuthMiddleware(
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  // Only allow POST for cron checks
  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  const cronSecretHeader =
    (c.req.header("X-Cron-Secret") || c.req.header("x-cron-secret") || "")
      .trim();
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("apikey") || c.req.header("x-api-key");

  const cronSecret =
    (Deno.env.get("OG_CRON_SECRET") ?? Deno.env.get("CRON_SECRET") ?? "")
      .trim();

  // Service role credentials (acceptable alternative auth)
  const serviceRoleKey = Deno.env.get("OG_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isServiceBearer = !!authHeader?.startsWith("Bearer ") &&
    serviceRoleKey && (authHeader.substring(7) === serviceRoleKey);
  const isServiceApiKey = !!apiKeyHeader && serviceRoleKey &&
    (apiKeyHeader === serviceRoleKey);

  // Accept EITHER a matching cron secret OR valid service-role credentials
  if (cronSecret && cronSecretHeader && cronSecretHeader === cronSecret) {
    const svc = createServiceClient();
    c.set("supabase", svc);
    await next();
    return;
  }

  if (serviceRoleKey && (isServiceBearer || isServiceApiKey)) {
    const svc = createServiceClient();
    c.set("supabase", svc);
    await next();
    return;
  }

  return c.json({ error: "Unauthorized" }, 401);
}
