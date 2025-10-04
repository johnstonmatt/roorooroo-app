// Main Hono application entry point
import { Hono } from "jsr:@hono/hono@4.9.8";
// Import middleware
import { logger } from "jsr:@hono/hono@4.9.8/logger";
import { corsMiddleware, webhookCorsMiddleware } from "./middleware/cors.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { cronAuthMiddleware } from "./middleware/cron.ts";
import { errorHandler } from "./middleware/error.ts";

import { monitors } from "./routes/monitors.ts";
import { monitorCheck } from "./routes/monitor-check.ts";
import { notifications } from "./routes/notifications.ts";
import { webhooks } from "./routes/webhooks.ts";
import { auth } from "./routes/auth.ts";

// Create main Hono application
import type { AppVariables } from "./types.ts";
const api = new Hono<{ Variables: AppVariables }>().basePath("/api");

api.use(logger());

// Global error handler
api.onError(errorHandler);

// Apply CORS middleware globally (except for webhooks which have their own)
api.use("*", (c, next) => {
  // Skip CORS for webhook endpoints as they use their own middleware
  if (c.req.url.includes("/webhooks/")) {
    return next();
  }
  // IMPORTANT: Return the result of the CORS middleware so it can
  // short-circuit and respond to OPTIONS preflight requests (204).
  return corsMiddleware(c, next);
});

// Health check endpoint (no auth required)
api.get(
  "/health",
  (c) =>
    c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
    }),
);

// Status endpoint with basic system info (no auth required)
api.get(
  "/status",
  (c) =>
    c.json({
      service: "Hono API Server",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: performance.now(),
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
      endpoints: {
        health: "/health",
        status: "/status",
        monitors: "/monitors",
        monitorCheck: "/monitors/check",
        notifications: "/notifications",
        webhooks: "/webhooks/*",
      },
    }),
);

// Default root route
api.get(
  "/meta",
  (c) =>
    c.json({
      message: "Hono API Server",
      version: "1.0.0",
      documentation: "Visit /status for available endpoints",
      timestamp: new Date().toISOString(),
    }),
);

// Webhook routes - use webhook-specific CORS, no auth required for external webhooks
api.use("/webhooks/*", webhookCorsMiddleware);
api.route("/webhooks", webhooks);

// Public auth routes (no auth required)
api.route("/auth", auth);

// Cron-protected monitor check MUST be registered before generic /monitors auth
api.use("/monitors/check", cronAuthMiddleware);
api.use("/monitors/check/*", cronAuthMiddleware);

api.route("/monitors/check", monitorCheck);

// Authenticated routes (excluding /monitors/check)
api.use("/monitors/*", authMiddleware);
api.route("/monitors", monitors);

api.use("/notifications/*", authMiddleware);
api.route("/notifications", notifications);

const availableEndpoints = api.routes
  .filter((route) => route.method !== "ALL")
  .sort((a, b) => a.path.localeCompare(b.path))
  .map((route) => `${route.method} ${route.path}`);

// Catch-all route for undefined endpoints
api.all(
  "*",
  (c) =>
    c.json({
      error: "Not Found",
      message: `Endpoint ${c.req.method} ${c.req.url} not found`,
      availableEndpoints,
    }, 404),
);

// Export the app for Supabase Edge Functions
Deno.serve(api.fetch);
