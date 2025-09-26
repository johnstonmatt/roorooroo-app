import { Context, Next } from "jsr:@hono/hono@^4.6.3";
import type { AppVariables } from "../types.ts";
import {
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
  console.log("AUTH_MIDDLEWARE");
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createSupabaseClient();

    // Verify the JWT token and get user information
    const { data: { user }, error } = await supabase.auth.getUser(token);
    console.log(user ? `USER ${user.email}` : `ERROR ${JSON.stringify(error)}`);

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

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

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

  await next();
}

/**
 * Admin role validation middleware
 * Should be used after authMiddleware to ensure user has admin privileges
 */
export async function adminMiddleware(
  c: Context<{ Variables: AppVariables }>,
  next: Next,
) {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  // Check if user has admin role in their metadata or profile
  const supabase = c.get("supabase");
  if (!supabase) {
    return c.json({ error: "Authentication required" }, 401);
  }

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || !profile || profile.role !== "admin") {
      return c.json({ error: "Admin access required" }, 403);
    }

    await next();
  } catch (error) {
    console.error("Admin validation error:", error);
    return c.json({ error: "Access validation failed" }, 500);
  }
}
