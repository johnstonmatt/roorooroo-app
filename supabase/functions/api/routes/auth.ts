// Auth routes (no auth required)
import { Hono } from "jsr:@hono/hono@4.9.8";
import type { ContentfulStatusCode } from "jsr:@hono/hono@4.9.8/utils/http-status";
import type { AppVariables } from "../types.ts";
import { createSupabaseClient } from "../lib/supabase.ts";
import { config } from "../lib/config.ts";
import { validateAndThrow } from "../lib/validation.ts";

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
      const status: ContentfulStatusCode =
        (error as unknown as { status?: ContentfulStatusCode })?.status ?? 400;
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

/**
 * POST /api/auth/signup
 * Registers a user using email/password via Supabase Auth
 * Sends a confirmation email and does not return session tokens
 */
auth.post("/signup", async (c) => {
  try {
    const { email, password, displayName } = await c.req.json();

    // Validate request
    validateAndThrow(
      {
        email: {
          required: true,
          type: "email",
          custom: (value: unknown) => {
            if (typeof value !== "string") return "Email is invalid";
            return value.toLowerCase().endsWith("@supabase.io")
              ? true
              : "Email must be a @supabase.io address";
          },
        },
        password: { required: true, type: "string", minLength: 6 },
        displayName: {
          required: false,
          type: "string",
          minLength: 1,
          maxLength: 100,
        },
      },
      { email, password, displayName },
    );

    const supabase = createSupabaseClient();

    const emailRedirectTo = `${config.frontend.url}/dashboard`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: (displayName && String(displayName).trim()) ||
            String(email).split("@")[0],
        },
      },
    });

    if (error) {
      const status: ContentfulStatusCode =
        (error as unknown as { status?: ContentfulStatusCode })?.status ?? 400;
      const code = (error as unknown as { code?: string })?.code;
      const message = (error as unknown as { message?: string })?.message ||
        "Failed to sign up";
      return c.json({ error: message, code }, status);
    }

    // For security, do not return user details here
    return c.json({
      message: "Signup successful. Check your email to confirm.",
    }, 200);
  } catch (e) {
    console.error("/auth/signup error", e);
    // If validation error bubbled up, it was already meaningful; standardize response
    const message = (e as { message?: string })?.message || "Failed to sign up";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /api/auth/logout
 * Clears client session context. Invalidate tokens on client; server simply acknowledges.
 */
auth.post("/logout", (c) => {
  try {
    // Optionally: in the future, use admin APIs to revoke the user's refresh token.
    // For now, the browser clears its session; we just acknowledge.
    return c.json({ success: true, message: "Signed out" });
  } catch (e) {
    console.error("/auth/logout error", e);
    return c.json({ error: "Failed to sign out" }, 500);
  }
});

export { auth };
