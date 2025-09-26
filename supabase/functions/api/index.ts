// Main Hono application entry point
import { Hono } from "jsr:@hono/hono";
// Import middleware
import { logger } from "jsr:@hono/hono/logger";
import { corsMiddleware, webhookCorsMiddleware } from "./middleware/cors.ts";
import {
  adminMiddleware,
  authMiddleware,
  // optionalAuthMiddleware,
} from "./middleware/auth.ts";
import { errorHandler } from "./middleware/error-handler.ts";

// Import route handlers
import { admin } from "./routes/admin.ts";
import { monitors } from "./routes/monitors.ts";
import { monitorCheck } from "./routes/monitor-check.ts";
import { notifications } from "./routes/notifications.ts";
import { webhooks } from "./routes/webhooks.ts";

// Create main Hono application
const api = new Hono();

api.use(logger());

// Global error handler
api.onError(errorHandler);

// Apply CORS middleware globally (except for webhooks which have their own)
api.use("*", async (c, next) => {
  // Skip CORS for webhook endpoints as they use their own middleware
  if (c.req.url.includes("/webhooks/")) {
    await next();
  } else {
    await corsMiddleware(c, next);
  }
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
        admin: "/admin/*",
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

// Authenticated routes
api.use("/monitors/*", authMiddleware);
api.route("/monitors", monitors);

api.use("/monitors/check/*", authMiddleware);
api.route("/monitors/check", monitorCheck);

api.use("/notifications/*", authMiddleware);
api.route("/notifications", notifications);

// Admin routes - require authentication and admin role
api.use("/admin/*", authMiddleware, adminMiddleware);
api.route("/admin", admin);

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
