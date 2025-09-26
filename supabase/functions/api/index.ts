// Main Hono application entry point
import { Hono } from "jsr:@hono/hono";

// Import middleware
import { corsMiddleware, webhookCorsMiddleware } from "./middleware/cors.ts";
import {
  adminMiddleware,
  authMiddleware,
  optionalAuthMiddleware,
} from "./middleware/auth.ts";
import { asyncHandler, errorHandler } from "./middleware/error-handler.ts";

// Import route handlers
import { admin } from "./routes/admin.ts";
import { monitors } from "./routes/monitors.ts";
import { monitorCheck } from "./routes/monitor-check.ts";
import { notifications } from "./routes/notifications.ts";
import { webhooks } from "./routes/webhooks.ts";

// Create main Hono application
const api = new Hono().basePath("/api");

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
  asyncHandler(async (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: Deno.env.get("DENO_DEPLOYMENT_ID")
        ? "production"
        : "development",
    });
  }),
);

// Status endpoint with basic system info (no auth required)
api.get(
  "/status",
  asyncHandler(async (c) => {
    return c.json({
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
    });
  }),
);

// Default root route
api.get(
  "/",
  asyncHandler(async (c) => {
    return c.json({
      message: "Hono API Server",
      version: "1.0.0",
      documentation: "Visit /status for available endpoints",
      timestamp: new Date().toISOString(),
    });
  }),
);

// API Routes with authentication middleware

// Admin routes - require authentication and admin role
api.route("/admin", admin.use("*", authMiddleware).use("*", adminMiddleware));

// Monitor routes - require authentication
api.route("/monitors", monitors.use("*", authMiddleware));

// Monitor check routes - require authentication
api.route("/monitors/check", monitorCheck.use("*", authMiddleware));

// Notifications routes - require authentication
api.route("/notifications", notifications.use("*", authMiddleware));

// Webhook routes - use webhook-specific CORS, no auth required for external webhooks
api.route("/webhooks", webhooks.use("*", webhookCorsMiddleware));

// Catch-all route for undefined endpoints
api.all(
  "*",
  asyncHandler(async (c) => {
    // TODO: generate available endpoints dynamically
    const availableEndpoints = api.routes.map((route) =>
      `${route.method} ${route.path}`
    );
    return c.json({
      error: "Not Found",
      message: `Endpoint ${c.req.method} ${c.req.url} not found`,
      availableEndpoints,
    }, 404);
  }),
);

// Export the app for Supabase Edge Functions
Deno.serve(api.fetch);
