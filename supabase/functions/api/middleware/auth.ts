import { Context, Next } from "jsr:@hono/hono@^4.6.3";
import type { AppVariables } from "../types.ts";
import {
  createServiceClient,
  createSupabaseClient,
  createSupabaseClientWithAuth,
} from "../lib/supabase.ts";

/**
 * Authentication middleware that validates Supabase JWT tokens
 * Extracts user information and makes it available in the context
 */
export async function authMiddleware(
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createSupabaseClient();

    // Verify the JWT token and get user information
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Store user and authenticated supabase client in context
    c.set("user", user);
    c.set("userId", user.id);
    c.set("userEmail", user.email);

    // Create a Supabase client authenticated as the user for RLS
    const userSupabase = createSupabaseClientWithAuth(token);
    c.set("supabase", userSupabase);

    await next();
  } catch (error) {
    console.error("Authentication error:", error);
    return c.json({ error: "Authentication failed" }, 401);
  }
}

/**
 * Optional authentication middleware that doesn't require authentication
 * but extracts user info if a valid token is provided
 */
export async function optionalAuthMiddleware(
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");
  const apiKeyHeader = c.req.header("apikey") || c.req.header("x-api-key");

  // Prefer an explicit service-role authentication path for server -> server (cron) calls
  const serviceRoleKey = Deno.env.get("OG_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Helper: safely compare a bearer token to the service role key without logging secrets
  const isServiceRoleBearer = (hdr?: string) => {
    if (!hdr?.startsWith("Bearer ") || !serviceRoleKey) return false;
    const token = hdr.substring(7);
    return token === serviceRoleKey;
  };

  // If the request is authenticated with the service role, attach a service client
  if (
    isServiceRoleBearer(authHeader) ||
    (apiKeyHeader && serviceRoleKey && apiKeyHeader === serviceRoleKey)
  ) {
    try {
      const svc = createServiceClient();
      c.set("supabase", svc);
      // Intentionally do not set user context when using service role
      await next();
      return;
    } catch (e) {
      // Fall through to user auth path if service client creation fails
      console.error("optionalAuthMiddleware: failed to init service client", e);
    }
  }

  // Otherwise, attempt user-auth via JWT (if provided)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // Heuristic: Supabase user JWTs are JWT-formatted (contain two dots)
    const looksLikeJWT = token.split(".").length === 3;

    if (looksLikeJWT) {
      try {
        const supabase = createSupabaseClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
          c.set("user", user);
          c.set("userId", user.id);
          c.set("userEmail", user.email);

          const userSupabase = createSupabaseClientWithAuth(token);
          c.set("supabase", userSupabase);
        }
      } catch {
        // Ignore authentication errors in optional middleware
      }
    }
  }

  await next();
}
