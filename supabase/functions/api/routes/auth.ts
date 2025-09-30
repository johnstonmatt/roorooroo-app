// Auth routes (no auth required)
import { Hono } from "jsr:@hono/hono@4.9.8";
import type { AppVariables } from "../types.ts";
import { createSupabaseClient } from "../lib/supabase.ts";

const auth = new Hono<{ Variables: AppVariables }>();

/**
 * POST /api/auth/login
 * Sign in a user using email/password against Supabase Auth
 * Returns access and refresh tokens so the client can set its session
 */
auth.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const supabase = createSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      // Surface Supabase Auth error details when available
      const status = (error as unknown as { status?: number })?.status ?? 400;
      const code = (error as unknown as { code?: string })?.code;
      const message = (error as unknown as { message?: string })?.message ||
        "Invalid email or password";
      return c.json({ error: message, code }, status);
    }

    // Return only what's needed for the client to establish a session
    return c.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (e) {
    console.error("/auth/login error", e);
    return c.json({ error: "Failed to sign in" }, 500);
  }
});

export { auth };
